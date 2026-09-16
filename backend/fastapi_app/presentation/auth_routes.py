import secrets
from fastapi import APIRouter, Depends, Request, Response
from . import schemas as s
from .dependencies import actor, auth_service, uow
from ..modules.auth.application.service import public_user
from ..shared.domain.rules import DomainError, require

router = APIRouter(prefix="/api", tags=["Autenticación y usuarios"])


@router.post("/auth/login")
def login(
    data: s.Login, request: Request, response: Response, service=Depends(auth_service)
):
    request.app.state.login_limiter.check(
        request.client.host if request.client else "unknown"
    )
    user, (access, refresh) = service.login(data.username, data.password)
    secure = request.app.state.settings.environment == "production"
    csrf = secrets.token_urlsafe(32)
    response.set_cookie(
        "refresh_token_cookie",
        refresh,
        httponly=True,
        secure=secure,
        samesite="strict",
        path="/api/auth",
        max_age=request.app.state.settings.jwt_refresh_hours * 3600,
    )
    response.set_cookie(
        "csrf_refresh_token",
        csrf,
        httponly=False,
        secure=secure,
        samesite="strict",
        path="/",
        max_age=request.app.state.settings.jwt_refresh_hours * 3600,
    )
    return {"user": user, "access_token": access}


@router.get("/auth/me")
def me(user=Depends(actor)):
    return public_user(user)


@router.post("/auth/logout")
def logout(response: Response, user=Depends(actor), service=Depends(auth_service)):
    service.logout(user)
    response.delete_cookie("refresh_token_cookie", path="/api/auth")
    response.delete_cookie("csrf_refresh_token", path="/")
    return {"message": "Sesión cerrada correctamente."}


@router.post("/auth/refresh")
def refresh(request: Request, service=Depends(auth_service)):
    csrf = request.cookies.get("csrf_refresh_token")
    supplied = request.headers.get("X-CSRF-TOKEN", "")
    if not csrf or not secrets.compare_digest(csrf, supplied):
        raise DomainError(
            "CSRF_REQUIRED", "La solicitud de renovación no es válida.", 403
        )
    user = service.authenticate_token(
        request.cookies.get("refresh_token_cookie", ""), "refresh"
    )
    access, _ = service.security.tokens(user)
    return {"access_token": access}


@router.post("/auth/change-password")
def change_password(
    data: s.PasswordChange,
    response: Response,
    user=Depends(actor),
    service=Depends(auth_service),
):
    service.change_password(user, data.current_password, data.new_password)
    response.delete_cookie("refresh_token_cookie", path="/api/auth")
    response.delete_cookie("csrf_refresh_token", path="/")
    return {"message": "Contraseña actualizada. Inicia sesión nuevamente."}


@router.post("/auth/password-reset/request")
def reset_request(
    data: s.ResetRequest, request: Request, service=Depends(auth_service)
):
    request.app.state.login_limiter.check(
        "reset:" + (request.client.host if request.client else "unknown")
    )
    if not request.app.state.settings.smtp_host:
        raise DomainError(
            "EMAIL_UNAVAILABLE", "El servicio de correo no está configurado.", 503
        )
    service.request_reset(data.email)
    return {"message": "Si los datos son válidos, recibirá instrucciones por correo."}


@router.post("/auth/password-reset/confirm")
def reset_confirm(
    data: s.ResetConfirm, request: Request, service=Depends(auth_service)
):
    request.app.state.login_limiter.check(
        "confirm:" + (request.client.host if request.client else "unknown")
    )
    service.reset_password(data.token, data.new_password)
    return {"message": "Contraseña restablecida correctamente."}


@router.get("/users")
def users(user=Depends(actor), service=Depends(auth_service)):
    return service.users(user)


@router.post("/users", status_code=201)
def create_user(data: s.UserCreate, user=Depends(actor), service=Depends(auth_service)):
    return service.create_user(user, data.model_dump())


@router.get("/users/{identity}")
def get_user(identity: int, user=Depends(actor), work=Depends(uow)):
    require(user, "user.view")
    return public_user(work.auth.user(identity))


@router.patch("/users/{identity}")
def update_user(
    identity: int,
    data: s.UserUpdate,
    user=Depends(actor),
    service=Depends(auth_service),
):
    return service.update_user(user, identity, data.model_dump(exclude_unset=True))


@router.post("/users/{identity}/activate")
def activate_user(identity: int, user=Depends(actor), service=Depends(auth_service)):
    return service.update_user(user, identity, {"is_active": True})


@router.post("/users/{identity}/deactivate")
def deactivate_user(identity: int, user=Depends(actor), service=Depends(auth_service)):
    return service.update_user(user, identity, {"is_active": False})


@router.post("/users/{identity}/roles")
def assign_role(
    identity: int,
    data: s.RoleAssign,
    user=Depends(actor),
    service=Depends(auth_service),
):
    return service.assign_role(user, identity, data.role)


@router.delete("/users/{identity}/roles/{role_id}")
def remove_role(
    identity: int, role_id: int, user=Depends(actor), service=Depends(auth_service)
):
    return service.assign_role(user, identity, remove_id=role_id)


@router.get("/roles")
def roles(user=Depends(actor), work=Depends(uow)):
    require(user, "role.view")
    return work.auth.roles()


@router.get("/roles/permissions")
def permissions(user=Depends(actor), work=Depends(uow)):
    require(user, "role.view")
    return work.auth.permissions()


@router.get("/roles/{identity}")
def role(identity: int, user=Depends(actor), work=Depends(uow)):
    require(user, "role.view")
    return work.auth.role(identity)


@router.patch("/roles/{identity}")
def update_role(
    identity: int,
    data: s.RoleUpdate,
    user=Depends(actor),
    service=Depends(auth_service),
):
    return service.update_role(user, identity, data.model_dump(exclude_unset=True))


@router.get("/audit")
def events(action: str | None = None, user=Depends(actor), work=Depends(uow)):
    require(user, "audit.view")
    return work.auth.events(action)
