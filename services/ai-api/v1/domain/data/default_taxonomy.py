from __future__ import annotations

from v1.domain import (
    Concept,
    ConceptGraph,
    Misconception,
    MisconceptionStatus,
    MisconceptionType,
    Rule,
)
from v1.domain.concept import AssessmentSignal, ConceptLevel, ProblemType
from v1.domain.validators.period import Period


def _concept(
        concept_id: str,
        name: str,
        *,
        level: ConceptLevel = ConceptLevel.FOUNDATION,
        description: str = "",
        prerequisites: list[str] | None = None,
        related: list[str] | None = None,
        contrasts: list[str] | None = None,
        rules: list[str] | None = None,
        misconceptions: list[str] | None = None,
        problems: list[ProblemType] | None = None,
        objectives: list[str] | None = None,
        signals: list[AssessmentSignal] | None = None,
) -> Concept:
    return Concept(
        concept_id=concept_id,
        name=name,
        domain="ACCOUNTING",
        level=level,
        description=description,
        prerequisite_ids=prerequisites or [],
        related_concept_ids=related or [],
        contrasts_with_ids=contrasts or [],
        rule_ids=rules or [],
        misconception_ids=misconceptions or [],
        problem_types=problems or [],
        learning_objectives=objectives or [],
        assessment_signals=signals or [],
    )


def build_default_graph() -> ConceptGraph:
    graph = ConceptGraph()

    concepts: list[Concept] = [
        _concept(
            "accounting_equation",
            "Accounting Equation (Assets = Liabilities + Equity)",
            description="The fundamental identity that drives every double-entry transaction.",
            problems=[ProblemType.CONCEPT_EXPLANATION, ProblemType.JOURNAL_ENTRY],
            signals=[AssessmentSignal.APPLIES_RULE, AssessmentSignal.COMPUTES_BALANCE],
            objectives=[
                "State the accounting equation in words and symbols",
                "Verify a transaction does not break the equation",
            ],
        ),
        _concept(
            "double_entry",
            "Double-Entry Bookkeeping",
            description="Every transaction has equal debits and credits.",
            prerequisites=["accounting_equation"],
            problems=[ProblemType.JOURNAL_ENTRY, ProblemType.ERROR_DIAGNOSIS],
            signals=[AssessmentSignal.APPLIES_RULE],
            objectives=[
                "Explain why every transaction has equal debits and credits",
                "Identify the debit and credit side of a transaction",
            ],
        ),
        _concept(
            "normal_balance",
            "Normal Balance of Accounts",
            description="Each account type carries a debit or credit normal balance.",
            prerequisites=["double_entry"],
            problems=[ProblemType.JOURNAL_ENTRY, ProblemType.ERROR_DIAGNOSIS],
            signals=[AssessmentSignal.APPLIES_RULE, AssessmentSignal.RECOGNIZES_CONTRA],
            objectives=[
                "Classify accounts by normal balance",
                "Apply the normal balance rule when posting entries",
            ],
        ),
        _concept(
            "contra_account",
            "Contra Accounts",
            description="Contra accounts reduce their parent account on the opposite side.",
            prerequisites=["normal_balance"],
            contrasts=["normal_balance"],
            problems=[ProblemType.ERROR_DIAGNOSIS, ProblemType.CASE_ANALYSIS],
            signals=[AssessmentSignal.RECOGNIZES_CONTRA],
            misconceptions=["contra_account_confusion"],
        ),
        _concept(
            "journal_entry",
            "Journal Entry",
            description="The atomic record of a transaction with balanced debits and credits.",
            prerequisites=["double_entry", "normal_balance"],
            problems=[ProblemType.JOURNAL_ENTRY, ProblemType.ERROR_DIAGNOSIS, ProblemType.MULTI_STEP],
            signals=[AssessmentSignal.APPLIES_RULE, AssessmentSignal.COMPUTES_BALANCE],
        ),
        _concept(
            "adjusting_entry",
            "Adjusting Entries",
            description="Period-end entries that align books to accrual accounting.",
            prerequisites=["journal_entry", "accrual_vs_cash"],
            level=ConceptLevel.INTERMEDIATE,
            problems=[ProblemType.MULTI_STEP, ProblemType.CASE_ANALYSIS],
            signals=[AssessmentSignal.APPLIES_RULE],
            misconceptions=["adjusting_entry_error"],
        ),
        _concept(
            "accrual_vs_cash",
            "Accrual vs Cash Basis",
            description="Timing differences between recognition and cash flow.",
            level=ConceptLevel.INTERMEDIATE,
            problems=[ProblemType.CASE_ANALYSIS],
            signals=[AssessmentSignal.APPLIES_RULE],
        ),
        _concept(
            "trial_balance",
            "Trial Balance",
            description="A listing of all account balances used to verify the ledger.",
            prerequisites=["journal_entry"],
            problems=[ProblemType.JOURNAL_ENTRY, ProblemType.ERROR_DIAGNOSIS],
            signals=[AssessmentSignal.COMPUTES_BALANCE],
        ),
        _concept(
            "financial_statements",
            "Financial Statements",
            description="Income statement, balance sheet, statement of cash flows.",
            prerequisites=["trial_balance", "adjusting_entry"],
            level=ConceptLevel.INTERMEDIATE,
            problems=[ProblemType.CASE_ANALYSIS, ProblemType.MULTI_STEP],
            signals=[AssessmentSignal.RECONCILES_STATEMENT],
            misconceptions=["financial_statement_mapping_error"],
        ),
        _concept(
            "revenue_recognition",
            "Revenue Recognition",
            description="Recognize revenue when control transfers, not when cash is received.",
            prerequisites=["accrual_vs_cash", "financial_statements"],
            level=ConceptLevel.ADVANCED,
            problems=[ProblemType.CASE_ANALYSIS],
            signals=[AssessmentSignal.APPLIES_RULE, AssessmentSignal.RECONCILES_STATEMENT],
        ),
    ]
    for concept in concepts:
        graph.add_concept(concept)

    misconceptions: list[Misconception] = [
        Misconception(
            misconception_id="contra_account_confusion",
            concept_id="contra_account",
            type=MisconceptionType.CONTRA_ACCOUNT_CONFUSION,
            confidence=0.7,
            evidence_count=2,
            status=MisconceptionStatus.CONFIRMED,
            description=(
                "Learners confuse the side of a contra account with the side of its parent, "
                "treating accumulated depreciation as a debit balance."
            ),
        ),
        Misconception(
            misconception_id="debit_credit_direction_error",
            concept_id="normal_balance",
            type=MisconceptionType.DEBIT_CREDIT_DIRECTION_ERROR,
            confidence=0.8,
            evidence_count=3,
            status=MisconceptionStatus.CONFIRMED,
            description=(
                "Learners apply 'increase with debit' universally, even for revenue and "
                "liability accounts."
            ),
        ),
        Misconception(
            misconception_id="adjusting_entry_error",
            concept_id="adjusting_entry",
            type=MisconceptionType.ADJUSTING_ENTRY_ERROR,
            confidence=0.6,
            evidence_count=2,
            status=MisconceptionStatus.CANDIDATE,
            description="Learners skip reversing entries or post to wrong periods.",
        ),
        Misconception(
            misconception_id="financial_statement_mapping_error",
            concept_id="financial_statements",
            type=MisconceptionType.FINANCIAL_STATEMENT_MAPPING_ERROR,
            confidence=0.6,
            evidence_count=2,
            status=MisconceptionStatus.CANDIDATE,
            description=(
                "Learners put expense balances on the balance sheet or omit retained "
                "earnings rollforward."
            ),
        ),
        Misconception(
            misconception_id="multi_step_case_reasoning_error",
            concept_id="financial_statements",
            type=MisconceptionType.MULTI_STEP_CASE_REASONING_ERROR,
            confidence=0.5,
            evidence_count=1,
            status=MisconceptionStatus.CANDIDATE,
            description="Learners skip intermediate steps in multi-transaction scenarios.",
        ),
    ]
    for mis in misconceptions:
        graph.add_misconception(mis)

    rules: list[Rule] = [
        Rule(
            rule_id="balanced_double_entry",
            code="DE-001",
            description="Σ debits must equal Σ credits for any journal entry.",
            applies_to=["journal_entry", "double_entry"],
        ),
        Rule(
            rule_id="non_negative_amounts",
            code="AMT-001",
            description="All amounts in a journal entry must be non-negative.",
            applies_to=["journal_entry"],
        ),
        Rule(
            rule_id="valid_account_code",
            code="ACC-001",
            description="Every account used in a journal entry must exist in the chart of accounts.",
            applies_to=["journal_entry"],
        ),
        Rule(
            rule_id="normal_balance_respected",
            code="DIR-001",
            description="The direction of a posted line must match the account's normal balance for increases.",
            applies_to=["journal_entry", "normal_balance"],
        ),
    ]
    for rule in rules:
        graph.add_rule(rule)

    return graph


_DEFAULT_GRAPH: ConceptGraph | None = None


def load_default_taxonomy() -> ConceptGraph:
    global _DEFAULT_GRAPH
    if _DEFAULT_GRAPH is None:
        _DEFAULT_GRAPH = build_default_graph()
    assert _DEFAULT_GRAPH is not None
    return _DEFAULT_GRAPH


__all__ = ["build_default_graph", "load_default_taxonomy"]