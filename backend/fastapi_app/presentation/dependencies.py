from fastapi import Depends, Request
from ..infrastructure.repositories import SqlUnitOfWork
from ..modules.auth.application.service import AuthService
from ..modules.catalog.application.service import CatalogService
from ..modules.orders.application.service import OrdersService
from ..shared.domain.rules import DomainError


def uow(request: Request):
    value = SqlUnitOfWork(request.app.state.sessions())
    request.state.uow = value
    try:
        yield value
    finally:
        value.rollback()
        value.close()


def auth_service(request: Request, work=Depends(uow)):
    return AuthService(
        work,
        request.app.state.security,
        request.app.state.settings.password_reset_minutes,
    )


def catalog_service(request: Request, work=Depends(uow)):
    return CatalogService(work, request.app.state.images)


def orders_service(work=Depends(uow)):
    return OrdersService(work)


def actor(request: Request, service=Depends(auth_service)):
    authorization = request.headers.get("Authorization", "")
    if not authorization.startswith("Bearer "):
        raise DomainError(
            "AUTHENTICATION_REQUIRED", "La autenticación es requerida.", 401
        )
    value = service.authenticate_token(authorization[7:])
    request.state.actor_id = value["id"]
    return value


get_current_user = actor
get_uow = uow
