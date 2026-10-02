import ast
from pathlib import Path


def test_main_does_not_spawn_subprocess():
    MAIN = Path(__file__).resolve().parent.parent / "main.py"
    source = MAIN.read_text()
    tree = ast.parse(source)

    spawned = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            func = node.func
            if isinstance(func, ast.Attribute) and func.attr == "Popen":
                spawned.append(ast.unparse(node))

    assert not spawned, f"main.py must not call subprocess.Popen; found: {spawned}"