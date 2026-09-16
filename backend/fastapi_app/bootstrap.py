import logging
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from threading import Lock
from time import monotonic
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse, Response
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from starlette.exceptions import HTTPException
from .settings import Settings
from .infrastructure.database import session_factory
from .infrastructure.security import SecurityAdapter
from .infrastructure.images import ImageStorage
from .infrastructure.repositories import SqlUnitOfWork
from .shared.domain.rules import DomainError
from .presentation import (
    auth_routes,
    catalog_routes,
    orders_routes,
    kitchen_routes,
    inventory_routes,
    cash_routes,
    expenses_routes,
    analytics_routes,
    settings_routes,
)


class LoginLimiter:
    def __init__(self):
        self.entries = defaultdict(deque)
        self.lock = Lock()

    def check(self, key):
        with self.lock:
            current = monotonic()
            # Bound retained addresses and evict expired windows.
            for address in list(self.entries):
                if (
                    not self.entries[address]
                    or self.entries[address][-1] < current - 60
                ):
                    del self.entries[address]
            values = self.entries[key]
            while values and values[0] < current - 60:
                values.popleft()
            if len(values) >= 20 or len(self.entries) > 10000:
                raise DomainError(
                    "RATE_LIMITED", "Demasiados intentos. Espera un minuto.", 429
                )
            values.append(current)


def create_app(settings=None):
    settings = settings or Settings()
    engine, sessions = session_factory(settings.database_url)

    @asynccontextmanager
    async def lifespan(app):
        yield
        engine.dispose()

    app = FastAPI(title=settings.app_name, version="2.0.0", lifespan=lifespan)
    app.state.settings = settings
    app.state.engine = engine
    app.state.sessions = sessions
    app.state.security = SecurityAdapter(settings)
    app.state.images = ImageStorage(
        settings.catalog_media_root, settings.catalog_image_max_bytes
    )
    app.state.login_limiter = LoginLimiter()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type", "X-CSRF-TOKEN"],
    )

    def error(code, message, status):
        return JSONResponse(
            {"status_code": status, "code": code, "message": message},
            status_code=status,
        )

    @app.exception_handler(DomainError)
    async def domain_error(request: Request, exc: DomainError):
        if exc.status == 403:
            work = SqlUnitOfWork(sessions())
            try:
                work.auth.audit(
                    "ACCESS_DENIED",
                    getattr(request.state, "actor_id", None),
                    details={"path": request.url.path},
                )
                work.commit()
            except Exception:
                work.rollback()
                logging.getLogger(__name__).error(
                    "No se pudo registrar un rechazo de acceso."
                )
            finally:
                work.close()
        return error(exc.code, exc.message, exc.status)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request, exc):
        return error(
            "VALIDATION_ERROR",
            "Revisa los campos, tipos y límites de la solicitud.",
            422,
        )

    @app.exception_handler(IntegrityError)
    async def integrity_error(request, exc):
        return error(
            "CONFLICT",
            "El registro está duplicado o entra en conflicto con datos existentes.",
            409,
        )

    @app.exception_handler(SQLAlchemyError)
    async def database_error(request, exc):
        logging.getLogger(__name__).error(
            "Falló una operación de persistencia (%s).", type(exc).__name__
        )
        return error(
            "PERSISTENCE_UNAVAILABLE",
            "No se pudo guardar o consultar la información. Intenta nuevamente.",
            503,
        )

    @app.exception_handler(HTTPException)
    async def http_error(request, exc):
        return error(
            "HTTP_ERROR", "La solicitud no se pudo completar.", exc.status_code
        )

    @app.exception_handler(Exception)
    async def unexpected_error(request, exc):
        logging.getLogger(__name__).exception("Falló la operación: %s", exc)
        return error("INTERNAL_ERROR", "No se pudo completar la operación.", 500)

    @app.get("/health")
    @app.get("/api/health")
    def health():
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return {"status": "ok", "framework": "fastapi"}

    @app.get("/media/products/{filename}")
    def media(filename: str):
        if filename == "default.svg":
            return Response(
                '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#edf2f7"/><text x="300" y="210" text-anchor="middle" font-size="42" fill="#174d8c">POTOQUITOS</text></svg>',
                media_type="image/svg+xml",
            )
        root = settings.catalog_media_root.resolve()
        target = (root / filename).resolve()
        if (
            target.parent != root
            or not target.is_file()
            or target.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}
        ):
            raise DomainError("NOT_FOUND", "La imagen no existe.", 404)
        return FileResponse(target, headers={"X-Content-Type-Options": "nosniff"})

    app.include_router(auth_routes.router)
    app.include_router(catalog_routes.router)
    app.include_router(orders_routes.router)
    app.include_router(kitchen_routes.router)
    app.include_router(inventory_routes.router)
    app.include_router(cash_routes.router)
    app.include_router(expenses_routes.router)
    app.include_router(analytics_routes.router)
    app.include_router(settings_routes.router)
    return app
