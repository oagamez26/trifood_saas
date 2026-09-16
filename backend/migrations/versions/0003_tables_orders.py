"""Historical revision marker. Schema reconciliation is performed by 0004."""

revision = "0003_tables_orders"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    raise RuntimeError("Use a verified backup.")
