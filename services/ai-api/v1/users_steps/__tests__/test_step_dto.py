from __future__ import annotations

from v1.learning.dto import LessonBase
from v1.users_steps.dto import StepBase

TIMESTAMP = "2026-10-08T07:44:32.995Z"


def _step(**overrides):
    payload = {
        "id": "s-1",
        "title": "Debit",
        "description": None,
        "sortOrder": 1,
        "lessonId": "l-1",
        "createdAt": TIMESTAMP,
        "updatedAt": TIMESTAMP,
    }
    payload.update(overrides)
    return payload


def _lesson(**overrides):
    payload = {
        "id": "l-1",
        "title": "Apa itu akuntansi",
        "subTopicId": "st-1",
    }
    payload.update(overrides)
    return payload


def test_step_without_theme_is_accepted():
    step = StepBase.model_validate(_step(themeId=None))

    assert step.theme_id is None


def test_step_without_theme_key_is_accepted():
    step = StepBase.model_validate(_step())

    assert step.theme_id is None


def test_step_keeps_theme_id_when_present():
    step = StepBase.model_validate(_step(themeId="t-1"))

    assert step.theme_id == "t-1"


def test_lesson_without_theme_is_accepted():
    lesson = LessonBase.model_validate(_lesson(themeId=None))

    assert lesson.theme_id is None


def test_lesson_keeps_theme_id_when_present():
    lesson = LessonBase.model_validate(_lesson(themeId="t-1"))

    assert lesson.theme_id == "t-1"
