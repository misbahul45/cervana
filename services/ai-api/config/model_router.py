from __future__ import annotations

import logging
import re
import threading
import time
from collections import deque
from dataclasses import dataclass, field
from types import MappingProxyType
from typing import Any, Callable, Mapping, Sequence

from langchain_core.messages import HumanMessage

from config import llm_registry
from errors.types import LLMError

logger = logging.getLogger("model_router")

MODES = ("flash", "thinking")

DEFAULT_TASK_MODES: Mapping[str, str] = MappingProxyType(
    {
        "tutor_reply": "flash",
        "hint": "flash",
        "rationale": "flash",
        "quiz_generation": "flash",
        "free_text_judge": "flash",
        "assessment_tagging": "flash",
        "career_mapping": "flash",
        "learner_analysis": "flash",
        "context_summary": "flash",
        "translation": "flash",
        "personality_quiz": "flash",
        "lesson_content": "thinking",
        "path_planning": "thinking",
        "scenario_drafting": "thinking",
        "creator_assist": "thinking",
    }
)

REASONING_CUES = re.compile(
    r"\b(bandingkan|compare|hitung|calculate|analisis|analyze|analyse|mengapa|why|buktikan|prove|"
    r"rancang|design|langkah|step|koreksi|rekonsiliasi|reconcile|evaluasi|evaluate)\b",
    re.IGNORECASE,
)

WORD_SATURATION = 120
CUE_SATURATION = 3
TOOL_SATURATION = 4
CONTEXT_SATURATION_CHARS = 8000
HISTORY_SATURATION_TURNS = 10

WEIGHT_LENGTH = 0.30
WEIGHT_CUES = 0.25
WEIGHT_TOOLS = 0.20
WEIGHT_CONTEXT = 0.15
WEIGHT_HISTORY = 0.10


def _ratio(value: float, saturation: float) -> float:
    return max(0.0, min(value / saturation, 1.0))


def estimate_complexity(
    query: str,
    *,
    tool_count: int = 0,
    context_chars: int = 0,
    history_turns: int = 0,
) -> float:
    text = query or ""
    words = len(text.split())
    cues = len(REASONING_CUES.findall(text))
    score = (
        WEIGHT_LENGTH * _ratio(words, WORD_SATURATION)
        + WEIGHT_CUES * _ratio(cues, CUE_SATURATION)
        + WEIGHT_TOOLS * _ratio(tool_count, TOOL_SATURATION)
        + WEIGHT_CONTEXT * _ratio(context_chars, CONTEXT_SATURATION_CHARS)
        + WEIGHT_HISTORY * _ratio(history_turns, HISTORY_SATURATION_TURNS)
    )
    return round(max(0.0, min(score, 1.0)), 4)


@dataclass(frozen=True)
class RoutingPolicy:
    version: str
    task_modes: Mapping[str, str] = field(default_factory=lambda: dict(DEFAULT_TASK_MODES))
    default_mode: str = "flash"
    escalate_above: float = 0.7
    allow_failure_escalation: bool = True
    max_escalations: int = 1

    def __post_init__(self) -> None:
        if not self.version:
            raise ValueError("RoutingPolicy.version is required")
        if self.default_mode not in MODES:
            raise ValueError(f"default_mode must be one of {MODES}")
        for task, mode in self.task_modes.items():
            if mode not in MODES:
                raise ValueError(f"task {task} has invalid mode {mode}")
        if not 0.0 <= self.escalate_above <= 1.0:
            raise ValueError("escalate_above must be within [0, 1]")
        if self.max_escalations < 0:
            raise ValueError("max_escalations must not be negative")

    def mode_for(self, task: str) -> str:
        return self.task_modes.get(task, self.default_mode)

    def to_dict(self) -> dict[str, Any]:
        return {
            "version": self.version,
            "taskModes": dict(self.task_modes),
            "defaultMode": self.default_mode,
            "escalateAbove": self.escalate_above,
            "allowFailureEscalation": self.allow_failure_escalation,
            "maxEscalations": self.max_escalations,
        }


@dataclass(frozen=True)
class RoutingDecision:
    task: str
    mode: str
    reason: str
    policy_version: str
    complexity: float


@dataclass(frozen=True)
class Attempt:
    mode: str
    ok: bool
    error: str | None
    latency_ms: float

    def to_dict(self) -> dict[str, Any]:
        return {"mode": self.mode, "ok": self.ok, "error": self.error, "latencyMs": self.latency_ms}


@dataclass(frozen=True)
class RoutedResult:
    text: str
    mode: str
    escalated: bool
    attempts: tuple[Attempt, ...]
    policy_version: str
    complexity: float


@dataclass(frozen=True)
class RoutingOutcome:
    task: str
    complexity: float
    first_mode: str
    final_mode: str
    escalated: bool
    ok: bool
    attempts: int
    latency_ms: float
    policy_version: str = ""


class OutcomeLog:
    def __init__(self, capacity: int = 1000) -> None:
        self._items: deque[RoutingOutcome] = deque(maxlen=capacity)
        self._lock = threading.Lock()

    def record(self, outcome: RoutingOutcome) -> None:
        with self._lock:
            self._items.append(outcome)

    def snapshot(self) -> list[RoutingOutcome]:
        with self._lock:
            return list(self._items)

    def clear(self) -> None:
        with self._lock:
            self._items.clear()


ModelFactory = Callable[[str, str | None], Any]
PolicySource = RoutingPolicy | Callable[[str], RoutingPolicy]
Validator = Callable[[str], bool]


def _registry_factory(mode: str, route: str | None = None) -> Any:
    return llm_registry.get_chat_model(mode, route)


class ModelRouter:
    def __init__(
        self,
        policy: PolicySource,
        *,
        model_factory: ModelFactory | None = None,
        outcomes: OutcomeLog | None = None,
        clock: Callable[[], float] = time.perf_counter,
    ) -> None:
        self._policy = policy
        self._factory = model_factory or _registry_factory
        self._clock = clock
        self.outcomes = outcomes if outcomes is not None else OutcomeLog()

    def policy_for(self, subject: str = "") -> RoutingPolicy:
        if isinstance(self._policy, RoutingPolicy):
            return self._policy
        return self._policy(subject)

    def decide(
        self,
        task: str,
        *,
        query: str = "",
        complexity: float | None = None,
        tool_count: int = 0,
        context_chars: int = 0,
        history_turns: int = 0,
        subject: str = "",
    ) -> RoutingDecision:
        policy = self.policy_for(subject)
        score = (
            complexity
            if complexity is not None
            else estimate_complexity(query, tool_count=tool_count, context_chars=context_chars, history_turns=history_turns)
        )
        base = policy.mode_for(task)
        if base == "flash" and score >= policy.escalate_above:
            return RoutingDecision(
                task=task,
                mode="thinking",
                reason=f"complexity {score:.2f} >= {policy.escalate_above:.2f}",
                policy_version=policy.version,
                complexity=score,
            )
        return RoutingDecision(
            task=task,
            mode=base,
            reason=f"task {task} maps to {base}",
            policy_version=policy.version,
            complexity=score,
        )

    def invoke(
        self,
        task: str,
        messages: str | Sequence[Any],
        *,
        query: str = "",
        validator: Validator | None = None,
        complexity: float | None = None,
        tool_count: int = 0,
        context_chars: int = 0,
        history_turns: int = 0,
        subject: str = "",
        **model_kwargs: Any,
    ) -> RoutedResult:
        if isinstance(messages, str):
            messages = [HumanMessage(content=messages)]
        policy = self.policy_for(subject)
        decision = self.decide(
            task,
            query=query,
            complexity=complexity,
            tool_count=tool_count,
            context_chars=context_chars,
            history_turns=history_turns,
            subject=subject,
        )
        attempts: list[Attempt] = []
        mode = decision.mode
        escalations = 0

        while True:
            attempt, text = self._attempt(mode, task, messages, validator, model_kwargs)
            attempts.append(attempt)
            if attempt.ok:
                result = RoutedResult(
                    text=text,
                    mode=mode,
                    escalated=mode != decision.mode,
                    attempts=tuple(attempts),
                    policy_version=policy.version,
                    complexity=decision.complexity,
                )
                self._record(decision, result.mode, attempts, ok=True)
                return result

            can_escalate = (
                mode == "flash"
                and policy.allow_failure_escalation
                and escalations < policy.max_escalations
            )
            if not can_escalate:
                break
            escalations += 1
            mode = "thinking"
            logger.warning("task=%s escalating flash -> thinking after %s", task, attempt.error)

        self._record(decision, mode, attempts, ok=False)
        raise LLMError(
            "LLM call failed in every permitted mode",
            details={
                "task": task,
                "policyVersion": policy.version,
                "attempts": [a.to_dict() for a in attempts],
            },
        )

    def _attempt(
        self,
        mode: str,
        task: str,
        messages: Sequence[Any],
        validator: Validator | None,
        model_kwargs: Mapping[str, Any],
    ) -> tuple[Attempt, str]:
        started = self._clock()
        error: str | None = None
        text = ""
        try:
            model = self._factory(mode, task)
            text = llm_registry.message_text(model.invoke(list(messages), **model_kwargs))
            if not text:
                error = "EMPTY_OUTPUT"
            elif validator is not None and not validator(text):
                error = "REJECTED_BY_VALIDATOR"
        except Exception as exc:
            error = type(exc).__name__
        latency = round((self._clock() - started) * 1000.0, 3)
        ok = error is None
        return Attempt(mode=mode, ok=ok, error=error, latency_ms=latency), text if ok else ""

    def _record(self, decision: RoutingDecision, final_mode: str, attempts: Sequence[Attempt], *, ok: bool) -> None:
        self.outcomes.record(
            RoutingOutcome(
                task=decision.task,
                complexity=decision.complexity,
                first_mode=decision.mode,
                final_mode=final_mode,
                escalated=final_mode != decision.mode,
                ok=ok,
                attempts=len(attempts),
                latency_ms=round(sum(a.latency_ms for a in attempts), 3),
                policy_version=decision.policy_version,
            )
        )


_router_lock = threading.Lock()
_router: ModelRouter | None = None


def get_router() -> ModelRouter:
    global _router
    with _router_lock:
        if _router is None:
            _router = ModelRouter(RoutingPolicy(version="routing-v1"))
        return _router


def configure_router(router: ModelRouter | None) -> None:
    global _router
    with _router_lock:
        _router = router
