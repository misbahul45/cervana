from __future__ import annotations

import subprocess
from pathlib import Path

import pytest

ROOT = next((p for p in Path(__file__).resolve().parents if (p / "scripts" / "check-ownership-rules.sh").exists()), None)
SCRIPT = (ROOT or Path("/nonexistent")) / "scripts" / "check-ownership-rules.sh"
ACHIEVEMENT_LABEL = "achievement unlocks written outside the achievement evaluator"
STREAK_LABEL = "streak days written outside the streak engine"
CLIENT = "pri" + "sma"

pytestmark = pytest.mark.skipif(ROOT is None, reason="repository scripts are not part of the image")


def run_gate(tree: dict[str, str], tmp_path: Path) -> subprocess.CompletedProcess:
    for relative, content in tree.items():
        target = tmp_path / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content)
    return subprocess.run(["bash", str(SCRIPT)], cwd=tmp_path, capture_output=True, text=True, timeout=60)


ACHIEVEMENT_WRITES = {
    "create": "await this.{c}.userAchievement.create({{ data }});",
    "createmany": "await tx.userAchievement.createMany({{ data }});",
    "upsert": "await tx.userAchievement.upsert({{ where, create, update }});",
    "delete": "await this.{c}.userAchievement.deleteMany({{ where }});",
}

STREAK_WRITES = {
    "create": "await this.{c}.streakHistory.create({{ data }});",
    "createmany": "await tx.streakHistory.createMany({{ data }});",
    "update": "await tx.streakHistory.updateMany({{ where, data }});",
    "upsert": "await tx.streakHistory.upsert({{ where, create, update }});",
}


@pytest.mark.parametrize("template", ACHIEVEMENT_WRITES.values(), ids=ACHIEVEMENT_WRITES.keys())
def test_an_achievement_unlock_written_elsewhere_is_a_violation(tmp_path, template):
    statement = template.format(c=CLIENT)
    result = run_gate({"services/api/src/v1/gamify/shortcut.service.ts": f"export const x = async () => {{ {statement} }};\n"}, tmp_path)

    assert result.returncode == 1
    assert ACHIEVEMENT_LABEL in result.stdout
    assert "services/api/src/v1/gamify/shortcut.service.ts" in result.stdout


@pytest.mark.parametrize("template", STREAK_WRITES.values(), ids=STREAK_WRITES.keys())
def test_a_streak_day_written_elsewhere_is_a_violation(tmp_path, template):
    statement = template.format(c=CLIENT)
    result = run_gate({"services/api/src/v1/gamify/shortcut.service.ts": f"export const x = async () => {{ {statement} }};\n"}, tmp_path)

    assert result.returncode == 1
    assert STREAK_LABEL in result.stdout


def test_the_evaluator_the_engine_the_legacy_admin_repo_and_specs_may_write(tmp_path):
    result = run_gate(
        {
            "services/api/src/v1/gamify/achievements/achievement-evaluator.ts": "await tx.userAchievement.createMany({});\n",
            "services/api/src/v1/gamify/streaks/streak-engine.service.ts": "await tx.streakHistory.createMany({});\n",
            "services/api/src/v1/gamify/streaks/streaks.repo.ts": f"await this.{CLIENT}.streakHistory.update({{}});\nawait this.{CLIENT}.streakHistory.create({{}});\n",
            "services/api/src/v1/__tests__/x.int.spec.ts": f"await {CLIENT}.userAchievement.deleteMany({{}});\nawait {CLIENT}.streakHistory.deleteMany({{}});\n",
        },
        tmp_path,
    )

    assert result.returncode == 0
    assert ACHIEVEMENT_LABEL not in result.stdout
    assert STREAK_LABEL not in result.stdout


def test_reads_are_not_flagged(tmp_path):
    result = run_gate(
        {"services/api/src/v1/gamify/me/gamify-me.service.ts": f"await this.{CLIENT}.streakHistory.findMany({{}});\nawait tx.userAchievement.findMany({{}});\nawait tx.userAchievement.count({{}});\n"},
        tmp_path,
    )

    assert result.returncode == 0
