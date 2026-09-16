"""Local development entry point; production uses Uvicorn directly."""

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("fastapi_app.main:app", host="127.0.0.1", port=5000)
