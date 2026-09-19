from typing import Literal
from fastapi import APIRouter, Depends
from .dependencies import actor, orders_service, uow
from . import schemas as s
from ..shared.domain.rules import require

router = APIRouter(prefix="/api/tables-orders", tags=["Mesas y pedidos"])


@router.get("/menu-items")
def menu_items(user=Depends(actor), work=Depends(uow)):
    require(user, "order.create")
    products = work.catalog.products(public=True)["items"]
    return [
        {
            "id": p["id"],
            "internal_code": p.get("internal_code", ""),
            "name": p["name"],
            "description": p.get("description", ""),
            "category_id": p.get("category_id"),
            "category_name": p.get("category_name", "") or (p.get("category") or {}).get("name", ""),
            "current_price": str(p["current_price"]),
            "is_available": p.get("is_available", True),
            "image_reference": p.get("image_reference", ""),
        }
        for p in products
    ]


@router.get("/tables")

def tables(user=Depends(actor), service=Depends(orders_service)):
    return service.tables(user)


@router.post("/tables", status_code=201)
def create_table(
    data: s.TableCreate, user=Depends(actor), service=Depends(orders_service)
):
    return service.create_table(user, data.number, data.capacity)


@router.patch("/tables/{identity}")
@router.put("/tables/{identity}")
def update_table(
    identity: int,
    data: s.TableUpdate,
    user=Depends(actor),
    service=Depends(orders_service),
):
    return service.update_table(user, identity, data.model_dump(exclude_unset=True))


@router.delete("/tables/{identity}")
def delete_table(identity: int, user=Depends(actor), service=Depends(orders_service)):
    return service.delete_table(user, identity)


@router.post("/tables/{identity}/open", status_code=201)
def open_table(
    identity: int,
    data: s.TableOpen,
    user=Depends(actor),
    service=Depends(orders_service),
):
    return service.open_table(user, identity, data.people_count)


@router.post("/tables/{identity}/close")
def close_table(identity: int, user=Depends(actor), service=Depends(orders_service)):
    return service.close_table(user, identity)


@router.post("/tables/{identity}/request-account")
def request_account(identity: int, user=Depends(actor), service=Depends(orders_service)):
    return service.request_account(user, identity)


@router.post("/orders/{identity}/request-account")
def request_account_by_order(identity: int, user=Depends(actor), service=Depends(orders_service)):
    order = service.get_order(user, identity)
    sess = service.uow.orders.get_session(order["table_session_id"])
    return service.request_account(user, sess["table_id"])


@router.get("/orders")
def orders(
    table_session_id: int | None = None,
    user=Depends(actor),
    service=Depends(orders_service),
):
    return service.list_orders(user, table_session_id)


@router.post("/orders", status_code=201)
def create_order(
    data: s.OrderCreate, user=Depends(actor), service=Depends(orders_service)
):
    return service.create_order(
        user, data.table_session_id, [line.model_dump() for line in data.lines]
    )


@router.get("/orders/{identity}")
def order(identity: int, user=Depends(actor), service=Depends(orders_service)):
    return service.get_order(user, identity)


@router.patch("/orders/{identity}")
def update_order(
    identity: int,
    data: s.OrderUpdate,
    user=Depends(actor),
    service=Depends(orders_service),
):
    return service.update_draft(
        user, identity, [line.model_dump() for line in data.lines]
    )


@router.post("/orders/{identity}/cancel")
def cancel(
    identity: int,
    data: s.Cancellation,
    user=Depends(actor),
    service=Depends(orders_service),
):
    return service.change_state(user, identity, "CANCELADO", data.reason)


@router.post("/orders/{identity}/{action}")
def state(
    identity: int,
    action: Literal["confirm", "send-kitchen", "prepare", "ready", "deliver"],
    user=Depends(actor),
    service=Depends(orders_service),
):
    target = {
        "confirm": "CONFIRMADO",
        "send-kitchen": "EN_COCINA",
        "prepare": "EN_PREPARACION",
        "ready": "LISTO",
        "deliver": "ENTREGADO",
    }[action]
    return service.change_state(user, identity, target)
