from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SKIPPED = {".venv", "__pycache__", ".pytest_cache", "__tests__", "tests"}


def source_files():
    for path in ROOT.rglob("*.py"):
        if SKIPPED.isdisjoint(path.relative_to(ROOT).parts):
            yield path


def test_no_google_provider_sdk_or_credential_references_remain():
    offenders = [
        str(path.relative_to(ROOT))
        for path in source_files()
        if any(token in path.read_text().lower() for token in ("gemini_api_key", "geminiembedding", "generativelanguage", "generativeai", "google_api_key", "google.genai", "langchain_google"))
    ]

    assert offenders == []
