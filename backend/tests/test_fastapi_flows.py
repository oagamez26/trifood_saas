from io import BytesIO
from PIL import Image
from sqlalchemy import select, func
from sqlalchemy.exc import SQLAlchemyError
from fastapi_app.infrastructure import models as m
from fastapi_app.infrastructure.repositories import CatalogRepository
import pytest


def test_health_and_no_bootstrap_on_start(client, app):
    assert client.get("/health").json()["framework"] == "fastapi"
    with app.state.sessions() as session:
        assert session.scalar(select(func.count()).select_from(m.User)) == 2


def test_invalid_login_and_no_sensitive_user_fields(client):
    assert (
        client.post(
            "/api/auth/login", json={"username": "admin", "password": "wrong"}
        ).status_code
        == 401
    )
    data = client.post(
        "/api/auth/login", json={"username": "admin", "password": "Secure123"}
    ).json()
    assert "password_hash" not in data["user"]
    assert "reset_token_hash" not in data["user"]


def test_refresh_requires_csrf_and_logout_revokes_both_tokens(client, headers):
    assert client.post("/api/auth/refresh").status_code == 403
    csrf = client.cookies.get("csrf_refresh_token")
    assert (
        client.post("/api/auth/refresh", headers={"X-CSRF-TOKEN": csrf}).status_code
        == 200
    )
    refresh = client.cookies.get("refresh_token_cookie")
    assert (
        client.get(
            "/api/auth/me", headers={"Authorization": "Bearer " + refresh}
        ).status_code
        == 401
    )
    assert client.post("/api/auth/logout", headers=headers).status_code == 200
    assert client.get("/api/auth/me", headers=headers).status_code == 401


def test_password_change_revokes_previous_session(client, headers):
    assert (
        client.post(
            "/api/auth/change-password",
            headers=headers,
            json={"current_password": "Secure123", "new_password": "Better456"},
        ).status_code
        == 200
    )
    assert client.get("/api/auth/me", headers=headers).status_code == 401
    assert (
        client.post(
            "/api/auth/login", json={"username": "admin", "password": "Better456"}
        ).status_code
        == 200
    )


def test_permissions_and_last_admin(client, headers):
    token = client.post(
        "/api/auth/login", json={"username": "waiter", "password": "Secure123"}
    ).json()["access_token"]
    response = client.get(
        "/api/catalog/products", headers={"Authorization": "Bearer " + token}
    )
    assert response.status_code == 403
    assert response.json()["code"] == "PERMISSION_DENIED"
    assert client.post("/api/users/1/deactivate", headers=headers).status_code == 409


def test_user_role_assignment_and_deactivation(client, headers, app):
    created = client.post(
        "/api/users",
        headers=headers,
        json={
            "username": "new",
            "email": "new@example.com",
            "first_name": "New",
            "last_name": "User",
            "password": "Secure123",
        },
    )
    assert created.status_code == 201
    identity = created.json()["id"]
    assert (
        client.post(
            f"/api/users/{identity}/roles", headers=headers, json={"role": "MESERO"}
        ).status_code
        == 200
    )
    token = client.post(
        "/api/auth/login", json={"username": "new", "password": "Secure123"}
    ).json()["access_token"]
    assert (
        client.post(f"/api/users/{identity}/deactivate", headers=headers).status_code
        == 200
    )
    assert (
        client.get(
            "/api/auth/me", headers={"Authorization": "Bearer " + token}
        ).status_code
        == 401
    )
    assert client.get("/api/audit", headers=headers).status_code == 200


def test_reset_expiry_one_time_and_revocation(client, headers, app, monkeypatch):
    sent = []
    app.state.settings.smtp_host = "example.invalid"
    monkeypatch.setattr(
        app.state.security, "send_reset", lambda email, token: sent.append(token)
    )
    assert (
        client.post(
            "/api/auth/password-reset/request", json={"email": "admin@example.com"}
        ).status_code
        == 200
    )
    token = sent[0]
    assert (
        client.post(
            "/api/auth/password-reset/confirm",
            json={"token": token, "new_password": "Reset1234"},
        ).status_code
        == 200
    )
    assert client.get("/api/auth/me", headers=headers).status_code == 401
    assert (
        client.post(
            "/api/auth/password-reset/confirm",
            json={"token": token, "new_password": "Again1234"},
        ).status_code
        == 400
    )


def test_reset_unconfigured_does_not_simulate_email(client):
    assert (
        client.post(
            "/api/auth/password-reset/request", json={"email": "admin@example.com"}
        ).status_code
        == 503
    )


def test_catalog_same_name_allowed_code_normalized(client, headers, product):
    data = {
        "internal_code": "beb-2",
        "name": "Jugo",
        "description": "Otro",
        "price": "6000",
        "category_id": product["category_id"],
    }
    assert (
        client.post("/api/catalog/products", headers=headers, json=data).status_code
        == 201
    )
    data["internal_code"] = " beb-1 "
    assert (
        client.post("/api/catalog/products", headers=headers, json=data).status_code
        == 409
    )
    values = client.get(
        "/api/catalog/products?q=jugo&sort=current_price&direction=desc&page_size=1",
        headers=headers,
    ).json()
    assert values["total"] == 2 and len(values["items"]) == 1
    assert values["items"][0]["current_price"] == "6000.00"


@pytest.mark.parametrize("value", [0, -1, True, 1.5])
def test_invalid_people(client, headers, product, value):
    assert (
        client.patch(
            f"/api/catalog/products/{product['id']}",
            headers=headers,
            json={"recommended_people": value},
        ).status_code
        == 422
    )


@pytest.mark.parametrize("value", ["-1", "1.234", "NaN", "10000000000"])
def test_invalid_price(client, headers, product, value):
    assert (
        client.post(
            f"/api/catalog/products/{product['id']}/price",
            headers=headers,
            json={"current_price": value, "expected_price_version": 1},
        ).status_code
        == 422
    )


def test_price_conflict_and_history(client, headers, product):
    path = f"/api/catalog/products/{product['id']}/price"
    first = client.post(
        path,
        headers=headers,
        json={"current_price": "6000", "expected_price_version": 1},
    )
    assert first.status_code == 200, first.text
    assert first.json()["price_version"] == 2
    assert (
        client.post(
            path,
            headers=headers,
            json={"current_price": "7000", "expected_price_version": 1},
        ).status_code
        == 409
    )
    assert (
        client.post(
            path,
            headers=headers,
            json={"current_price": "6000", "expected_price_version": 2},
        ).status_code
        == 200
    )
    history = client.get(path + "-history", headers=headers).json()
    assert history["total"] == 2  # initial price + one effective change
    assert history["items"][0]["new_price"] == "6000.00"


def test_missing_version_and_patch_permission_bypass_rejected(client, headers, product):
    assert (
        client.post(
            f"/api/catalog/products/{product['id']}/price",
            headers=headers,
            json={"current_price": "7000"},
        ).status_code
        == 422
    )
    assert (
        client.patch(
            f"/api/catalog/products/{product['id']}",
            headers=headers,
            json={"current_price": "1"},
        ).status_code
        == 422
    )


def test_audit_failure_rolls_back_price(client, headers, product, app, monkeypatch):
    def fail(*args, **kwargs):
        raise SQLAlchemyError("simulated audit unavailable")

    monkeypatch.setattr(CatalogRepository, "audit", fail)
    response = client.post(
        f"/api/catalog/products/{product['id']}/price",
        headers=headers,
        json={"current_price": "7000", "expected_price_version": 1},
    )
    assert response.status_code == 503
    with app.state.sessions() as session:
        p = session.get(m.Product, product["id"])
        assert str(p.current_price) == "5000.00" and p.price_version == 1
        assert (
            session.scalar(select(func.count()).select_from(m.ProductPriceHistory)) == 1
        )


def test_public_menu_privacy_and_reload(client, headers, product):
    response = client.get("/api/public/menu")
    assert response.headers["cache-control"] == "no-store"
    p = response.json()["categories"][0]["products"][0]
    for key in [
        "id",
        "internal_code",
        "price_version",
        "created_at",
        "actor",
        "current_image_id",
    ]:
        assert key not in p
    assert p["currency"] == "COP"
    client.post(
        f"/api/catalog/products/{product['id']}/availability",
        headers=headers,
        json={"is_available": False},
    )
    assert (
        client.get("/api/public/menu").json()["categories"][0]["products"][0][
            "is_available"
        ]
        is False
    )
    client.post(
        f"/api/catalog/categories/{product['category_id']}/deactivate", headers=headers
    )
    assert client.get("/api/public/menu").json()["categories"] == []


def image_bytes():
    output = BytesIO()
    Image.new("RGB", (12, 12), "blue").save(output, format="PNG")
    return output.getvalue()


def test_images_and_failed_replacement(client, headers, product, app, monkeypatch):
    path = f"/api/catalog/products/{product['id']}/image"
    response = client.post(
        path, headers=headers, files={"image": ("x.png", image_bytes(), "image/png")}
    )
    assert response.status_code == 200, response.text
    reference = response.json()["image_reference"]
    assert client.get(reference).status_code == 200
    assert (
        client.post(
            path, headers=headers, files={"image": ("fake.png", b"bad", "image/png")}
        ).status_code
        == 422
    )

    def fail(*args, **kwargs):
        raise SQLAlchemyError("audit unavailable")

    monkeypatch.setattr(CatalogRepository, "audit", fail)
    assert (
        client.post(
            path,
            headers=headers,
            files={"image": ("x.png", image_bytes(), "image/png")},
        ).status_code
        == 503
    )
    assert (
        client.get(f"/api/catalog/products/{product['id']}", headers=headers).json()[
            "image_reference"
        ]
        == reference
    )
    assert len(list(app.state.settings.catalog_media_root.glob("*.jpg"))) == 1


def test_table_order_lifecycle(client, headers, product):
    table = client.post(
        "/api/tables-orders/tables", headers=headers, json={"number": "1"}
    ).json()
    opened = client.post(
        f"/api/tables-orders/tables/{table['id']}/open",
        headers=headers,
        json={"people_count": 2},
    )
    assert opened.status_code == 201, opened.text
    assert (
        client.post(
            f"/api/tables-orders/tables/{table['id']}/open",
            headers=headers,
            json={"people_count": 2},
        ).status_code
        == 409
    )
    order = client.post(
        "/api/tables-orders/orders",
        headers=headers,
        json={
            "table_session_id": opened.json()["id"],
            "lines": [{"product_id": product["id"], "quantity": 2}],
        },
    )
    assert order.status_code == 201, order.text
    identity = order.json()["id"]
    assert (
        client.post(
            f"/api/tables-orders/orders/{identity}/deliver", headers=headers
        ).status_code
        == 409
    )
    for action in ["confirm", "send-kitchen", "prepare", "ready", "deliver"]:
        response = client.post(
            f"/api/tables-orders/orders/{identity}/{action}", headers=headers
        )
        assert response.status_code == 200, response.text
    assert (
        client.post(
            f"/api/tables-orders/tables/{table['id']}/close", headers=headers
        ).status_code
        == 409
    )
    # Delivery cannot be undone via cancellation; payment module handles later steps.
    assert (
        client.post(
            f"/api/tables-orders/orders/{identity}/cancel",
            headers=headers,
            json={"reason": "x"},
        ).status_code
        == 409
    )


def test_order_rejects_inactive_category(client, headers, product):
    table = client.post(
        "/api/tables-orders/tables", headers=headers, json={"number": "1"}
    ).json()
    opened = client.post(
        f"/api/tables-orders/tables/{table['id']}/open",
        headers=headers,
        json={"people_count": 1},
    ).json()
    client.post(
        f"/api/catalog/categories/{product['category_id']}/deactivate", headers=headers
    )
    assert (
        client.post(
            "/api/tables-orders/orders",
            headers=headers,
            json={
                "table_session_id": opened["id"],
                "lines": [{"product_id": product["id"], "quantity": 1}],
            },
        ).status_code
        == 409
    )


def test_config_requires_secure_secret_and_postgres():
    from fastapi_app.settings import Settings

    with pytest.raises(ValueError):
        Settings(database_url="sqlite:///bad", jwt_secret_key="short", _env_file=None)
