from fastapi import APIRouter, Depends
from .dependencies import get_current_user, get_uow
from ..shared.domain.rules import require

router = APIRouter(prefix="/api/kitchen", tags=["kitchen"])


@router.get("/queue")
@router.get("/orders")
def get_kitchen_queue(user=Depends(get_current_user), uow=Depends(get_uow)):
    require(user, "kitchen.view")
    return uow.kitchen.queue()


@router.post("/orders/{order_id}/start")
@router.post("/orders/{order_id}/prepare")
def start_preparation(order_id: int, user=Depends(get_current_user), uow=Depends(get_uow)):
    require(user, "kitchen.advance")
    result = uow.kitchen.update_state(order_id, "EN_PREPARACION", user["id"])
    uow.commit()
    return result


@router.post("/orders/{order_id}/ready")
def mark_as_ready(order_id: int, user=Depends(get_current_user), uow=Depends(get_uow)):
    require(user, "kitchen.advance")
    result = uow.kitchen.update_state(order_id, "LISTO", user["id"])
    uow.commit()
    return result


@router.post("/orders/{order_id}/deliver")
def mark_as_delivered(order_id: int, user=Depends(get_current_user), uow=Depends(get_uow)):
    require(user, "kitchen.advance")
    result = uow.kitchen.update_state(order_id, "ENTREGADO", user["id"])
    uow.commit()
    return result

