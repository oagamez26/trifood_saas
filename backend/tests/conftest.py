import pytest
from fastapi.testclient import TestClient
from fastapi_app.bootstrap import create_app
from fastapi_app.settings import Settings
from fastapi_app.infrastructure.models import Base
from fastapi_app.infrastructure.repositories import SqlUnitOfWork
from fastapi_app.infrastructure.seed import seed_authorization


@pytest.fixture()
def app(tmp_path):
    settings = Settings(
        environment="test",
        database_url="sqlite:///:memory:",
        jwt_secret_key="test-only-key-that-is-at-least-32-characters",
        catalog_media_root=tmp_path / "media",
        _env_file=None,
    )
    application = create_app(settings)
    Base.metadata.create_all(application.state.engine)
    work = SqlUnitOfWork(application.state.sessions())
    seed_authorization(work.session)
    work.auth.save_user(
        {
            "username": "admin",
            "email": "admin@example.com",
            "first_name": "Admin",
            "last_name": "User",
            "password_hash": application.state.security.hash_password("Secure123"),
            "roles": ["ADMINISTRADOR"],
        }
    )
    work.auth.save_user(
        {
            "username": "waiter",
            "email": "waiter@example.com",
            "first_name": "Waiter",
            "last_name": "User",
            "password_hash": application.state.security.hash_password("Secure123"),
            "roles": ["MESERO"],
        }
    )
    work.commit()
    work.close()
    yield application
    application.state.engine.dispose()


@pytest.fixture()
def client(app):
    with TestClient(app, raise_server_exceptions=False) as value:
        yield value


@pytest.fixture()
def headers(client):
    response = client.post(
        "/api/auth/login", json={"username": "admin", "password": "Secure123"}
    )
    assert response.status_code == 200, response.text
    return {"Authorization": "Bearer " + response.json()["access_token"]}


@pytest.fixture()
def product(client, headers):
    response = client.post(
        "/api/catalog/categories", json={"name": "Bebidas"}, headers=headers
    )
    assert response.status_code == 201, response.text
    response = client.post(
        "/api/catalog/products",
        json={
            "internal_code": "BEB-1",
            "name": "Jugo",
            "description": "Natural",
            "current_price": "5000.00",
            "category_id": response.json()["id"],
        },
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()
