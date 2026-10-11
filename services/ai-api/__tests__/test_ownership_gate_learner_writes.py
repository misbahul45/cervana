from __future__ import annotations

import subprocess
from pathlib import Path

import pytest

ROOT = next((p for p in Path(__file__).resolve().parents if (p / "scripts" / "check-ownership-rules.sh").exists()), None)
SCRIPT = (ROOT or Path("/nonexistent")) / "scripts" / "check-ownership-rules.sh"
LABEL = "learner tables written outside the learner events service"
CLIENT = "pri" + "sma"

pytestmark = pytest.mark.skipif(ROOT is None, reason="repository scripts are not part of the image")


def run_gate(tree: dict[str, str], tmp_path: Path) -> subprocess.CompletedProcess:
    for relative, content in tree.items():
        target = tmp_path / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content)
    return subprocess.run(["bash", str(SCRIPT)], cwd=tmp_path, capture_output=True, text=True, timeout=60)


WRITES = {
    "update-mastery": "await this.{c}.conceptMastery.update({{ where: {{ id }}, data: {{ score: 1 }} }});",
    "upsert-mastery": "await tx.conceptMastery.upsert({{ where, create, update }});",
    "delete-mastery": "await tx.conceptMastery.deleteMany({{ where: {{ userId }} }});",
    "create-event": "await this.{c}.learningEvent.create({{ data }});",
    "createmany-event": "await tx.learningEvent.createMany({{ data }});",
    "update-stream": "await this.{c}.learnerStream.update({{ where, data }});",
}


@pytest.mark.parametrize("template", WRITES.values(), ids=WRITES.keys())
def test_a_write_to_a_learner_table_outside_the_events_service_is_a_violation(tmp_path, template):
    statement = template.format(c=CLIENT)
    result = run_gate({"services/api/src/v1/quiz/shortcut.service.ts": f"export const x = async () => {{ {statement} }};\n"}, tmp_path)

    assert result.returncode == 1
    assert LABEL in result.stdout
    assert "services/api/src/v1/quiz/shortcut.service.ts" in result.stdout


def test_the_events_service_and_the_specs_may_write_them(tmp_path):
    result = run_gate(
        {
            "services/api/src/v1/learner-model/events/learner-events.service.ts": "await tx.conceptMastery.upsert({});\nawait tx.learningEvent.create({});\nawait tx.learnerStream.update({});\n",
            "services/api/src/v1/__tests__/learner-events.int.spec.ts": f"await {CLIENT}.conceptMastery.update({{}});\n",
            "services/api/src/v1/learner-model/__tests__/x.spec.ts": f"await {CLIENT}.learningEvent.create({{}});\n",
        },
        tmp_path,
    )

    assert result.returncode == 0
    assert LABEL not in result.stdout


def test_reads_of_the_learner_tables_are_not_flagged(tmp_path):
    result = run_gate(
        {"services/api/src/v1/learner-model/learner-state.service.ts": f"await this.{CLIENT}.conceptMastery.findMany({{ where }});\nawait this.{CLIENT}.learningEvent.findMany({{}});\n"},
        tmp_path,
    )

    assert result.returncode == 0
    assert LABEL not in result.stdout
