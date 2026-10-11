from __future__ import annotations

from config.agent_session import mint_session
from v1.learning import service as learning_service


def session():
    return mint_session(acting_user_id="u-1", trace_id="trace-1", idempotency_key="request-key-0001")


def assert_signed_for_acting_user(prepared):
    assert prepared.headers["x-service-id"] == "ai-api"
    assert prepared.headers["x-service-signature"]
    assert prepared.headers["x-acting-user-id"] == "u-1"
    assert "Authorization" not in prepared.headers


def test_a_message_update_patches_the_internal_chat_message(internal_wire):
    internal_wire.respond(200, {"data": {"id": "m-1", "chatId": "c-1"}})

    data = learning_service.update_message_chat("m-1", session(), {"text": "Memproses", "status": "PROCESSING"})

    prepared = internal_wire.sent[0]
    assert data == {"id": "m-1", "chatId": "c-1"}
    assert prepared.method == "PATCH"
    assert prepared.url.endswith("/internal/chat-messages/m-1")
    assert internal_wire.json_of(prepared) == {"text": "Memproses", "status": "PROCESSING"}
    assert_signed_for_acting_user(prepared)


def test_content_history_returns_the_ranked_list_the_api_sends(internal_wire):
    ranked = [{"id": "c-1", "chatId": "chat-1", "text": "riwayat", "score": 1.0}]
    internal_wire.respond(200, {"data": ranked})

    history = learning_service.query_content_history("chat-1", "debit kredit", session())

    prepared = internal_wire.sent[0]
    assert history == ranked
    assert prepared.method == "GET"
    assert "/internal/contents/similarity?" in prepared.url
    assert "chatId=chat-1" in prepared.url
    assert "query=debit+kredit" in prepared.url
    assert_signed_for_acting_user(prepared)


def test_content_history_is_empty_when_the_api_sends_nothing(internal_wire):
    internal_wire.respond(200, {"data": None})

    assert learning_service.query_content_history("chat-1", "debit", session()) == []


def test_lesson_and_user_step_reads_use_the_internal_routes(internal_wire):
    internal_wire.respond(200, {"data": {"id": "l-1", "title": "Jurnal"}})

    lesson = learning_service.get_lesson("l-1", session())
    user_step = learning_service.get_user_step("us-1", session())

    assert lesson == {"id": "l-1", "title": "Jurnal"}
    assert user_step == {"id": "l-1", "title": "Jurnal"}
    assert internal_wire.sent[0].url.endswith("/internal/lessons/l-1")
    assert internal_wire.sent[1].url.endswith("/internal/user-steps/us-1")
    assert all(prepared.method == "GET" for prepared in internal_wire.sent)


def test_content_material_is_posted_to_the_internal_contents_route(internal_wire):
    internal_wire.respond(201, {"data": {"id": "content-1", "chatId": "chat-1"}})
    payload = {"chatId": "chat-1", "chatMessageId": "m-1", "data": "## Materi", "citations": [{"lessonId": "l-1"}]}

    data = learning_service.create_content_material(payload, session())

    prepared = internal_wire.sent[0]
    assert data == {"id": "content-1", "chatId": "chat-1"}
    assert prepared.method == "POST"
    assert prepared.url.endswith("/internal/contents")
    assert internal_wire.json_of(prepared) == payload
    assert prepared.headers["x-idempotency-key"]
    assert_signed_for_acting_user(prepared)


def test_no_function_of_the_module_builds_its_own_http_request():
    assert not hasattr(learning_service, "requests")
    assert not hasattr(learning_service, "create_message_chat")
