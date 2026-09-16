import hashlib
import secrets
import smtplib
from datetime import timedelta
from email.message import EmailMessage
from jose import jwt, JWTError
from werkzeug.security import generate_password_hash, check_password_hash
from ..shared.domain.rules import DomainError, now, password_policy


class SecurityAdapter:
    def __init__(self, settings):
        self.settings = settings
        self.dummy_hash = generate_password_hash(secrets.token_urlsafe(32))

    def hash_password(self, value):
        password_policy(value)
        return generate_password_hash(value)

    def verify(self, hashed, value):
        try:
            return check_password_hash(hashed or self.dummy_hash, value)
        except (ValueError, TypeError):
            return False

    def tokens(self, user):
        def issue(kind, duration):
            return jwt.encode(
                {
                    "sub": str(user["id"]),
                    "type": kind,
                    "token_version": user["token_version"],
                    "iat": now(),
                    "exp": now() + duration,
                    "jti": secrets.token_urlsafe(16),
                },
                self.settings.jwt_secret_key.get_secret_value(),
                algorithm="HS256",
            )

        return issue(
            "access", timedelta(minutes=self.settings.access_token_minutes)
        ), issue("refresh", timedelta(hours=self.settings.jwt_refresh_hours))

    def decode(self, token, kind):
        try:
            data = jwt.decode(
                token,
                self.settings.jwt_secret_key.get_secret_value(),
                algorithms=["HS256"],
                options={"require_exp": True, "require_sub": True},
            )
            if data.get("type") != kind:
                raise ValueError()
            data["user_id"] = int(data["sub"])
            return data
        except (JWTError, ValueError, TypeError, KeyError):
            raise DomainError("INVALID_TOKEN", "La sesión no es válida.", 401)

    def reset_token(self):
        return secrets.token_urlsafe(32)

    def hash_token(self, token):
        return hashlib.sha256(token.encode()).hexdigest()

    def send_reset(self, recipient, token):
        if not self.settings.smtp_host:
            raise DomainError(
                "EMAIL_UNAVAILABLE", "El servicio de correo no está configurado.", 503
            )
        message = EmailMessage()
        message["Subject"] = "Restablecimiento de contraseña POTOQUITOS"
        message["From"] = self.settings.smtp_from
        message["To"] = recipient
        message.set_content(
            f"Token de un solo uso para restablecer tu contraseña: {token}"
        )
        try:
            with smtplib.SMTP(
                self.settings.smtp_host, self.settings.smtp_port, timeout=15
            ) as server:
                server.starttls()
                if self.settings.smtp_username:
                    server.login(
                        self.settings.smtp_username,
                        self.settings.smtp_password.get_secret_value(),
                    )
                server.send_message(message)
        except (OSError, smtplib.SMTPException):
            raise DomainError(
                "EMAIL_UNAVAILABLE",
                "No se pudo enviar el correo. Intenta más tarde.",
                503,
            )
