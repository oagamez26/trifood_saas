"""ASGI entry point. Configuration is validated at application startup."""

from .bootstrap import create_app

app = create_app()
