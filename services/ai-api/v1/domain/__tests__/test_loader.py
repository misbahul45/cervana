from __future__ import annotations

import json
from pathlib import Path

from v1.domain import ConceptGraph, load_taxonomy_from_path


def test_load_taxonomy_from_json(tmp_path):
    payload = {
        "concepts": [
            {
                "conceptId": "c1",
                "name": "Concept 1",
                "domain": "ACCOUNTING",
                "level": "FOUNDATION",
                "prerequisites": [],
                "rules": ["r1"],
            },
            {
                "conceptId": "c2",
                "name": "Concept 2",
                "domain": "ACCOUNTING",
                "level": "INTERMEDIATE",
                "prerequisites": ["c1"],
                "rules": [],
            },
        ],
        "misconceptions": [
            {
                "misconceptionId": "m1",
                "conceptId": "c1",
                "type": "OTHER",
                "confidence": 0.6,
                "evidenceCount": 2,
            }
        ],
        "rules": [
            {
                "ruleId": "r1",
                "code": "R-1",
                "description": "Test rule",
                "appliesTo": ["c1"],
            }
        ],
    }
    path = tmp_path / "taxonomy.json"
    path.write_text(json.dumps(payload), encoding="utf-8")

    graph = load_taxonomy_from_path(path)
    assert isinstance(graph, ConceptGraph)
    assert graph.has_concept("c1")
    assert graph.has_concept("c2")
    assert len(graph.misconceptions_for_concept("c1")) == 1
    assert len(graph.rules_for_concept("c1")) == 1
    prereq = graph.prerequisites_for("c2")
    assert prereq[0].concept_id == "c1"