from __future__ import annotations

from pydantic import ValidationError

from v1.learning.dto import (
    CitationDto,
    GenerateContentMaterialResponseDto,
)


def test_response_accepts_valid_payload():
    dto = GenerateContentMaterialResponseDto(
        chat_id="c-1",
        chat_message_id="m-1",
        data="hello",
        citations=[
            CitationDto(
                lesson_id="l-1",
                chunk_id="ch-1",
                score=0.9,
                source="reducera-embedding",
                snippet="snippet text",
            )
        ],
        metadata={"topicId": "t-1"},
    )
    assert dto.chat_id == "c-1"
    assert dto.citations[0].score == 0.9


def test_response_rejects_negative_score():
    try:
        CitationDto(lesson_id="l-1", chunk_id="ch-1", score=-0.1)
    except ValidationError:
        return
    raise AssertionError("expected ValidationError on negative score")


def test_response_rejects_missing_required_fields():
    try:
        GenerateContentMaterialResponseDto(chat_id="c-1")
    except ValidationError:
        return
    raise AssertionError("expected ValidationError on missing chat_message_id and data")


def test_response_dump_by_alias_round_trip():
    dto = GenerateContentMaterialResponseDto(
        chat_id="c-1",
        chat_message_id="m-1",
        data="hello",
    )
    dumped = dto.model_dump(by_alias=True)
    assert dumped["chatId"] == "c-1"
    assert dumped["chatMessageId"] == "m-1"