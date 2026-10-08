from __future__ import annotations

from collections import defaultdict, deque
from typing import Dict, Iterable, Iterator, List, Optional, Set, Tuple

from v1.domain.concept import Concept
from v1.domain.exceptions import UnknownConceptError
from v1.domain.misconception import Misconception
from v1.domain.procedure import Procedure
from v1.domain.rule import Rule


class ConceptGraph:
    def __init__(self) -> None:
        self._concepts: Dict[str, Concept] = {}
        self._prereq_edges: Dict[str, Set[str]] = defaultdict(set)
        self._related_edges: Dict[str, Set[str]] = defaultdict(set)
        self._contrasts_edges: Dict[str, Set[str]] = defaultdict(set)
        self._exemplifies_edges: Dict[str, Set[str]] = defaultdict(set)
        self._misconceptions: Dict[str, Misconception] = {}
        self._concept_misconceptions: Dict[str, Set[str]] = defaultdict(set)
        self._rules: Dict[str, Rule] = {}
        self._concept_rules: Dict[str, Set[str]] = defaultdict(set)
        self._procedures: Dict[str, Procedure] = {}

    def add_concept(self, concept: Concept) -> None:
        if not concept.concept_id:
            raise ValueError("concept.concept_id is required")
        self._concepts[concept.concept_id] = concept
        for prereq_id in concept.prerequisite_ids:
            self._prereq_edges[prereq_id].add(concept.concept_id)
        for related_id in concept.related_concept_ids:
            self._related_edges[concept.concept_id].add(related_id)
            self._related_edges[related_id].add(concept.concept_id)
        for contrast_id in concept.contrasts_with_ids:
            self._contrasts_edges[concept.concept_id].add(contrast_id)
            self._contrasts_edges[contrast_id].add(concept.concept_id)
        for ex_id in concept.exemplified_by_ids:
            self._exemplifies_edges[concept.concept_id].add(ex_id)
        for ms_id in concept.misconception_ids:
            self._concept_misconceptions[concept.concept_id].add(ms_id)
        for rl_id in concept.rule_ids:
            self._concept_rules[concept.concept_id].add(rl_id)

    def add_misconception(self, misconception: Misconception) -> None:
        if not misconception.misconception_id:
            raise ValueError("misconception.misconception_id is required")
        self._misconceptions[misconception.misconception_id] = misconception
        self._concept_misconceptions[misconception.concept_id].add(misconception.misconception_id)

    def add_rule(self, rule: Rule) -> None:
        if not rule.rule_id:
            raise ValueError("rule.rule_id is required")
        self._rules[rule.rule_id] = rule
        for concept_id in rule.applies_to:
            self._concept_rules[concept_id].add(rule.rule_id)

    def add_procedure(self, procedure: Procedure) -> None:
        if not procedure.procedure_id:
            raise ValueError("procedure.procedure_id is required")
        self._procedures[procedure.procedure_id] = procedure

    def get_concept(self, concept_id: str) -> Concept:
        try:
            return self._concepts[concept_id]
        except KeyError as exc:
            raise UnknownConceptError(
                f"concept not found: {concept_id}",
                details={"conceptId": concept_id},
            ) from exc

    def has_concept(self, concept_id: str) -> bool:
        return concept_id in self._concepts

    def all_concepts(self) -> List[Concept]:
        return list(self._concepts.values())

    def all_misconceptions(self) -> List[Misconception]:
        return list(self._misconceptions.values())

    def all_rules(self) -> List[Rule]:
        return list(self._rules.values())

    def misconceptions_for_concept(self, concept_id: str) -> List[Misconception]:
        return [
            self._misconceptions[m_id]
            for m_id in self._concept_misconceptions.get(concept_id, set())
            if m_id in self._misconceptions
        ]

    def rules_for_concept(self, concept_id: str) -> List[Rule]:
        return [
            self._rules[r_id]
            for r_id in self._concept_rules.get(concept_id, set())
            if r_id in self._rules
        ]

    def prerequisites_for(self, concept_id: str) -> List[Concept]:
        concept = self.get_concept(concept_id)
        return [self.get_concept(pid) for pid in concept.prerequisite_ids if pid in self._concepts]

    def descendants(self, concept_id: str) -> List[Concept]:
        visited: Set[str] = set()
        queue: deque[str] = deque([concept_id])
        out: List[Concept] = []
        while queue:
            current = queue.popleft()
            for child_id in self._prereq_edges.get(current, set()):
                if child_id in visited or child_id == concept_id:
                    continue
                visited.add(child_id)
                child = self._concepts.get(child_id)
                if child is not None:
                    out.append(child)
                    queue.append(child_id)
        return out

    def topological_order(self) -> List[Concept]:
        in_degree: Dict[str, int] = {cid: 0 for cid in self._concepts}
        for cid in self._concepts:
            for _ in self._concepts[cid].prerequisite_ids:
                in_degree[cid] += 1
        queue: deque[str] = deque([cid for cid, deg in in_degree.items() if deg == 0])
        order: List[Concept] = []
        while queue:
            cid = queue.popleft()
            order.append(self._concepts[cid])
            for child_id in self._prereq_edges.get(cid, set()):
                in_degree[child_id] -= 1
                if in_degree[child_id] == 0:
                    queue.append(child_id)
        if len(order) != len(self._concepts):
            raise ValueError("cycle detected in concept prerequisites")
        return order

    def explain_path(self, from_concept_id: str, to_concept_id: str) -> List[str]:
        if from_concept_id == to_concept_id:
            return [from_concept_id]
        adj = self._prereq_edges
        parents: Dict[str, Optional[str]] = {from_concept_id: None}
        queue: deque[str] = deque([from_concept_id])
        target: Optional[str] = None
        while queue:
            current = queue.popleft()
            for child_id in adj.get(current, set()):
                if child_id in parents:
                    continue
                parents[child_id] = current
                if child_id == to_concept_id:
                    target = child_id
                    queue.clear()
                    break
                queue.append(child_id)
        if target is None:
            raise UnknownConceptError(
                "no prerequisite path between concepts",
                details={"from": from_concept_id, "to": to_concept_id},
            )
        path: List[str] = []
        cursor: Optional[str] = target
        while cursor is not None:
            path.append(cursor)
            cursor = parents[cursor]
        return list(reversed(path))

    def iter_all(self) -> Iterator[Tuple[str, str, str]]:
        for cid in self._concepts:
            for pid in self._concepts[cid].prerequisite_ids:
                yield pid, "PREREQUISITE_OF", cid
            for rid in self._related_edges.get(cid, set()):
                yield cid, "RELATED_TO", rid
            for cid2 in self._contrasts_edges.get(cid, set()):
                yield cid, "CONTRASTS_WITH", cid2


__all__ = ["ConceptGraph"]