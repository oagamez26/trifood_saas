from pathlib import Path
from typing import Literal
from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    app_name: str = "POTOQUITOS API"
    environment: Literal["development", "test", "production"] = "development"
    database_url: str
    jwt_secret_key: SecretStr
    access_token_minutes: int = Field(default=15, gt=0)
    jwt_refresh_hours: int = Field(default=8, gt=0)
    password_reset_minutes: int = Field(default=30, gt=0)
    cors_allowed_origins: list[str] = ["http://localhost:5173", "http://localhost:8080"]
    catalog_media_root: Path = Path("media/products")
    catalog_image_max_bytes: int = Field(default=5242880, gt=0, le=5242880)
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: SecretStr = SecretStr("")
    smtp_from: str = "no-reply@potoquitos.local"
    admin_username: str = ""
    admin_email: str = ""
    admin_password: SecretStr = SecretStr("")
    admin_first_name: str = "Super"
    admin_last_name: str = "Admin"

    @model_validator(mode="after")
    def validate_runtime(self):
        secret = self.jwt_secret_key.get_secret_value()
        if len(secret) < 32 or any(
            word in secret.lower() for word in ("change-this", "replace_me")
        ):
            raise ValueError(
                "JWT_SECRET_KEY debe ser una clave propia de al menos 32 caracteres."
            )
        if (
            not self.database_url.startswith("postgresql+psycopg://")
            and self.environment != "test"
        ):
            raise ValueError("DATABASE_URL debe utilizar PostgreSQL con psycopg.")
        if "*" in self.cors_allowed_origins:
            raise ValueError("CORS requiere orígenes explícitos.")
        return self
