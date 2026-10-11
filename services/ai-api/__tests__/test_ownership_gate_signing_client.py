from __future__ import annotations

import subprocess
from pathlib import Path

import pytest

ROOT = next((p for p in Path(__file__).resolve().parents if (p / "scripts" / "check-ownership-rules.sh").exists()), None)
SCRIPT = (ROOT or Path("/nonexistent")) / "scripts" / "check-ownership-rules.sh"
LABEL = "ai-api calls api without the signing client"

pytestmark = pytest.mark.skipif(ROOT is None, reason="repository scripts are not part of the image")


def run_gate(tree: dict[str, str], tmp_path: Path) -> subprocess.CompletedProcess:
    for relative, content in tree.items():
        target = tmp_path / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content)
    return subprocess.run(
        ["bash", str(SCRIPT)], cwd=tmp_path, capture_output=True, text=True, timeout=60
    )


def test_a_module_that_calls_the_api_with_plain_requests_is_a_violation(tmp_path):
    result = run_gate(
        {
            "services/ai-api/v1/learning/legacy.py": (
                "import requests\n"
                "from config.envs import ENVS\n"
                "def read(): return requests.get(f\"{ENVS['NEST_API']}/curriculum/lessons/1\")\n"
            )
        },
        tmp_path,
    )

    assert result.returncode == 1
    assert LABEL in result.stdout
    assert "services/ai-api/v1/learning/legacy.py" in result.stdout


def test_a_module_that_uses_the_signing_client_passes(tmp_path):
    result = run_gate(
        {
            "services/ai-api/v1/learning/service.py": (
                "from config.internal_client import InternalApiClient\n"
                "from config.envs import ENVS\n"
                "def read(session): return InternalApiClient(session).get('/internal/lessons/1')\n"
            )
        },
        tmp_path,
    )

    assert result.returncode == 0
    assert LABEL not in result.stdout


def test_the_agents_package_and_the_client_itself_are_not_flagged(tmp_path):
    result = run_gate(
        {
            "services/ai-api/v1/agents/router_endpoint.py": "import os\nAPI = os.environ['NEST_API']\n",
            "services/ai-api/config/user_auth.py": "from config.envs import ENVS\nURL = ENVS['NEST_API']\n",
            "services/ai-api/config/internal_client.py": "from config.envs import ENVS\nURL = ENVS['NEST_API']\n",
        },
        tmp_path,
    )

    assert result.returncode == 0
    assert LABEL not in result.stdout
