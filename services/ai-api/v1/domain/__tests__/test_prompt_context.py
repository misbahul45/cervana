from __future__ import annotations

from v1.domain import load_default_taxonomy, set_default_graph
from v1.domain.context import render_domain_context


def test_render_domain_context_includes_ontology_and_misconceptions():
    set_default_graph(load_default_taxonomy())
    block = render_domain_context(load_default_taxonomy())
    assert "domain_taxonomy" in block
    assert "Discipline: ACCOUNTING" in block
    assert "double_entry" in block
    assert "accounting_equation" in block
    assert "Contra Accounts" in block
    assert "balanced_double_entry" in block


def test_render_domain_context_focus_subset():
    set_default_graph(load_default_taxonomy())
    graph = load_default_taxonomy()
    block = render_domain_context(graph, focus_concept_ids=["double_entry"], max_concepts=2)
    assert "double_entry" in block
    assert "Discipline: ACCOUNTING" in block