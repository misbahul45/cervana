from __future__ import annotations

from v1.domain import run_all, set_default_graph, load_default_taxonomy


def test_all_default_scenarios_pass():
    set_default_graph(load_default_taxonomy())
    summary = run_all()
    assert summary["failed"] == 0, summary
    assert summary["total"] >= 10
    assert summary["passed"] == summary["total"]


def test_scenarios_cover_required_taxonomy():
    from v1.domain.evaluation import SCENARIOS

    tool_set = {s.inputs.get("tool") for s in SCENARIOS}
    assert "balance_check" in tool_set
    assert "validate_journal_entry" in tool_set
    assert "concept_explanation" in tool_set
    assert "account_lookup" in tool_set
    assert "contra_account_resolver" in tool_set