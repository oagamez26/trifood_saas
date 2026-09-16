import os
from alembic import context
from sqlalchemy import create_engine, pool
from fastapi_app.infrastructure.models import Base

config = context.config
url = config.attributes.get("connection_url") or os.environ.get("DATABASE_URL")
external_connection = config.attributes.get("connection")
if not url and external_connection is None:
    raise RuntimeError("DATABASE_URL es obligatoria para las migraciones.")


def run():
    if external_connection is not None:
        context.configure(
            connection=external_connection,
            target_metadata=Base.metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()
        return
    engine = create_engine(url, poolclass=pool.NullPool)
    with engine.connect() as connection:
        context.configure(
            connection=connection, target_metadata=Base.metadata, compare_type=True
        )
        with context.begin_transaction():
            context.run_migrations()
    engine.dispose()


run()
