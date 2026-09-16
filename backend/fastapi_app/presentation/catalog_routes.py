from typing import Literal
from fastapi import APIRouter, Depends, Query, Request, Response, UploadFile, File
from .dependencies import actor, catalog_service, uow
from . import schemas as s
from ..shared.domain.rules import require

router = APIRouter(prefix="/api", tags=["Catálogo"])


@router.get("/public/menu", response_model=s.PublicMenu)
def menu(response: Response, service=Depends(catalog_service)):
    response.headers["Cache-Control"] = "no-store"
    return service.public_menu()


@router.get("/catalog/categories")
def categories(user=Depends(actor), service=Depends(catalog_service)):
    return service.categories(user)


@router.post("/catalog/categories", status_code=201)
def create_category(
    data: s.CategoryCreate, user=Depends(actor), service=Depends(catalog_service)
):
    return service.save_category(user, data.model_dump())


@router.get("/catalog/categories/{identity}")
def category(identity: int, user=Depends(actor), service=Depends(catalog_service)):
    return service.category(user, identity)


@router.patch("/catalog/categories/{identity}")
def update_category(
    identity: int,
    data: s.CategoryUpdate,
    user=Depends(actor),
    service=Depends(catalog_service),
):
    return service.save_category(user, data.model_dump(exclude_unset=True), identity)


@router.post("/catalog/categories/{identity}/{action}")
def category_state(
    identity: int,
    action: Literal["activate", "deactivate"],
    user=Depends(actor),
    service=Depends(catalog_service),
):
    return service.save_category(user, {}, identity, action)


@router.get("/catalog/products")
def products(
    q: str = "",
    search: str = "",
    category_id: int | None = None,
    is_active: bool | None = None,
    is_available: bool | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    sort: Literal["name", "internal_code", "current_price", "updated_at"] = "name",
    direction: Literal["asc", "desc"] = "asc",
    user=Depends(actor),
    service=Depends(catalog_service),
):
    return service.products(
        user,
        q=q or search,
        category_id=category_id,
        is_active=is_active,
        is_available=is_available,
        page=page,
        page_size=page_size,
        sort=sort,
        direction=direction,
    )


@router.post("/catalog/products", status_code=201)
def create_product(
    data: s.ProductCreate, user=Depends(actor), service=Depends(catalog_service)
):
    return service.save_product(user, data.model_dump())


@router.get("/catalog/products/{identity}")
def product(identity: int, user=Depends(actor), service=Depends(catalog_service)):
    return service.product(user, identity)


@router.patch("/catalog/products/{identity}")
def update_product(
    identity: int,
    data: s.ProductUpdate,
    user=Depends(actor),
    service=Depends(catalog_service),
):
    return service.save_product(user, data.model_dump(exclude_unset=True), identity)


@router.post("/catalog/products/{identity}/availability")
def availability(
    identity: int,
    data: s.Availability,
    user=Depends(actor),
    service=Depends(catalog_service),
):
    return service.state(user, identity, "availability", data.is_available)


@router.post("/catalog/products/{identity}/price")
@router.post("/catalog/prices/{identity}", include_in_schema=False)
def price(
    identity: int,
    data: s.PriceChange,
    user=Depends(actor),
    service=Depends(catalog_service),
):
    return service.price(
        user, identity, data.current_price, data.expected_price_version
    )


@router.get("/catalog/products/{identity}/price-history")
@router.get("/catalog/prices/{identity}", include_in_schema=False)
def history(
    identity: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    user=Depends(actor),
    service=Depends(catalog_service),
):
    return service.history(user, identity, page, page_size)


@router.post("/catalog/products/{identity}/image")
def image(
    identity: int,
    request: Request,
    image: UploadFile = File(...),
    user=Depends(actor),
    service=Depends(catalog_service),
):
    require(user, "product.update")
    content = image.file.read(request.app.state.settings.catalog_image_max_bytes + 1)
    return service.image(user, identity, content)


@router.delete("/catalog/products/{identity}/image")
def delete_image(
    identity: int,
    user=Depends(actor),
    service=Depends(catalog_service),
):
    require(user, "product.update")
    return service.image(user, identity, None)


@router.post("/catalog/products/{identity}/{action}")

def product_state(
    identity: int,
    action: Literal["activate", "deactivate"],
    user=Depends(actor),
    service=Depends(catalog_service),
):
    return service.state(user, identity, action)


@router.get("/catalog/audit")
def audit(user=Depends(actor), work=Depends(uow)):
    require(user, "audit.view")
    return work.catalog.events()
