from pathlib import Path
import sqlite3
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text

BACKEND = Path(__file__).parents[1]


def upgrade(url):
    config = Config(str(BACKEND / "alembic.ini"))
    config.attributes["connection_url"] = url
    command.upgrade(config, "head")


def test_alembic_fresh_database(tmp_path):
    path = tmp_path / "fresh.db"
    url = "sqlite:///" + path.as_posix()
    upgrade(url)
    engine = create_engine(url)
    assert "catalog_product_price_history" in inspect(engine).get_table_names()
    assert "price_version" in {
        c["name"] for c in inspect(engine).get_columns("catalog_products")
    }
    upgrade(url)
    with engine.connect() as connection:
        assert (
            connection.scalar(text("SELECT version_num FROM alembic_version"))
            == "0005_complete_potoquitos_schema"
        )
    engine.dispose()


def test_migrate_copy_preserves_existing_local_data(tmp_path):
    source = BACKEND / "instance/potoquitos.db"
    if not source.exists():
        import pytest

        pytest.skip("No hay base histórica local disponible.")
    target = tmp_path / "legacy_copy.db"
    with (
        sqlite3.connect(source.as_uri() + "?mode=ro", uri=True) as original,
        sqlite3.connect(target) as copied,
    ):
        original.backup(copied)
    with sqlite3.connect(target) as connection:
        tables = [
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name!='alembic_version'"
            )
        ]
        before = {
            name: connection.execute(f'SELECT count(*) FROM "{name}"').fetchone()[0]
            for name in tables
        }
        passwords = (
            connection.execute(
                "SELECT id,password_hash FROM users ORDER BY id"
            ).fetchall()
            if "users" in tables
            else []
        )
    upgrade("sqlite:///" + target.as_posix())
    with sqlite3.connect(target) as connection:
        after = {
            name: connection.execute(f'SELECT count(*) FROM "{name}"').fetchone()[0]
            for name in tables
        }
        assert before == after
        assert (
            passwords
            == connection.execute(
                "SELECT id,password_hash FROM users ORDER BY id"
            ).fetchall()
        )


def test_populated_legacy_schema_preserves_rows_and_hashes(tmp_path):
    path = tmp_path / "populated.db"
    with sqlite3.connect(path) as connection:
        connection.executescript("""
        CREATE TABLE users(id INTEGER PRIMARY KEY, username VARCHAR(80) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE, first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL, password_hash VARCHAR(255) NOT NULL);
        INSERT INTO users VALUES(7,'legacy','legacy@example.com','Legacy','User','preserve-this-hash');
        CREATE TABLE catalog_categories(id INTEGER PRIMARY KEY,name VARCHAR(120) NOT NULL UNIQUE);
        INSERT INTO catalog_categories VALUES(9,'Bebidas');
        CREATE TABLE catalog_products(id INTEGER PRIMARY KEY,internal_code VARCHAR(80) NOT NULL,
        name VARCHAR(160) NOT NULL,description TEXT NOT NULL,current_price NUMERIC(12,2) NOT NULL,
        category_id INTEGER NOT NULL);
        INSERT INTO catalog_products VALUES(13,' jugo ','Jugo','Natural',5000,9);
        """)
    upgrade("sqlite:///" + path.as_posix())
    with sqlite3.connect(path) as connection:
        assert connection.execute("SELECT id,password_hash FROM users").fetchall() == [
            (7, "preserve-this-hash")
        ]
        assert connection.execute(
            "SELECT id,internal_code,current_price,category_id,currency,price_version FROM catalog_products"
        ).fetchall() == [(13, "JUGO", 5000, 9, "COP", 1)]


def test_migration_stops_on_normalized_duplicates(tmp_path):
    path = tmp_path / "duplicates.db"
    with sqlite3.connect(path) as connection:
        connection.execute(
            "CREATE TABLE catalog_categories(id INTEGER PRIMARY KEY, name TEXT)"
        )
        connection.executemany(
            "INSERT INTO catalog_categories(name) VALUES(?)",
            [("Bebidas",), (" bebidas ",)],
        )
    import pytest

    with pytest.raises(RuntimeError, match="duplicados"):
        upgrade("sqlite:///" + path.as_posix())
    with sqlite3.connect(path) as connection:
        assert connection.execute(
            "SELECT name FROM catalog_categories ORDER BY id"
        ).fetchall() == [("Bebidas",), (" bebidas ",)]
