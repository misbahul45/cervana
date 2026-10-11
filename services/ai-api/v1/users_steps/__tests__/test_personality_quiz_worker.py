from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from config.agent_session import mint_session
from v1.users_steps import workers

USER = "c6c571d7-40ae-4998-9699-4803d04a0c57"
LESSON = "5787aef0-0df5-4395-a372-92c3b5dfec09"
TOPIC = "f43bfce7-b141-4351-9723-989d972c35f0"
STYLE = "496acf8a-3491-4f04-bb9a-7f9c66ff30be"


def _payload():
    session = mint_session(acting_user_id=USER, trace_id="trace-1", idempotency_key="key-1")
    return {
        "userId": USER,
        "lessonId": LESSON,
        "topicId": TOPIC,
        "learningStyleId": STYLE,
        **session.to_dict(),
    }


def _question():
    return SimpleNamespace(question="Apa itu aset?", type="input", difficulty="easy", options=[], answer="Harta")


def _run(payload):
    graph = MagicMock()
    graph.invoke.return_value = {"quiz": [_question()]}
    create = MagicMock()
    with (
        patch.object(workers, "graph", graph),
        patch.object(workers, "create_personality_quiz", create),
        patch.object(workers, "write_episode"),
        patch.object(workers, "write_decision_trace"),
    ):
        questions = workers.generate_personality_quiz.run(payload)
    return graph, create, questions


def test_graph_receives_field_named_state_so_langgraph_can_read_the_ids():
    graph, _, _ = _run(_payload())

    state = graph.invoke.call_args.args[0]

    assert state["topic_id"] == TOPIC
    assert state["lesson_id"] == LESSON
    assert state["learning_style_id"] == STYLE
    assert state["acting_user_id"] == USER
    assert "topicId" not in state


def test_quiz_is_saved_for_the_lesson_of_the_request():
    _, create, questions = _run(_payload())

    saved = create.call_args.kwargs["payload"]

    assert saved["lessonId"] == LESSON
    assert saved["userId"] == USER
    assert saved["questions"][0]["question"] == "Apa itu aset?"
    assert len(questions) == 1
