from __future__ import annotations

from unittest.mock import MagicMock, patch

from config.agent_session import mint_session
from v1.episodes.dto import EpisodeCreate


def test_write_episode_posts_to_internal_api():
    from v1.episodes import service as episodes_service

    sent = {}

    def fake_post(url, json=None, headers=None, timeout=None):
        sent["url"] = url
        sent["json"] = json
        sent["headers"] = headers
        sent["timeout"] = timeout
        response = MagicMock()
        response.status_code = 201
        response.text = ""
        return response

    session = mint_session(acting_user_id="u-1", idempotency_key="k-1")
    episode = EpisodeCreate(
        trace_id=session.trace_id,
        session_id=session.session_id,
        acting_user_id=session.acting_user_id,
        tenant_id=session.tenant_id,
        idempotency_key=session.idempotency_key,
        agent="tutor_agent",
        intent="tutor",
        task="generate-material",
        response_excerpt="hello",
    )

    with patch("v1.episodes.service.requests.post", side_effect=fake_post):
        status = episodes_service.write_episode(episode, session=session)

    assert status == 201
    assert sent["url"].endswith("/internal/episodes")
    assert "Authorization" not in sent["headers"]
    assert sent["headers"]["x-acting-user-id"] == "u-1"
    assert sent["headers"]["x-trace-id"] == session.trace_id
    assert "token" not in sent["json"]


def test_write_episode_rejects_bearer_shaped_payload():
    from v1.episodes import service as episodes_service

    session = mint_session(acting_user_id="u-1", idempotency_key="k-2")
    episode = EpisodeCreate(
        trace_id=session.trace_id,
        session_id=session.session_id,
        acting_user_id=session.acting_user_id,
        tenant_id=session.tenant_id,
        idempotency_key=session.idempotency_key,
        agent="tutor_agent",
        intent="tutor",
    )

    from unittest.mock import patch

    def fake_check_bearer(payload):
        return True

    with patch.object(episodes_service, "_payload_has_bearer", side_effect=fake_check_bearer):
        try:
            episodes_service.write_episode(episode, session=session)
        except ValueError:
            return
    raise AssertionError("expected ValueError when payload contains bearer-shaped keys")


def test_write_episode_raises_on_5xx():
    from v1.episodes import service as episodes_service
    from errors.types import CrossServiceError

    session = mint_session(acting_user_id="u-1", idempotency_key="k-3")
    episode = EpisodeCreate(
        trace_id=session.trace_id,
        session_id=session.session_id,
        acting_user_id=session.acting_user_id,
        tenant_id=session.tenant_id,
        idempotency_key=session.idempotency_key,
        agent="tutor_agent",
        intent="tutor",
    )

    response = MagicMock()
    response.status_code = 500
    response.text = "boom"

    with patch("v1.episodes.service.requests.post", return_value=response):
        try:
            episodes_service.write_episode(episode, session=session)
        except CrossServiceError:
            return
    raise AssertionError("expected CrossServiceError on 5xx")