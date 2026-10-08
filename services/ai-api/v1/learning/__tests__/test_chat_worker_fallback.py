from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from errors.types import LLMError

PAYLOAD = {
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


def test_llm_failure_surfaces_as_llm_error_without_a_name_error(scripted_llm):
    from v1.learning import workers

    pipeline = MagicMock()
    scripted_llm.fail("flash", "simulated LLM failure").fail("thinking", "simulated LLM failure")

    with patch.object(workers, "pipeline", pipeline), patch(
        "v1.learning.service.get_propmpt_material", return_value="prompt"
    ), patch.object(workers, "update_message_chat"):
        with pytest.raises(LLMError) as raised:
            workers.generating_new_content.run(dict(PAYLOAD))

    assert "user_step_title" not in str(raised.value)
