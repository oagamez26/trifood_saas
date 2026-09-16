from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from uuid import uuid4
import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text, select, func
from fastapi_app.infrastructure.repositories import SqlUnitOfWork
from fastapi_app.infrastructure.seed import seed_authorization
from fastapi_app.infrastructure import models as m
from fastapi_app.modules.catalog.application.service import CatalogService
from fastapi_app.modules.orders.application.service import OrdersService
from fastapi_app.shared.domain.rules import DomainError

BACKEND = Path(__file__).parents[1]
MARKER = BACKEND.parent / ".validation/postgres-tests-enabled"
URL = "postgresql+psycopg://potoquitos_test@127.0.0.1:15432/potoquitos_test"


@pytest.fixture()
def pg_schema():
    if not MARKER.exists():
        pytest.skip("Activar PostgreSQL aislado según README para esta prueba.")
    root = create_engine(URL)
    name = "validation_" + uuid4().hex
    with root.begin() as conn:
        conn.execute(text(f'CREATE SCHEMA "{name}"'))
    engine = create_engine(URL, connect_args={"options": f"-csearch_path={name}"})
    try:
        yield engine
    finally:
        engine.dispose()
        with root.begin() as conn:
            conn.execute(text(f'DROP SCHEMA "{name}" CASCADE'))
        root.dispose()


def migrate(engine):
    config = Config(str(BACKEND / "alembic.ini"))
    with engine.begin() as connection:
        config.attributes["connection"] = connection
        command.upgrade(config, "head")


def seed(engine):
    from sqlalchemy.orm import sessionmaker

    factory = sessionmaker(bind=engine, expire_on_commit=False)
    work = SqlUnitOfWork(factory())
    seed_authorization(work.session)
    actor = work.auth.save_user(
        {
            "username": "test",
            "email": "test@example.com",
            "first_name": "Test",
            "last_name": "User",
            "password_hash": "unused",
            "roles": ["ADMINISTRADOR"],
        }
    )
    work.commit()
    service = CatalogService(work)
    category = service.save_category(actor, {"name": "Bebidas"})
    product = service.save_product(
        actor,
        {
            "internal_code": "JUGO",
            "name": "Jugo",
            "description": "Natural",
            "current_price": "5000",
            "category_id": category["id"],
        },
    )
    work.close()
    return factory, actor, product


def test_postgres_migration_and_price_race(pg_schema):
    migrate(pg_schema)
    factory, actor, product = seed(pg_schema)

    def change(amount):
        work = SqlUnitOfWork(factory())
        try:
            CatalogService(work).price(actor, product["id"], amount, 1)
            return "ok"
        except DomainError as error:
            return error.code
        finally:
            work.rollback()
            work.close()

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(change, ["6000", "7000"]))
    assert sorted(results) == ["PRICE_CONFLICT", "ok"]
    with factory() as session:
        assert session.get(m.Product, product["id"]).price_version == 2
        assert (
            session.scalar(select(func.count()).select_from(m.ProductPriceHistory)) == 2
        )
        assert (
            session.scalar(
                select(func.count())
                .select_from(m.CatalogAuditEvent)
                .where(m.CatalogAuditEvent.action == "PRICE_CHANGED")
            )
            == 1
        )


def test_postgres_table_open_race(pg_schema):
    migrate(pg_schema)
    factory, actor, _ = seed(pg_schema)
    work = SqlUnitOfWork(factory())
    table = OrdersService(work).create_table(actor, "1")
    work.close()

    def open_table(_):
        current = SqlUnitOfWork(factory())
        try:
            OrdersService(current).open_table(actor, table["id"], 2)
            return "ok"
        except DomainError as error:
            return error.code
        finally:
            current.rollback()
            current.close()

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(open_table, [1, 2])) == ["TABLE_NOT_AVAILABLE", "ok"]
    with factory() as session:
        assert session.scalar(select(func.count()).select_from(m.TableSession)) == 1


def test_postgres_reconciles_populated_prototype(pg_schema):
    with pg_schema.begin() as conn:
        conn.execute(
            text(
                "CREATE TABLE users(id SERIAL PRIMARY KEY,username VARCHAR(80) UNIQUE NOT NULL,email VARCHAR(255) UNIQUE NOT NULL,first_name VARCHAR(100) NOT NULL,last_name VARCHAR(100) NOT NULL,password_hash VARCHAR(255) NOT NULL)"
            )
        )
        conn.execute(
            text(
                "INSERT INTO users(username,email,first_name,last_name,password_hash) VALUES('old','old@example.com','Old','User','preserve-hash')"
            )
        )
        conn.execute(
            text(
                "CREATE TABLE catalog_categories(id SERIAL PRIMARY KEY,name VARCHAR(120) UNIQUE NOT NULL)"
            )
        )
        conn.execute(text("INSERT INTO catalog_categories(name) VALUES('Bebidas')"))
        conn.execute(
            text(
                "CREATE TABLE catalog_products(id SERIAL PRIMARY KEY,internal_code VARCHAR(80) UNIQUE NOT NULL,name VARCHAR(160) NOT NULL,description TEXT NOT NULL,current_price NUMERIC(12,2) NOT NULL,category_id INTEGER NOT NULL)"
            )
        )
        conn.execute(
            text(
                "INSERT INTO catalog_products(internal_code,name,description,current_price,category_id) VALUES(' jugo ','Jugo','Natural',5000,1)"
            )
        )
    migrate(pg_schema)
    with pg_schema.connect() as conn:
        assert (
            conn.execute(text("SELECT password_hash FROM users")).scalar()
            == "preserve-hash"
        )
        assert tuple(
            conn.execute(
                text(
                    "SELECT internal_code,currency,price_version FROM catalog_products"
                )
            ).one()
        ) == ("JUGO", "COP", 1)
        assert conn.execute(text("SELECT count(*) FROM catalog_products")).scalar() == 1
    migrate(pg_schema)  # Idempotent second invocation.
