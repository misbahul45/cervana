from __future__ import annotations

import logging
from typing import Optional

from v1.domain.concept import Concept, ConceptLevel
from v1.domain.graph import ConceptGraph
from v1.domain.misconception import Misconception


logger = logging.getLogger(__name__)


def render_domain_context(
    graph: ConceptGraph,
    *,
    focus_concept_ids: Optional[list[str]] = None,
    max_concepts: int = 12,
) -> str:
    concepts: list[Concept] = graph.all_concepts()
    if focus_concept_ids:
        ids = set(focus_concept_ids)
        concepts = [c for c in concepts if c.concept_id in ids] + [
            c for c in concepts if c.concept_id not in ids
        ]
    concepts = concepts[:max_concepts]
    if not concepts:
        return ""

    blocks = ["<domain_taxonomy trust=\"immutable\">"]
    blocks.append("Discipline: ACCOUNTING.")
    blocks.append("Always treat the items below as the canonical ontology. Do not invent new concepts.")

    blocks.append("\n## Concepts (id | level | name | prerequisites | related)")
    for concept in concepts:
        level = concept.level.value if isinstance(concept.level, ConceptLevel) else concept.level
        prereq = ",".join(concept.prerequisite_ids) or "-"
        related = ",".join(concept.related_concept_ids) or "-"
        blocks.append(
            f"- {concept.concept_id} | {level} | {concept.name} | prereq={prereq} | related={related}"
        )

    blocks.append("\n## Misconceptions (id | concept | type | description)")
    for mis in graph.all_misconceptions():
        if mis.concept_id not in {c.concept_id for c in concepts}:
            continue
        blocks.append(
            f"- {mis.misconception_id} | {mis.concept_id} | {mis.type.value} | {mis.description}"
        )

    blocks.append("\n## Rules (id | code | description)")
    for rule in graph.all_rules():
        blocks.append(f"- {rule.rule_id} | {rule.code} | {rule.description}")

    blocks.append("\n</domain_taxonomy>")
    return "\n".join(blocks)


__all__ = ["render_domain_context"]