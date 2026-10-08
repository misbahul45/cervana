from __future__ import annotations

from unittest.mock import MagicMock, patch


def test_generate_content_material_task_payload_must_not_contain_token():
    from v1.learning import workers

    sent = {}

    def fake_delay(payload):
        sent["payload"] = payload
        fake = MagicMock()
        fake.id = "task-1"
        return fake

    with patch.object(workers.generate_content_material_task, "delay", side_effect=fake_delay):
        from config.agent_session import mint_session
        from v1.learning.dto import GenerateContentMaterialPipeline

        session = mint_session(acting_user_id="u-1", idempotency_key="k-1")
        state = GenerateContentMaterialPipeline(
            user_id="u-1",
            step_id="s-1",
            user_step_id="us-1",
            topic_id="t-1",
            lesson_id="l-1",
            learning_style_id="ls-1",
            message_id="m-1",
            chat_id="c-1",
            session_id=session.session_id,
            acting_user_id=session.acting_user_id,
            tenant_id=session.tenant_id,
            trace_id=session.trace_id,
            idempotency_key=session.idempotency_key,
        )
        workers.generate_content_material_task.delay(
            {**state.model_dump(), **session.to_dict()}
        )

    payload = sent["payload"]
    forbidden = {"token", "bearer", "authorization", "password"}
    keys_lower = {k.lower() for k in payload.keys()}
    assert not (keys_lower & forbidden), f"bearer-shaped keys leaked: {payload}"


def test_generating_new_content_payload_must_not_contain_token():
    from v1.learning import workers

    sent = {}

    def fake_delay(payload):
        sent["payload"] = payload
        fake = MagicMock()
        fake.id = "task-2"
        return fake

    with patch.object(workers.generating_new_content, "delay", side_effect=fake_delay):
        from config.agent_session import mint_session

        session = mint_session(acting_user_id="u-2")
        workers.generating_new_content.delay(
            {
                "chatId": "c-2",
                "userStepId": "us-2",
                "messageId": "m-2",
                "userId": session.acting_user_id,
                "query": "continue",
                **session.to_dict(),
            }
        )

    payload = sent["payload"]
    forbidden = {"token", "bearer", "authorization", "password"}
    keys_lower = {k.lower() for k in payload.keys()}
    assert not (keys_lower & forbidden), f"bearer-shaped keys leaked: {payload}"