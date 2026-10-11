import sys
import types
from unittest.mock import MagicMock, patch

import pytest

from config.agent_session import mint_session

SESSION = mint_session(acting_user_id="user-1")

BLOCK = 'mastery_scale: score 0.50 with evidence=0 means no evidence yet\nconcept c2 "Journal Entries": score=0.62 confidence=0.05 evidence=1 prerequisites_passed=true'


def _module(name: str, **attributes) -> types.ModuleType:
    module = types.ModuleType(name)
    module.__dict__.update(attributes)
    return module


SNAPSHOT = {"concepts": [{"conceptId": "c2"}], "next": None}


@pytest.fixture()
def collaborators():
    pipeline = MagicMock()
    pipeline.retrieve.return_value = []
    memory = MagicMock()
    memory.retrieve_as_string.return_value = ""
    fakes = {
        "config.embedding_pipeline": _module("config.embedding_pipeline", get_embedding_pipeline=lambda: pipeline),
        "utils.tools.memory": _module("utils.tools.memory", memory_manager=memory),
        "utils.tools.web_search": _module("utils.tools.web_search", tool_web_search=MagicMock(return_value="")),
    }
    with patch.dict(sys.modules, fakes), patch(
        "v1.learning.service.get_user_step", return_value={"title": "Topik"}
    ), patch("v1.learning.service.update_message_chat"):
        yield pipeline


def _prompt(block: str | None, snapshot=SNAPSHOT) -> tuple[str, MagicMock, MagicMock]:
    from v1.learning import service

    with patch.object(service, "read_learner_snapshot", return_value=snapshot) as reader, patch.object(
        service, "render_snapshot_block", return_value=block or ""
    ) as renderer:
        return service.get_propmpt_material("safe query", "m", "us-1", SESSION), reader, renderer


def test_the_learner_state_block_is_part_of_the_chat_prompt_inside_its_derived_fence(collaborators):
    prompt, reader, renderer = _prompt(BLOCK)

    assert '<learner_state trust="derived">' in prompt
    section = prompt.split('<learner_state trust="derived">')[1].split("</learner_state>")[0]
    assert 'concept c2 "Journal Entries"' in section
    assert reader.call_args.kwargs == {"user_step_id": "us-1"}
    assert reader.call_args.args[0].acting_user_id == "user-1"
    assert renderer.call_args.args[1] == SNAPSHOT


def test_the_block_sits_before_the_learner_query_and_after_the_taxonomy(collaborators):
    prompt, _, _ = _prompt(BLOCK)

    assert prompt.index("</domain_taxonomy>") < prompt.index('<learner_state trust="derived">') < prompt.index("<user_input")


def test_without_a_block_the_prompt_has_no_learner_section(collaborators):
    prompt, _, _ = _prompt(None)

    assert "<learner_state" not in prompt
    assert "<domain_taxonomy" in prompt


def test_the_prompt_tells_the_model_how_to_use_the_block_as_data(collaborators):
    prompt, _, _ = _prompt(BLOCK)

    assert "learner_state" in prompt.split("</learner_state>")[1]


def test_the_chat_retrieval_runs_in_the_scope_of_the_acting_user_and_the_concepts_of_the_user_step(collaborators):
    from config.retrieval_governance import RetrievalScope

    _prompt(BLOCK)

    call = collaborators.retrieve.call_args
    assert call.kwargs["scope"] == RetrievalScope(actor_id="user-1", domain_id="ACCOUNTING", concept_ids=("c2",))
    assert call.kwargs["top_k"] == 10
    assert "metadata_filter" not in call.kwargs


def test_without_a_snapshot_the_chat_retrieval_is_domain_wide_for_the_actor(collaborators):
    _prompt("", snapshot=None)

    assert collaborators.retrieve.call_args.kwargs["scope"].concept_ids == ()


def test_a_failed_retrieval_leaves_the_prompt_without_materials_instead_of_failing_the_chat(collaborators):
    from errors.types import RetrievalError

    collaborators.retrieve.side_effect = RetrievalError("retrieval failed")

    prompt, _, _ = _prompt(BLOCK)

    assert "[No RAG materials available]" in prompt
