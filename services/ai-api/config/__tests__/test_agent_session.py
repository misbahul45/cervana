from __future__ import annotations


from config.agent_session import (
    AgentSession,
    mint_session,
    session_payload_is_safe,
)


def test_mint_session_mints_uuid():
    session = mint_session(acting_user_id="u-1")
    assert isinstance(session, AgentSession)
    assert session.session_id
    assert session.acting_user_id == "u-1"
    assert session.tenant_id
    assert session.trace_id
    assert session.idempotency_key


def test_mint_session_rejects_empty_user_id():
    try:
        mint_session(acting_user_id="")
    except ValueError:
        return
    raise AssertionError("expected ValueError for empty acting_user_id")


def test_session_payload_is_safe_blocks_bearer_shaped_keys():
    assert session_payload_is_safe({"session_id": "s"}) is True
    assert session_payload_is_safe({"token": "x"}) is False
    assert session_payload_is_safe({"Authorization": "Bearer x"}) is False
    assert session_payload_is_safe({"bearer": "x"}) is False
    assert session_payload_is_safe({"password": "x"}) is False
    assert session_payload_is_safe({"secret": "x"}) is False


def test_session_to_dict_round_trip():
    session = mint_session(acting_user_id="u-2", trace_id="t-2", idempotency_key="k-2")
    d = session.to_dict()
    restored = AgentSession(**d)
    assert restored.session_id == session.session_id
    assert restored.acting_user_id == session.acting_user_id
    assert restored.trace_id == session.trace_id
    assert restored.idempotency_key == session.idempotency_key