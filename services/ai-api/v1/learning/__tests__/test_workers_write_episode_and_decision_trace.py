from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from celery.exceptions import Reject

from errors.types import LLMError

CHAT_PAYLOAD = {
    "chatId": "c-1",
    "userStepId": "us-1",
    "messageId": "m-1",
    "userId": "u-1",
    "query": "continue",
    "session_id": "sess-1",
    "acting_user_id": "u-1",
    "tenant_id": "tenant-1",
    "trace_id": "trace-1",
    "idempotency_key": "k-1",
}


def _generated_state():
    state = MagicMock()
    state.get.side_effect = lambda key: {
        "generate": {
            "chatId": "c-1",
            "chatMessageId": "m-1",
            "data": "ok",
            "citations": [{"lessonId": "l-1", "score": 0.9}],
            "metadata": {"topicId": "t-1"},
        }
    }.get(key)
    state.session_id = "sess-1"
    state.acting_user_id = "u-1"
    state.tenant_id = "tenant-1"
    state.trace_id = "trace-1"
    state.idempotency_key = "k-1"
    state.lesson_id = "l-1"
    state.step_id = "s-1"
    state.topic_id = "t-1"
    return state


def test_generate_content_material_worker_writes_episode_and_decision_trace():
    from v1.learning import workers

    state = _generated_state()

    with patch.object(workers, "GenerateContentMaterialPipeline", return_value=state), patch.object(
        workers, "generate_content_material_pipeline", return_value=state
    ), patch.object(workers, "write_episode") as write_episode, patch.object(
        workers, "write_decision_trace"
    ) as write_decision_trace, patch.object(workers, "create_content_material") as create_content:
        workers.generate_content_material_task.run(
            {
                "userId": "u-1",
                "stepId": "s-1",
                "userStepId": "us-1",
                "topicId": "t-1",
                "lessonId": "l-1",
                "learningStyleId": "ls-1",
                "messageId": "m-1",
                "chatId": "c-1",
                "session_id": "sess-1",
                "acting_user_id": "u-1",
                "tenant_id": "tenant-1",
                "trace_id": "trace-1",
                "idempotency_key": "k-1",
            }
        )

    assert create_content.call_count == 1
    assert write_episode.call_count == 1
    assert write_decision_trace.call_count == 1
    assert write_episode.call_args.args[0].citations[0].lesson_id == "l-1"


def test_chat_worker_reads_the_ids_the_router_sends_and_records_the_turn(scripted_llm):
    from v1.learning import workers

    fake_pipeline = MagicMock()
    scripted_llm.reply("flash", "jawaban tutor")

    with patch.object(workers, "pipeline", fake_pipeline), patch(
        "v1.learning.service.get_propmpt_material", return_value="prompt"
    ) as build_prompt, patch.object(workers, "update_message_chat") as update, patch.object(
        workers, "write_episode"
    ) as write_episode, patch.object(workers, "write_decision_trace") as write_decision_trace:
        result = workers.generating_new_content.run(dict(CHAT_PAYLOAD))

    assert build_prompt.call_args.args[:3] == ("continue", "m-1", "us-1")
    assert update.call_args.args[0] == "m-1"
    assert update.call_args.args[2]["status"] == "COMPLETED"
    assert write_episode.call_count == 1
    assert write_decision_trace.call_count == 1
    trace = write_decision_trace.call_args.args[0]
    assert trace.policy_version == "routing-test"
    assert trace.metadata["modelMode"] == "flash"
    assert trace.metadata["escalated"] is False
    assert result["data"] == "jawaban tutor"
    assert scripted_llm.calls[0][1] == "tutor_reply"


def test_chat_worker_escalates_to_thinking_when_flash_fails_and_says_so_in_the_trace(scripted_llm):
    from v1.learning import workers

    scripted_llm.fail("flash", "gateway timeout").reply("thinking", "jawaban dalam")

    with patch.object(workers, "pipeline", MagicMock()), patch(
        "v1.learning.service.get_propmpt_material", return_value="prompt"
    ), patch.object(workers, "update_message_chat"), patch.object(workers, "write_episode"), patch.object(
        workers, "write_decision_trace"
    ) as write_decision_trace:
        result = workers.generating_new_content.run(dict(CHAT_PAYLOAD))

    trace = write_decision_trace.call_args.args[0]
    assert result["data"] == "jawaban dalam"
    assert trace.metadata["modelMode"] == "thinking"
    assert trace.metadata["escalated"] is True
    assert trace.metadata["modelAttempts"] == 2


def test_chat_worker_marks_the_message_failed_instead_of_faking_a_completed_answer(scripted_llm):
    from v1.learning import workers

    fake_pipeline = MagicMock()
    scripted_llm.fail("flash", "provider down").fail("thinking", "provider down")

    with patch.object(workers, "pipeline", fake_pipeline), patch(
        "v1.learning.service.get_propmpt_material", return_value="prompt"
    ), patch.object(workers, "update_message_chat") as update, patch.object(
        workers, "write_episode"
    ) as write_episode:
        with pytest.raises(LLMError):
            workers.generating_new_content.run(dict(CHAT_PAYLOAD))

    assert update.call_args.args[2]["status"] == "FAILED"
    assert all(call.args[2]["status"] != "COMPLETED" for call in update.call_args_list)
    write_episode.assert_not_called()


@pytest.mark.parametrize("missing", ["chatId", "userStepId", "messageId", "query"])
def test_chat_worker_rejects_a_payload_missing_required_fields(missing):
    from v1.learning import workers

    payload = {k: v for k, v in CHAT_PAYLOAD.items() if k != missing}

    with patch.object(workers, "update_message_chat") as update:
        with pytest.raises(Reject):
            workers.generating_new_content.run(payload)

    update.assert_not_called()
