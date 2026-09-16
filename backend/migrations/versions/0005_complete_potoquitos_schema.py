"""Complete POTOQUITOS schema: ingredients, recipes, inventory, kardex, cash, payments, invoices, expenses, settings.

Revision ID: 0005_complete_potoquitos_schema
Revises: 0004_fastapi_clean
Create Date: 2026-09-15
"""
from alembic import op
import sqlalchemy as sa
from fastapi_app.infrastructure.models import Base

revision = "0005_complete_potoquitos_schema"
down_revision = "0004_fastapi_clean"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    existing = set(sa.inspect(bind).get_table_names())
    
    # 1. Create all newly defined tables from metadata if they do not exist
    # and reconcile missing columns on existing tables
    for table in Base.metadata.sorted_tables:
        if table.name not in existing:
            table.create(bind)
        else:
            existing_cols = {col["name"] for col in sa.inspect(bind).get_columns(table.name)}
            for col in table.columns:
                if col.name not in existing_cols:
                    server_default = col.server_default
                    if server_default is None and not col.nullable:
                        if col.name == "capacity":
                            server_default = sa.text("4")
                        elif isinstance(col.type, sa.Boolean):
                            server_default = sa.true()
                        elif isinstance(col.type, (sa.Integer, sa.Numeric)):
                            server_default = sa.text("0")
                        elif isinstance(col.type, sa.String):
                            server_default = sa.text("''")
                    op.add_column(
                        table.name,
                        sa.Column(
                            col.name,
                            col.type,
                            nullable=col.nullable,
                            server_default=server_default,
                        ),
                    )


def downgrade():
    bind = op.get_bind()
    new_tables = [
        "restaurant_settings",
        "expenses",
        "expense_categories",
        "invoice_lines",
        "invoices",
        "payment_details",
        "payments",
        "cash_sessions",
        "cash_registers",
        "kardex_entries",
        "inventory_movements",
        "recipe_items",
        "recipes",
        "ingredients",
    ]
    for table_name in new_tables:
        if sa.inspect(bind).has_table(table_name):
            op.drop_table(table_name)
