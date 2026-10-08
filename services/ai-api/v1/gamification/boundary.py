from __future__ import annotations

import re


FORBIDDEN_ROUTES = (
    "/v1/gamify/rewards",
    "/v1/gamify/streaks",
    "/v1/gamify/leaderboards",
    "/v1/gamify/badges",
    "/v1/gamify/levels",
    "/v1/gamify/themes",
    "/v1/gamify/daily-logs",
    "/v1/gamify/rewards/mint",
    "/v1/gamify/rewards/reverse",
    "/v1/gamify/streaks/increment",
    "/v1/gamify/streaks/reset",
    "/v1/gamify/leaderboards/update",
    "/v1/gamify/badges/grant",
    "/v1/gamify/levels/update",
)


_FORBIDDEN_PATTERNS = [
    re.compile(re.escape(route)) for route in FORBIDDEN_ROUTES
]


def contains_forbidden_call(text: str) -> bool:
    if not text:
        return False
    for regex in _FORBIDDEN_PATTERNS:
        if regex.search(text):
            return True
    return False


def ai_attempted_mint(text: str) -> bool:
    patterns = [
        re.compile(r"mint\s+xp", re.IGNORECASE),
        re.compile(r"grant\s+xp", re.IGNORECASE),
        re.compile(r"grant\s+stars?", re.IGNORECASE),
        re.compile(r"grant\s+badge", re.IGNORECASE),
        re.compile(r"grant\s+a\s+badge", re.IGNORECASE),
        re.compile(r"increase\s+streak", re.IGNORECASE),
        re.compile(r"reset\s+streak", re.IGNORECASE),
        re.compile(r"update\s+leaderboard", re.IGNORECASE),
        re.compile(r"award\s+badge", re.IGNORECASE),
        re.compile(r"add\s+xp", re.IGNORECASE),
        re.compile(r"reward\s+the\s+user\s+xp", re.IGNORECASE),
    ]
    for pattern in patterns:
        if pattern.search(text):
            return True
    return False


def assert_ai_only_narrates(text: str) -> None:
    if contains_forbidden_call(text):
        raise BoundaryViolation(
            "AI attempted to call an authoritative gamification route; "
            "ai-api must only NARRATE rewards, never call /v1/gamify/*"
        )
    if ai_attempted_mint(text):
        raise BoundaryViolation(
            "AI attempted to fabricate a reward (mint/grant/streak); "
            "ai-api must only NARRATE rewards, never mint XP"
        )


class BoundaryViolation(RuntimeError):
    pass


__all__ = [
    "FORBIDDEN_ROUTES",
    "contains_forbidden_call",
    "ai_attempted_mint",
    "assert_ai_only_narrates",
    "BoundaryViolation",
]