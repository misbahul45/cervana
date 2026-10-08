from __future__ import annotations

import pytest

from v1.domain import (
    account_lookup,
    concept_explanation,
    contra_account_resolver,
    load_default_taxonomy,
    set_default_graph,
)


def setup_function(function):
    set_default_graph(load_default_taxonomy())


def test_account_lookup_returns_account_type():
    setup_function(None)
    result = account_lookup("1090")
    assert result["accountCode"] == "1090"
    assert result["accountType"] == "CONTRA_ASSET"
    assert result["normalBalance"] == "CREDIT"
    assert result["isContra"] is True


def test_account_lookup_unknown_raises():
    setup_function(None)
    from v1.domain.exceptions import UnknownAccountError

    try:
        account_lookup("9999")
    except UnknownAccountError:
        return
    raise AssertionError("expected UnknownAccountError")


def test_contra_resolver_returns_counterpart():
    setup_function(None)
    result = contra_account_resolver("1090")
    assert result["accountType"] == "CONTRA_ASSET"
    assert result["counterpartAccountType"] == "ASSET"


def test_concept_explanation_returns_dependencies():
    setup_function(None)
    result = concept_explanation("double_entry")
    assert result["concept"]["conceptId"] == "double_entry"
    prereq_ids = [c["conceptId"] for c in result["prerequisites"]]
    assert "accounting_equation" in prereq_ids


def test_concept_explanation_unknown_raises():
    setup_function(None)
    from v1.domain.exceptions import UnknownConceptError

    try:
        concept_explanation("does_not_exist")
    except UnknownConceptError:
        return
    raise AssertionError("expected UnknownConceptError")