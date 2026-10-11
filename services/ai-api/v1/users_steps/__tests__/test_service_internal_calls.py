from __future__ import annotations

from config.agent_session import mint_session
from errors.types import CrossServiceError
from v1.users_steps import service as steps_service

import pytest

STEP = {
    "id": "s-1",
    "title": "Debit",
    "description": "d",
    "sortOrder": 1,
    "lessonId": "l-1",
    "themeId": "t-1",
    "createdAt": "2026-01-01T00:00:00Z",
    "updatedAt": "2026-01-01T00:00:00Z",
}
TOPIC = {
    "id": "t-1",
    "title": "Akuntansi",
    "slug": "akuntansi",
    "image": None,
    "isVerified": True,
    "price": 0,
    "topicDuration": 10,
    "createdAt": "2026-01-01T00:00:00Z",
    "updatedAt": "2026-01-01T00:00:00Z",
}
STYLE = {
    "id": "ls-1",
    "userTopicId": "ut-1",
    "dominantStyle": "visual",
    "createdAt": "2026-01-01T00:00:00Z",
    "updatedAt": "2026-01-01T00:00:00Z",
}


def session():
    return mint_session(acting_user_id="u-1", trace_id="trace-1", idempotency_key="request-key-0001")


def test_steps_are_read_from_the_internal_route_with_the_lesson_filter(internal_wire):
    internal_wire.respond(200, {"data": {"data": [STEP], "pagination": {}}})

    steps = steps_service.get_steps("l-1", session())

    prepared = internal_wire.sent[0]
    assert [step.id for step in steps] == ["s-1"]
    assert "/internal/steps?" in prepared.url
    assert "lessonId=l-1" in prepared.url
    assert "sort=sortOrder" in prepared.url
    assert prepared.headers["x-service-signature"]
    assert prepared.headers["x-acting-user-id"] == "u-1"
    assert "Authorization" not in prepared.headers


def test_one_step_and_one_learning_style_come_from_internal_routes(internal_wire):
    internal_wire.respond(200, {"data": STEP})
    step = steps_service.get_step("s-1", session())
    internal_wire.respond(200, {"data": STYLE})
    style = steps_service.get_learning_style("ls-1", session())

    assert step.id == "s-1"
    assert style.dominant_style == "visual"
    assert internal_wire.sent[0].url.endswith("/internal/steps/s-1")
    assert internal_wire.sent[1].url.endswith("/internal/learning-styles/ls-1")


def test_the_topic_read_stays_on_the_public_curriculum_route_but_is_signed(internal_wire):
    internal_wire.respond(200, {"data": {"data": [TOPIC]}})

    topic = steps_service.get_topic("t-1", session())

    prepared = internal_wire.sent[0]
    assert topic.id == "t-1"
    assert "/curriculum/topics?id=t-1" in prepared.url
    assert prepared.headers["x-service-signature"]


def test_a_missing_topic_is_a_cross_service_error(internal_wire):
    internal_wire.respond(200, {"data": {"data": []}})

    with pytest.raises(CrossServiceError):
        steps_service.get_topic("t-404", session())


def test_a_personality_quiz_is_listed_for_the_acting_user(internal_wire):
    internal_wire.respond(200, {"data": {"data": [{"id": "q-1", "title": "Kuis"}]}})

    quiz = steps_service.get_personality_quiz("l-1", "u-1", session())

    prepared = internal_wire.sent[0]
    assert quiz == {"id": "q-1", "title": "Kuis"}
    assert "/internal/personality-quizzes?" in prepared.url
    assert "lessonId=l-1" in prepared.url
    assert "userId=u-1" in prepared.url


@pytest.mark.parametrize("status", [404, 500])
def test_a_quiz_lookup_that_fails_or_finds_nothing_returns_none(internal_wire, status):
    internal_wire.respond(status, {"message": "x"})

    assert steps_service.get_personality_quiz("l-1", "u-1", session()) is None


def test_a_quiz_lookup_with_an_empty_list_returns_none(internal_wire):
    internal_wire.respond(200, {"data": {"data": []}})

    assert steps_service.get_personality_quiz("l-1", "u-1", session()) is None


def test_a_personality_quiz_is_created_through_the_internal_route_and_the_envelope_is_returned(internal_wire):
    internal_wire.respond(201, {"success": True, "data": {"id": "q-1"}})
    payload = {"userId": "u-1", "lessonId": "l-1", "title": "Kuis", "questions": [], "userAttempt": "JSON_NULL"}

    envelope = steps_service.create_personality_quiz(payload, session())

    prepared = internal_wire.sent[0]
    assert envelope == {"success": True, "data": {"id": "q-1"}}
    assert prepared.method == "POST"
    assert prepared.url.endswith("/internal/personality-quizzes")
    assert internal_wire.json_of(prepared) == payload
    assert prepared.headers["x-idempotency-key"]
