"""Explicit operational commands; never run administrator bootstrap at startup."""

import argparse
from .settings import Settings
from .infrastructure.database import session_factory
from .infrastructure.repositories import SqlUnitOfWork
from .infrastructure.seed import seed_authorization
from .infrastructure.security import SecurityAdapter


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["seed-permissions", "create-admin", "seed-initial"])
    args = parser.parse_args()
    settings = Settings()
    engine, sessions = session_factory(settings.database_url)
    work = SqlUnitOfWork(sessions())
    try:
        if args.command == "seed-initial":
            from .infrastructure.seed import seed_initial_data
            seed_initial_data(work.session)
            print("Datos iniciales de Potoquitos sembrados exitosamente.")
        else:
            seed_authorization(work.session)
        if args.command == "create-admin":
            if not settings.admin_username or not settings.admin_email:
                raise ValueError("Configura ADMIN_USERNAME y ADMIN_EMAIL.")
            existing = work.auth.find_user(username=settings.admin_username)
            if existing:
                print(
                    "El usuario ya existe; no se modificó su contraseña, estado ni roles."
                )
            else:
                security = SecurityAdapter(settings)
                work.auth.save_user(
                    {
                        "username": settings.admin_username,
                        "email": settings.admin_email,
                        "first_name": settings.admin_first_name,
                        "last_name": settings.admin_last_name,
                        "password_hash": security.hash_password(
                            settings.admin_password.get_secret_value()
                        ),
                        "roles": ["ADMINISTRADOR"],
                    }
                )
                print("Administrador creado.")
        work.commit()
        print("Comando completado.")
    except Exception:
        work.rollback()
        raise
    finally:
        work.close()
        engine.dispose()


if __name__ == "__main__":
    main()
