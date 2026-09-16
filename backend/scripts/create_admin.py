"""Compatibility entry point for the explicit FastAPI bootstrap command."""

import sys
from fastapi_app.cli import main

if __name__ == "__main__":
    sys.argv = [sys.argv[0], "create-admin"]
    main()
