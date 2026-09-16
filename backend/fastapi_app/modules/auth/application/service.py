from datetime import timedelta, timezone
from ....shared.application.ports import UnitOfWork, Security
from ....shared.domain.rules import (
    DomainError,
    now,
    require,
    text,
    email_address,
)

PUBLIC_USER_FIELDS = (
    "id",
    "username",
    "email",
    "first_name",
    "last_name",
    "is_active",
    "must_change_password",
    "roles",
    "effective_permissions",
    "created_at",
    "updated_at",
)


def public_user(user):
    return {key: user[key] for key in PUBLIC_USER_FIELDS if key in user}


class AuthService:
    def __init__(self, uow: UnitOfWork, security: Security, reset_minutes=30):
        self.uow, self.security, self.reset_minutes = uow, security, reset_minutes

    def authenticate_token(self, token, kind="access"):
        claims = self.security.decode(token, kind)
        try:
            user = self.uow.auth.user(claims["user_id"])
        except DomainError:
            raise DomainError("INVALID_TOKEN", "La sesión no es válida.", 401)
        if (
            not user["is_active"]
            or claims.get("token_version") != user["token_version"]
        ):
            raise DomainError("INVALID_TOKEN", "La sesión no es válida.", 401)
        return user

    def login(self, username, password):
        raw_id = username.strip()
        user = self.uow.auth.find_user(username=raw_id) or self.uow.auth.find_user(email=raw_id.lower())
        valid = self.security.verify(user["password_hash"] if user else None, password)
        if not user or not valid or not user["is_active"]:
            raise DomainError("INVALID_CREDENTIALS", "Credenciales inválidas.", 401)
        self.uow.auth.audit("LOGIN", user["id"])
        tokens = self.security.tokens(user)
        self.uow.commit()
        return public_user(user), tokens

    def logout(self, actor):
        actor = self.uow.auth.user(actor["id"], lock=True)
        self.uow.auth.save_user(
            {"token_version": actor["token_version"] + 1}, actor["id"]
        )
        self.uow.auth.audit("LOGOUT", actor["id"])
        self.uow.commit()

    def change_password(self, actor, current_password, new_password):
        actor = self.uow.auth.user(actor["id"], lock=True)
        if not self.security.verify(actor["password_hash"], current_password):
            raise DomainError(
                "INVALID_PASSWORD", "La contraseña actual no es válida.", 400
            )
        self._set_password(actor, new_password, "PASSWORD_CHANGED")

    def _set_password(self, user, value, action):
        user = self.uow.auth.user(user["id"], lock=True)
        hashed = self.security.hash_password(value)
        self.uow.auth.save_user(
            {
                "password_hash": hashed,
                "token_version": user["token_version"] + 1,
                "must_change_password": False,
                "reset_token_hash": None,
                "reset_token_expires_at": None,
            },
            user["id"],
        )
        self.uow.auth.audit(action, user["id"], user["id"])
        self.uow.commit()

    def request_reset(self, email):
        user = self.uow.auth.find_user(email=email.strip().lower())
        if not user or not user["is_active"]:
            return
        raw = self.security.reset_token()
        self.security.send_reset(user["email"], raw)
        self.uow.auth.save_user(
            {
                "reset_token_hash": self.security.hash_token(raw),
                "reset_token_expires_at": now() + timedelta(minutes=self.reset_minutes),
            },
            user["id"],
        )
        self.uow.commit()

    def reset_password(self, token, password):
        user = self.uow.auth.find_user(
            lock=True, reset_token_hash=self.security.hash_token(token)
        )
        expiry = user["reset_token_expires_at"] if user else None
        if expiry and expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=timezone.utc)
        if not user or not user["is_active"] or not expiry or expiry <= now():
            raise DomainError(
                "INVALID_RESET_TOKEN", "El token no es válido o ha expirado.", 400
            )
        self._set_password(user, password, "PASSWORD_RESET")

    def users(self, actor):
        require(actor, "user.view")
        return [public_user(user) for user in self.uow.auth.users()]

    def create_user(self, actor, data):
        require(actor, "user.create")
        data = dict(data)
        if data.get("roles"):
            require(actor, "role.assign")
        data["username"] = text(data["username"], 80)
        data["email"] = email_address(data["email"])
        data["first_name"] = text(data["first_name"], 100)
        data["last_name"] = text(data["last_name"], 100)
        data["password_hash"] = self.security.hash_password(data.pop("password"))
        user = self.uow.auth.save_user(data)
        self.uow.auth.audit("USER_CREATED", actor["id"], user["id"])
        self.uow.commit()
        return public_user(user)

    def update_user(self, actor, user_id, data):
        require(actor, "user.update")
        self.uow.auth.lock_administration()
        user = self.uow.auth.user(user_id, lock=True)
        data = dict(data)
        for field in ("first_name", "last_name", "email"):
            if field in data:
                data[field] = text(data[field], 255 if field == "email" else 100)
        if "email" in data:
            data["email"] = email_address(data["email"])
        if "roles" in data:
            if "ADMINISTRADOR" in user["roles"] and "ADMINISTRADOR" not in data["roles"]:
                self._protect_last_admin(user)
        if data.get("is_active") is False and user["is_active"]:
            self._protect_last_admin(user)
            data["token_version"] = user["token_version"] + 1
        result = self.uow.auth.save_user(data, user_id)
        self.uow.auth.audit("USER_UPDATED", actor["id"], user_id)
        self.uow.commit()
        return public_user(result)


    def _protect_last_admin(self, user):
        if "ADMINISTRADOR" in user["roles"]:
            others = [
                x
                for x in self.uow.auth.users()
                if x["id"] != user["id"]
                and x["is_active"]
                and "ADMINISTRADOR" in x["roles"]
            ]
            if not others:
                raise DomainError(
                    "LAST_ADMIN",
                    "Debe conservarse al menos un administrador activo.",
                    409,
                )

    def assign_role(self, actor, user_id, role_name=None, remove_id=None):
        require(actor, "role.assign")
        self.uow.auth.lock_administration()
        user = self.uow.auth.user(user_id, lock=True)
        roles = list(user["roles"])
        if remove_id:
            name = self.uow.auth.role(remove_id)["name"]
            if name == "ADMINISTRADOR":
                self._protect_last_admin(user)
            roles = [role for role in roles if role != name]
        elif role_name not in roles:
            roles.append(role_name)
        updated = self.uow.auth.save_user(
            {"roles": roles, "token_version": user["token_version"] + 1}, user_id
        )
        self.uow.auth.audit(
            "ROLE_REMOVED" if remove_id else "ROLE_ASSIGNED", actor["id"], user_id
        )
        self.uow.commit()
        return public_user(updated)

    def update_role(self, actor, role_id, data):
        require(actor, "role.update")
        role = self.uow.auth.role(role_id)
        if role["name"] == "ADMINISTRADOR" and (
            "name" in data or "permissions" in data
        ):
            raise DomainError(
                "PROTECTED_ROLE",
                "El rol administrador conserva su nombre y permisos.",
                409,
            )
        result = self.uow.auth.save_role(data, role_id)
        self.uow.auth.audit("ROLE_UPDATED", actor["id"], details={"role_id": role_id})
        self.uow.commit()
        return result
