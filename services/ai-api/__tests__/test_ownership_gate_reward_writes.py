from __future__ import annotations

import subprocess
from pathlib import Path

import pytest

ROOT = next((p for p in Path(__file__).resolve().parents if (p / "scripts" / "check-ownership-rules.sh").exists()), None)
SCRIPT = (ROOT or Path("/nonexistent")) / "scripts" / "check-ownership-rules.sh"
LABEL = "reward ledger written outside the reward ledger service"
CLIENT = "pri" + "sma"

pytestmark = pytest.mark.skipif(ROOT is None, reason="repository scripts are not part of the image")


def run_gate(tree: dict[str, str], tmp_path: Path) -> subprocess.CompletedProcess:
    for relative, content in tree.items():
        target = tmp_path / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content)
    return subprocess.run(["bash", str(SCRIPT)], cwd=tmp_path, capture_output=True, text=True, timeout=60)


WRITES = {
    "create": "await this.{c}.gamificationLedger.create({{ data }});",
    "createmany": "await tx.gamificationLedger.createMany({{ data }});",
    "update": "await tx.gamificationLedger.update({{ where, data }});",
    "upsert": "await this.{c}.gamificationLedger.upsert({{ where, create, update }});",
    "delete": "await tx.gamificationLedger.deleteMany({{ where }});",
}


@pytest.mark.parametrize("template", WRITES.values(), ids=WRITES.keys())
def test_a_write_to_the_ledger_outside_its_service_is_a_violation(tmp_path, template):
    statement = template.format(c=CLIENT)
    result = run_gate({"services/api/src/v1/gamify/shortcut.service.ts": f"export const x = async () => {{ {statement} }};\n"}, tmp_path)

    assert result.returncode == 1
    assert LABEL in result.stdout
    assert "services/api/src/v1/gamify/shortcut.service.ts" in result.stdout


def test_the_ledger_service_and_the_specs_may_write_it(tmp_path):
    result = run_gate(
        {
            "services/api/src/v1/gamify/rewards/reward-ledger.service.ts": "await tx.gamificationLedger.createMany({});\n",
            "services/api/src/v1/__tests__/reward-ledger.int.spec.ts": f"await {CLIENT}.gamificationLedger.deleteMany({{}});\n",
            "services/api/src/v1/gamify/rewards/__tests__/x.spec.ts": f"await {CLIENT}.gamificationLedger.create({{}});\n",
        },
        tmp_path,
    )

    assert result.returncode == 0
    assert LABEL not in result.stdout


def test_reads_of_the_ledger_are_not_flagged(tmp_path):
    result = run_gate(
        {"services/api/src/v1/gamify/rewards/reward-engine.service.ts": "await tx.gamificationLedger.aggregate({ where });\nawait tx.gamificationLedger.findMany({});\n"},
        tmp_path,
    )

    assert result.returncode == 0
    assert LABEL not in result.stdout
