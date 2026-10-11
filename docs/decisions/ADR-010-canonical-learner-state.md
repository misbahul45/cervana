# ADR-010: One mastery model and one adaptive policy

- Status: accepted by the owner on 2026-10-09 (Q-04 of `docs/01-audit/implementation-readiness.md`)
- Date: 2026-10-09

## Context

Learner state is implemented several times with different ids: two `MasteryService`, two `AdaptivePolicyService` and two misconception services in `api`, plus Python variants in `ai-api`. Only `dominantStyle` reaches the live tutor prompt, and six learner-state tables have no reader or writer (`docs/01-audit/personalization-audit.md`, finding M-004 and H-006).

## Decision

1. One mastery implementation, owned by `api`, updated from recorded learning events (event-sourced), so a score can be recomputed from its events.
2. One adaptive policy, owned by `api`, returning typed reason codes with every recommendation.
3. The duplicate implementations are deleted or folded into the two above. Until each is removed, none is extended.
4. The mastery formula itself stays open as D-08 in `docs/strategy/decision-register.md` (Elo-like proposed); this ADR fixes where it lives, not which formula.

## Consequences

- `LearnerStateSnapshot` and the learning-event writer (audit row 3) are designed against these two services.
- Python mastery and policy code in `ai-api` becomes reference material and is not wired.
- Needs ADR-009 first, because mastery records are keyed by topic id.
