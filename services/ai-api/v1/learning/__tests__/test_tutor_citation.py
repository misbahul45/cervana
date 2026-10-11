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


def test_citation_requires_a_locator_lesson_concept_or_resource():
    with pytest.raises(ValidationError):
        _make_response([{"chunkId": "chunk-1", "score": 0.4}])


def test_a_citation_may_name_only_the_concept_or_only_the_resource_the_chunk_comes_from():
    response = _make_response(
        [
            {"conceptId": "l1-t01-accounting-equation", "chunkId": "golden:l1-t01:0", "score": 0.7},
            {"resourceId": "res-1", "chunkId": "res-1:3", "score": 0.5},
        ]
    )

    assert response.citations[0].concept_id == "l1-t01-accounting-equation" and response.citations[0].lesson_id is None
    assert response.citations[1].resource_id == "res-1"
    dumped = response.citations[0].model_dump(by_alias=True, exclude_none=True)
    assert dumped == {"conceptId": "l1-t01-accounting-equation", "chunkId": "golden:l1-t01:0", "score": 0.7}


def test_empty_citations_is_allowed():
    response = _make_response(None)
    assert response.citations is None