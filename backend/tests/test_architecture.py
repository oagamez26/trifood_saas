import ast
from pathlib import Path


def test_application_and_domain_are_independent():
    root = Path(__file__).parents[1] / "fastapi_app"
    checked = 0
    for path in root.rglob("*.py"):
        if "application" not in path.parts and "domain" not in path.parts:
            continue
        checked += 1
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom):
                assert not any(
                    word in (node.module or "")
                    for word in (
                        "infrastructure",
                        "presentation",
                        "sqlalchemy",
                        "fastapi.",
                        "pydantic",
                        "settings",
                    )
                )
            if isinstance(node, ast.Import):
                assert not any(
                    x.name.split(".")[0] in {"fastapi", "sqlalchemy", "pydantic", "os"}
                    for x in node.names
                )
    assert checked >= 5
