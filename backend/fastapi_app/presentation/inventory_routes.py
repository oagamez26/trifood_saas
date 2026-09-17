from typing import List, Optional
from decimal import Decimal
from fastapi import APIRouter, Depends, Query, Body
from pydantic import BaseModel
from .dependencies import get_current_user, get_uow
from ..shared.domain.rules import require

router = APIRouter(prefix="/api/inventory", tags=["inventory"])


class IngredientIn(BaseModel):
    name: str
    base_unit: str
    stock: float = 0
    min_stock: float = 0
    reference_cost: float = 0
    description: Optional[str] = None
    is_active: bool = True


class MovementIn(BaseModel):
    ingredient_id: int
    movement_type: str  # ENTRADA_MANUAL, MERMA, AJUSTE_POSITIVO, AJUSTE_NEGATIVO, REVERSION
    quantity: float
    reference: Optional[str] = None


class RecipeItemIn(BaseModel):
    ingredient_id: int
    quantity: float
    unit: str = "g"


class RecipeIn(BaseModel):
    items: List[RecipeItemIn]
    notes: Optional[str] = None


@router.get("/ingredients")
def list_ingredients(
    active_only: bool = False,
    search: Optional[str] = None,
    stock_status: Optional[str] = None,
    base_unit: Optional[str] = None,
    user=Depends(get_current_user),
    uow=Depends(get_uow),
):
    require(user, "inventory.view")
    return uow.inventory.ingredients(
        active_only=active_only,
        search=search,
        stock_status=stock_status,
        base_unit=base_unit,
    )


@router.post("/ingredients")
def create_ingredient(data: IngredientIn, user=Depends(get_current_user), uow=Depends(get_uow)):
    require(user, "inventory.adjust")
    init_stock = data.stock
    data_dict = data.model_dump()
    data_dict["stock"] = 0
    res = uow.inventory.save_ingredient(data_dict)
    if init_stock > 0:
        uow.inventory.add_movement(
            ingredient_id=res["id"],
            movement_type="ENTRADA_MANUAL",
            quantity=init_stock,
            responsible_id=user["id"],
            reference="Inventario inicial",
        )
    uow.commit()
    return uow.inventory.ingredient(res["id"])


class IngredientUpdate(BaseModel):
    name: Optional[str] = None
    base_unit: Optional[str] = None
    min_stock: Optional[float] = None
    reference_cost: Optional[float] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


@router.put("/ingredients/{ingredient_id}")
@router.patch("/ingredients/{ingredient_id}")
def update_ingredient(ingredient_id: int, data: IngredientUpdate, user=Depends(get_current_user), uow=Depends(get_uow)):
    require(user, "inventory.adjust")
    data_dict = data.model_dump(exclude_unset=True)
    res = uow.inventory.save_ingredient(data_dict, ingredient_id=ingredient_id)
    uow.commit()
    return res


@router.get("/movements")
def list_movements(ingredient_id: Optional[int] = None, user=Depends(get_current_user), uow=Depends(get_uow)):
    require(user, "inventory.view")
    return uow.inventory.movements(ingredient_id=ingredient_id)


@router.post("/movements")
def register_movement(data: MovementIn, user=Depends(get_current_user), uow=Depends(get_uow)):
    require(user, "inventory.adjust")
    res = uow.inventory.add_movement(
        ingredient_id=data.ingredient_id,
        movement_type=data.movement_type,
        quantity=data.quantity,
        responsible_id=user["id"],
        reference=data.reference,
    )
    uow.commit()
    return res


@router.get("/kardex")
def get_kardex(
    ingredient_id: Optional[int] = None,
    movement_type: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    search: Optional[str] = None,
    user=Depends(get_current_user),
    uow=Depends(get_uow),
):
    require(user, "inventory.view")
    from datetime import datetime, time as d_time, timezone
    f_dt = None
    t_dt = None
    if from_date:
        try:
            d = datetime.strptime(from_date, "%Y-%m-%d").date()
            f_dt = datetime.combine(d, d_time.min, tzinfo=timezone.utc)
        except ValueError:
            pass
    if to_date:
        try:
            d = datetime.strptime(to_date, "%Y-%m-%d").date()
            t_dt = datetime.combine(d, d_time.max, tzinfo=timezone.utc)
        except ValueError:
            pass

    return uow.inventory.kardex(
        ingredient_id=ingredient_id,
        movement_type=movement_type,
        from_date=f_dt,
        to_date=t_dt,
        search=search,
    )


@router.get("/recipes")
def list_all_recipes(user=Depends(get_current_user), uow=Depends(get_uow)):
    require(user, "recipe.view")
    return uow.recipes.all_recipes()


@router.get("/recipes/{product_id}")
def get_recipe(product_id: int, user=Depends(get_current_user), uow=Depends(get_uow)):
    require(user, "recipe.view")
    res = uow.recipes.recipe_for_product(product_id)
    return res or {"product_id": product_id, "items": [], "notes": None}


@router.put("/recipes/{product_id}")
def save_recipe(product_id: int, data: RecipeIn, user=Depends(get_current_user), uow=Depends(get_uow)):
    require(user, "recipe.update")
    items_dict = [it.model_dump() for it in data.items]
    res = uow.recipes.save_recipe(product_id, items_dict, notes=data.notes)
    uow.commit()
    return res


@router.get("/recipes/{product_id}/capacity")
def get_recipe_capacity(product_id: int, user=Depends(get_current_user), uow=Depends(get_uow)):
    require(user, "recipe.view")
    return uow.recipes.calculate_capacity(product_id)
