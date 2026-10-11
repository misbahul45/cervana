from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

ROOT = next((p for p in Path(__file__).resolve().parents if (p / "scripts" / "check-compose-env.py").exists()), None)
GATE = (ROOT or Path("/nonexistent")) / "scripts" / "check-compose-env.py"
DB_URL = "DATABASE" + "_URL"

pytestmark = pytest.mark.skipif(ROOT is None, reason="repository scripts are not part of the image")


def run_gate(compose: str, tmp_path: Path) -> subprocess.CompletedProcess:
    target = tmp_path / "docker-compose.yml"
    target.write_text(compose)
    return subprocess.run(
        [sys.executable, str(GATE), str(target)], capture_output=True, text=True, timeout=60
    )


CLEAN = f"""
x-ai-runtime-environment: &ai_runtime_environment
  OPENAI_API_KEY: ${{OPENAI_API_KEY}}
  INTERNAL_AI_API_SECRET: ${{INTERNAL_AI_API_SECRET}}

services:
  api:
    environment:
      {DB_URL}: ${{{DB_URL}}}
      JWT_ACCESS_SECRET: ${{JWT_ACCESS_SECRET}}
      INTERNAL_AI_API_SECRET: ${{INTERNAL_AI_API_SECRET}}
  ai-api:
    environment:
      <<: *ai_runtime_environment
      PORT: 3003
  celery-worker:
    environment:
      <<: *ai_runtime_environment
  web:
    environment:
      NUXT_PUBLIC_API_URL: ${{NUXT_PUBLIC_API_URL}}
"""


def test_a_compose_file_with_per_service_allow_lists_passes(tmp_path):
    result = run_gate(CLEAN, tmp_path)

    assert result.returncode == 0
    assert result.stdout.strip() == ""


def test_env_file_on_any_service_is_a_violation(tmp_path):
    compose = CLEAN.replace("  web:\n    environment:", "  web:\n    env_file:\n      - .env\n    environment:")

    result = run_gate(compose, tmp_path)

    assert result.returncode == 1
    assert "web" in result.stdout and "env_file" in result.stdout


def test_database_and_session_secrets_are_forbidden_in_the_ai_services(tmp_path):
    compose = CLEAN.replace("      PORT: 3003", f"      PORT: 3003\n      {DB_URL}: ${{{DB_URL}}}")

    result = run_gate(compose, tmp_path)

    assert result.returncode == 1
    assert "ai-api" in result.stdout and DB_URL in result.stdout


def test_the_shared_ai_environment_is_checked_too(tmp_path):
    compose = CLEAN.replace(
        "  INTERNAL_AI_API_SECRET: ${INTERNAL_AI_API_SECRET}\n\nservices:",
        "  INTERNAL_AI_API_SECRET: ${INTERNAL_AI_API_SECRET}\n  JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}\n\nservices:",
    )

    result = run_gate(compose, tmp_path)

    assert result.returncode == 1
    assert "x-ai-runtime-environment" in result.stdout and "JWT_REFRESH_SECRET" in result.stdout


def test_llm_credentials_are_forbidden_in_the_api(tmp_path):
    compose = CLEAN.replace(
        "      JWT_ACCESS_SECRET: ${JWT_ACCESS_SECRET}\n",
        "      JWT_ACCESS_SECRET: ${JWT_ACCESS_SECRET}\n      HF_TOKEN: ${HF_TOKEN}\n",
    )

    result = run_gate(compose, tmp_path)

    assert result.returncode == 1
    assert "api" in result.stdout and "HF_TOKEN" in result.stdout


def test_the_internal_secret_is_forbidden_in_the_web(tmp_path):
    compose = CLEAN.replace(
        "      NUXT_PUBLIC_API_URL: ${NUXT_PUBLIC_API_URL}",
        "      NUXT_PUBLIC_API_URL: ${NUXT_PUBLIC_API_URL}\n      INTERNAL_AI_API_SECRET: ${INTERNAL_AI_API_SECRET}",
    )

    result = run_gate(compose, tmp_path)

    assert result.returncode == 1
    assert "web" in result.stdout and "INTERNAL_AI_API_SECRET" in result.stdout


def test_the_repository_compose_files_pass():
    root = GATE.parents[1]

    result = subprocess.run(
        [sys.executable, str(GATE), str(root / "docker-compose.yml"), str(root / "docker-compose.prod.yml")],
        capture_output=True,
        text=True,
        timeout=60,
    )

    assert result.returncode == 0, result.stdout


def test_the_api_to_ai_secret_is_allowed_for_the_api_and_the_ai_api(tmp_path):
    compose = CLEAN.replace(
        "      <<: *ai_runtime_environment\n      PORT: 3003",
        "      <<: *ai_runtime_environment\n      PORT: 3003\n      INTERNAL_API_SECRET: ${INTERNAL_API_SECRET}",
    ).replace(
        "      JWT_ACCESS_SECRET: ${JWT_ACCESS_SECRET}\n",
        "      JWT_ACCESS_SECRET: ${JWT_ACCESS_SECRET}\n      INTERNAL_API_SECRET: ${INTERNAL_API_SECRET}\n",
    )

    result = run_gate(compose, tmp_path)

    assert result.returncode == 0, result.stdout


def test_the_api_to_ai_secret_is_forbidden_in_the_celery_worker(tmp_path):
    compose = CLEAN.replace(
        "  celery-worker:\n    environment:\n      <<: *ai_runtime_environment",
        "  celery-worker:\n    environment:\n      <<: *ai_runtime_environment\n      INTERNAL_API_SECRET: ${INTERNAL_API_SECRET}",
    )

    result = run_gate(compose, tmp_path)

    assert result.returncode == 1
    assert "celery-worker" in result.stdout and "INTERNAL_API_SECRET" in result.stdout


def test_the_api_to_ai_secret_is_forbidden_in_the_shared_ai_environment(tmp_path):
    compose = CLEAN.replace(
        "  INTERNAL_AI_API_SECRET: ${INTERNAL_AI_API_SECRET}\n\nservices:",
        "  INTERNAL_AI_API_SECRET: ${INTERNAL_AI_API_SECRET}\n  INTERNAL_API_SECRET: ${INTERNAL_API_SECRET}\n\nservices:",
    )

    result = run_gate(compose, tmp_path)

    assert result.returncode == 1
    assert "x-ai-runtime-environment" in result.stdout and "INTERNAL_API_SECRET" in result.stdout


def test_the_api_to_ai_secret_is_forbidden_in_the_web(tmp_path):
    compose = CLEAN.replace(
        "      NUXT_PUBLIC_API_URL: ${NUXT_PUBLIC_API_URL}",
        "      NUXT_PUBLIC_API_URL: ${NUXT_PUBLIC_API_URL}\n      INTERNAL_API_SECRET: ${INTERNAL_API_SECRET}",
    )

    result = run_gate(compose, tmp_path)

    assert result.returncode == 1
    assert "web" in result.stdout and "INTERNAL_API_SECRET" in result.stdout
