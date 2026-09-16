#!/bin/sh
set -eu

python - <<'PY'
from app import create_app
from app.extensions.db import db
from app.modules.roles.services.role_service import seed_authorization
import app.models

application = create_app()
with application.app_context():
    db.create_all()
    seed_authorization()
PY

if [ -n "${ADMIN_USERNAME:-}" ] && [ -n "${ADMIN_EMAIL:-}" ] && [ -n "${ADMIN_PASSWORD:-}" ]; then
    python scripts/create_admin.py
fi

exec python -m flask --app run:app run --host 0.0.0.0 --port 5000
