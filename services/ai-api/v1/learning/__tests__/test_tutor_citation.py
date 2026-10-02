"""Phase 1: Tutor response must cite the lesson the query targets.

The existing tutor/content pipeline surfaces `citations: List[str]` in
`GenerateContentMaterialResponseDto`. The Phase 1 acceptance gate requires
each citation to carry `lessonId`, not only a human-readable label.
"""

import pytest
from v1.learning.dto import GenerateContentMaterialResponseDto


def _make_response(citations):
    return GenerateContentMaterialResponseDto(
        chatId="c1",
        chatMessageId="m1",
        data="some content",
        citations=citations,
    )


def test_citation_lesson_id_round_trip():
    citations = [
        {
            "lessonId": "l1-t01-accounting-equation",
            "chunkId": "chunk-1",
            "score": 0.91,
        }
    ]
    response = _make_response(citations)

    assert response.citations is not None
    assert response.citations[0]["lessonId"] == "l1-t01-accounting-equation"


def test_citation_accepts_string_labels_for_legacy_callers():
    citations = ["Book A: Chapter 1"]
    assert _make_response(citations).citations == ["Book A: Chapter 1"]


def test_empty_citations_is_allowed():
    response = _make_response(None)
    assert response.citations is None