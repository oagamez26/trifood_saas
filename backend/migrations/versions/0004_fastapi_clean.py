"""Reconcile the historical schema and add catalog concurrency constraints.

The frozen schema is stored in migrations/schema_v2.py. Existing data is never
deleted. Conflicting normalized codes/names fail before any data updates.
"""

import importlib.util
from pathlib import Path
from alembic import op
import sqlalchemy as sa

revision = "0004_fastapi_clean"
down_revision = "0003_tables_orders"
branch_labels = None
depends_on = None


def schema():
    spec = importlib.util.spec_from_file_location(
        "schema_v2", Path(__file__).parents[1] / "schema_v2.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.Base.metadata


def upgrade():
    bind = op.get_bind()
    metadata = schema()
    existing = set(sa.inspect(bind).get_table_names())
    for table_name, column, normalizer in [
        ("catalog_products", "internal_code", "upper"),
        ("catalog_categories", "name", "lower"),
    ]:
        if table_name in existing:
            duplicates = bind.execute(
                sa.text(
                    f"SELECT {normalizer}(trim({column})) FROM {table_name} GROUP BY {normalizer}(trim({column})) HAVING count(*) > 1"
                )
            ).fetchall()
            if duplicates:
                raise RuntimeError(
                    f"Hay duplicados normalizados en {table_name}; resolverlos antes de migrar."
                )
    defaults = {
        "is_active": sa.true(),
        "is_available": sa.true(),
        "is_current": sa.true(),
        "must_change_password": sa.false(),
        "account_requested": sa.false(),
        "token_version": sa.text("0"),
        "display_order": sa.text("0"),
        "price_version": sa.text("1"),
        "currency": sa.text("'COP'"),
    }
    for table in metadata.sorted_tables:
        if table.name not in existing:
            table.create(bind)
            continue
        columns = {
            column["name"] for column in sa.inspect(bind).get_columns(table.name)
        }
        for column in table.columns:
            if column.name in columns:
                continue
            default = defaults.get(column.name)
            if column.name in {"created_at", "updated_at", "opened_at"}:
                if bind.dialect.name == "sqlite":
                    from datetime import datetime, timezone

                    default = sa.text(
                        "'" + datetime.now(timezone.utc).isoformat() + "'"
                    )
                else:
                    default = sa.text("CURRENT_TIMESTAMP")
            if not column.nullable and not column.primary_key and default is None:
                count = bind.execute(
                    sa.text(f'SELECT count(*) FROM "{table.name}"')
                ).scalar()
                if count:
                    raise RuntimeError(
                        f"La columna obligatoria {table.name}.{column.name} requiere conciliación de datos."
                    )
            # Foreign keys and indexes are reconciled after all columns exist.
            op.add_column(
                table.name,
                sa.Column(
                    column.name,
                    column.type,
                    nullable=column.nullable,
                    server_default=default,
                ),
            )
    bind.execute(
        sa.text("UPDATE catalog_products SET internal_code=upper(trim(internal_code))")
    )
    # Backfill deterministic versions, preserving every historical fact.
    rows = bind.execute(
        sa.text(
            "SELECT id,product_id FROM catalog_product_price_history ORDER BY product_id,changed_at,id"
        )
    ).fetchall()
    counts = {}
    for identity, product_id in rows:
        counts[product_id] = counts.get(product_id, 0) + 1
        bind.execute(
            sa.text(
                "UPDATE catalog_product_price_history SET price_version=:version,currency='COP' WHERE id=:id"
            ),
            {"version": counts[product_id], "id": identity},
        )
    for product_id, version in counts.items():
        bind.execute(
            sa.text("UPDATE catalog_products SET price_version=:version WHERE id=:id"),
            {"version": version, "id": product_id},
        )
    for table in metadata.sorted_tables:
        for index in table.indexes:
            bind.execute(sa.schema.CreateIndex(index, if_not_exists=True))
        if bind.dialect.name == "postgresql":
            inspector = sa.inspect(bind)
            fks = inspector.get_foreign_keys(table.name)
            for constraint in table.foreign_key_constraints:
                cols = [column.name for column in constraint.columns]
                if not any(fk["constrained_columns"] == cols for fk in fks):
                    bind.execute(sa.schema.AddConstraint(constraint))
            existing_checks = {
                x["name"] for x in inspector.get_check_constraints(table.name)
            }
            existing_unique = {
                x["name"] for x in inspector.get_unique_constraints(table.name)
            }
            for constraint in table.constraints:
                if (
                    isinstance(constraint, sa.CheckConstraint)
                    and constraint.name not in existing_checks
                ):
                    bind.execute(sa.schema.AddConstraint(constraint))
                if (
                    isinstance(constraint, sa.UniqueConstraint)
                    and constraint.name
                    and constraint.name not in existing_unique
                ):
                    bind.execute(sa.schema.AddConstraint(constraint))
    # SQLite and PostgreSQL both enforce the history-version unique index.
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_history_product_version ON catalog_product_price_history(product_id,price_version)"
    )


def downgrade():
    raise RuntimeError(
        "Esta migración conserva historia; restaure un respaldo verificado para volver atrás."
    )
