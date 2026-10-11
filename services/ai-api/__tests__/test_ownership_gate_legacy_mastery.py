from __future__ import annotations

import subprocess
from pathlib import Path

import pytest

ROOT = next((p for p in Path(__file__).resolve().parents if (p / "scripts" / "check-ownership-rules.sh").exists()), None)
SCRIPT = (ROOT or Path("/nonexistent")) / "scripts" / "check-ownership-rules.sh"
LABEL = "legacy topic mastery tables used by code"
CLIENT = "pri" + "sma"

pytestmark = pytest.mark.skipif(ROOT is None, reason="repository scripts are not part of the image")


def run_gate(tree: dict[str, str], tmp_path: Path) -> subprocess.CompletedProcess:
    for relative, content in tree.items():
        target = tmp_path / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content)
    return subprocess.run(["bash", str(SCRIPT)], cwd=tmp_path, capture_output=True, text=True, timeout=60)


USES = {
    "mastery-write": "await this.{c}.topicMasteryRecord.upsert({{ where, create, update }});",
    "mastery-read": "const rows = await this.{c}.topicMasteryRecord.findMany({{}});",
    "mastery-group": "await tx.topicMasteryRecord.groupBy({{ by: ['topicId'] }});",
    "node-write": "await this.{c}.skillNode.upsert({{ where, create, update }});",
    "node-read": "const rows = await tx.skillNode.findMany({{}});",
}


@pytest.mark.parametrize("template", USES.values(), ids=USES.keys())
def test_any_use_of_a_legacy_table_in_application_code_is_a_violation(tmp_path, template):
    statement = template.format(c=CLIENT)
    result = run_gate({"services/api/src/v1/analytics/shortcut.service.ts": f"export const x = async () => {{ {statement} }};\n"}, tmp_path)

    assert result.returncode == 1
    assert LABEL in result.stdout
    assert "services/api/src/v1/analytics/shortcut.service.ts" in result.stdout


def test_specs_and_the_schema_folder_may_name_the_tables(tmp_path):
    result = run_gate(
        {
            "services/api/src/v1/__tests__/legacy.int.spec.ts": f"await {CLIENT}.topicMasteryRecord.deleteMany({{}});\n",
            "services/api/src/v1/analytics/__tests__/x.spec.ts": f"await {CLIENT}.skillNode.findMany({{}});\n",
            "services/api/prisma/seed-legacy.ts": f"await {CLIENT}.topicMasteryRecord.createMany({{}});\n",
        },
        tmp_path,
    )

    assert result.returncode == 0
    assert LABEL not in result.stdout


def test_the_derived_skill_nodes_method_is_not_the_legacy_table(tmp_path):
    result = run_gate(
        {"services/api/src/v1/learner-model/learner-model.controller.ts": "return { data: await this.state.skillNodes(userId) };\n"},
        tmp_path,
    )

    assert result.returncode == 0
    assert LABEL not in result.stdout
