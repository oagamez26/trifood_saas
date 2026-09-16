FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/backend

WORKDIR /app

COPY backend/requirements.lock /app/backend/requirements.lock
RUN pip install --no-cache-dir -r /app/backend/requirements.lock

COPY backend /app/backend
COPY docker/backend-entrypoint-fastapi.sh /app/docker/backend-entrypoint-fastapi.sh
RUN chmod +x /app/docker/backend-entrypoint-fastapi.sh

WORKDIR /app/backend
EXPOSE 5000

ENTRYPOINT ["/app/docker/backend-entrypoint-fastapi.sh"]
