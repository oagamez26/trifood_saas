from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
import re


@dataclass
class DomainError(Exception):
    code: str
    message: str
    status: int = 422


def now():
    return datetime.now(timezone.utc)


def money(value):
    try:
        if isinstance(value, bool):
            raise InvalidOperation()
        amount = Decimal(str(value))
        if (
            not amount.is_finite()
            or amount < 0
            or amount > Decimal("9999999999.99")
            or amount != amount.quantize(Decimal(".01"))
        ):
            raise InvalidOperation()
        return amount.quantize(Decimal(".01"))
    except (InvalidOperation, ValueError, TypeError):
        raise DomainError(
            "INVALID_PRICE",
            "El precio debe ser positivo o cero y tener máximo dos decimales.",
        )


def positive_integer(value, optional=False):
    if optional and value is None:
        return None
    if type(value) is not int or value <= 0:
        raise DomainError(
            "INVALID_QUANTITY", "La cantidad debe ser un entero positivo."
        )
    return value


def text(value, limit=160):
    if not isinstance(value, str) or not value.strip() or len(value.strip()) > limit:
        raise DomainError(
            "INVALID_TEXT", f"Introduce un texto de 1 a {limit} caracteres."
        )
    return value.strip()


def password_policy(value):
    if (
        not isinstance(value, str)
        or len(value) < 8
        or len(value) > 128
        or not any(c.isalpha() for c in value)
        or not any(c.isdigit() for c in value)
    ):
        raise DomainError(
            "INVALID_PASSWORD",
            "La contraseña debe tener entre 8 y 128 caracteres, letras y números.",
        )


def email_address(value):
    value = text(value, 255).lower()
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
        raise DomainError("INVALID_EMAIL", "Introduce un correo válido.")
    return value


def require(actor, permission):
    if not actor or not actor.get("is_active"):
        raise DomainError("AUTHENTICATION_REQUIRED", "La sesión no es válida.", 401)
    if actor.get("must_change_password"):
        raise DomainError(
            "PASSWORD_CHANGE_REQUIRED",
            "Debes cambiar tu contraseña para continuar.",
            403,
        )
    if permission not in actor["effective_permissions"]:
        raise DomainError(
            "PERMISSION_DENIED", "No tienes permiso para esta operación.", 403
        )


TRANSITIONS = {
    "BORRADOR": {"CONFIRMADO", "CANCELADO"},
    "CONFIRMADO": {"EN_COCINA", "EN_PREPARACION", "CANCELADO"},
    "EN_COCINA": {"EN_PREPARACION", "CANCELADO"},
    "EN_PREPARACION": {"LISTO", "CANCELADO"},
    "LISTO": {"ENTREGADO", "CANCELADO"},
    "ENTREGADO": set(),
    "CANCELADO": set(),
}


def transition(current, target):
    if target == "ENTREGADO" and current != "LISTO":
        raise DomainError(
            "ORDER_NOT_READY_FOR_DELIVERY",
            "El pedido no está listo para entrega. Debe estar en estado LISTO.",
            409,
        )
    if target not in TRANSITIONS.get(current, set()):
        raise DomainError(
            "INVALID_ORDER_TRANSITION",
            "El pedido no permite ese cambio de estado.",
            409,
        )
