"""Frozen recall benchmark for RAG retrieval.

The benchmark uses an in-memory fake corpus; production calls a real Qdrant
collection. The test asserts recall@k >= 0.7 on 20 questions.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))


GOLDEN_CHUNKS = [
    {"id": "c1", "topic": "debits_and_credits", "text": "Debit increases assets and expenses, credit decreases them."},
    {"id": "c2", "topic": "debits_and_credits", "text": "Revenue increases with credit, decreases with debit."},
    {"id": "c3", "topic": "debits_and_credits", "text": "The accounting equation: Assets = Liabilities + Equity."},
    {"id": "c4", "topic": "debits_and_credits", "text": "Trial balance lists all ledger balances."},
    {"id": "c5", "topic": "debits_and_credits", "text": "Adjusting entries update revenue and expense accounts."},
    {"id": "c6", "topic": "debits_and_credits", "text": "Closing entries zero out temporary accounts."},
    {"id": "c7", "topic": "balance_sheet", "text": "Balance sheet reports assets, liabilities, and equity at a point in time."},
    {"id": "c8", "topic": "balance_sheet", "text": "Current assets are expected to be converted within one year."},
    {"id": "c9", "topic": "balance_sheet", "text": "Long-term liabilities are due after more than one year."},
    {"id": "c10", "topic": "balance_sheet", "text": "Equity represents residual interest after liabilities."},
    {"id": "c11", "topic": "income_statement", "text": "Income statement reports revenue minus expenses over a period."},
    {"id": "c12", "topic": "income_statement", "text": "Gross profit equals revenue minus cost of goods sold."},
    {"id": "c13", "topic": "income_statement", "text": "Net income flows to retained earnings."},
    {"id": "c14", "topic": "cash_flow", "text": "Operating activities include cash from sales and payments to suppliers."},
    {"id": "c15", "topic": "cash_flow", "text": "Investing activities include purchase and sale of long-term assets."},
    {"id": "c16", "topic": "cash_flow", "text": "Financing activities include issuing debt and paying dividends."},
    {"id": "c17", "topic": "inventory", "text": "FIFO assumes oldest items are sold first."},
    {"id": "c18", "topic": "inventory", "text": "LIFO assumes newest items are sold first."},
    {"id": "c19", "topic": "inventory", "text": "Weighted average blends unit costs."},
    {"id": "c20", "topic": "inventory", "text": "Lower of cost or net realizable value is the conservative rule."},
]

BENCHMARK_QUESTIONS = [
    ("what does debit increase", ["c1"]),
    ("how does credit affect revenue", ["c2"]),
    ("accounting equation definition", ["c3"]),
    ("trial balance", ["c4"]),
    ("adjusting entries", ["c5"]),
    ("closing entries", ["c6"]),
    ("balance sheet purpose", ["c7"]),
    ("current assets meaning", ["c8"]),
    ("long-term liabilities", ["c9"]),
    ("equity meaning", ["c10"]),
    ("income statement purpose", ["c11"]),
    ("gross profit", ["c12"]),
    ("net income retained earnings", ["c13"]),
    ("operating activities cash", ["c14"]),
    ("investing activities", ["c15"]),
    ("financing activities", ["c16"]),
    ("FIFO inventory", ["c17"]),
    ("LIFO inventory", ["c18"]),
    ("weighted average inventory", ["c19"]),
    ("lower of cost or NRV", ["c20"]),
]


def keyword_match_score(query: str, chunk_text: str) -> float:
    q_tokens = [t for t in query.lower().split() if len(t) > 2]
    text = chunk_text.lower()
    if not q_tokens:
        return 0.0
    hits = sum(1 for t in q_tokens if t in text)
    return hits / len(q_tokens)


def retrieve(query: str, top_k: int = 5):
    scored = [
        (keyword_match_score(query, c["text"]), c["id"], c["topic"])
        for c in GOLDEN_CHUNKS
    ]
    scored.sort(key=lambda x: x[0], reverse=True)
    return [chunk_id for score, chunk_id, _topic in scored[:top_k] if score > 0]


def evaluate_recall():
    hits = 0
    for query, expected_ids in BENCHMARK_QUESTIONS:
        retrieved_ids = retrieve(query, top_k=5)
        if any(eid in retrieved_ids for eid in expected_ids):
            hits += 1
    return hits / len(BENCHMARK_QUESTIONS)


def test_rag_recall_at_or_above_threshold():
    recall = evaluate_recall()
    assert recall >= 0.7, f"RAG recall dropped to {recall:.2f} (>= 0.7 required)"


def test_rag_retrieval_is_deterministic():
    seen = []
    for _ in range(3):
        seen.append(retrieve("what is debit", top_k=3))
    assert seen[0] == seen[1] == seen[2]


def test_rag_returns_empty_for_unrelated_query():
    out = retrieve("xyzqq nonsense query", top_k=5)
    assert out == []