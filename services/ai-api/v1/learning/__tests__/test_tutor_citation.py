import pytest
from pydantic import ValidationError
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
    assert response.citations[0].lesson_id == "l1-t01-accounting-equation"
    assert response.citations[0].chunk_id == "chunk-1"
    assert response.citations[0].score == 0.91


def test_citation_rejects_bare_string_labels_without_a_lesson():
    with pytest.raises(ValidationError):
        _make_response(["Book A: Chapter 1"])


def test_citation_requires_a_lesson_id():
    with pytest.raises(ValidationError):
        _make_response([{"chunkId": "chunk-1", "score": 0.4}])


def test_empty_citations_is_allowed():
    response = _make_response(None)
    assert response.citations is None