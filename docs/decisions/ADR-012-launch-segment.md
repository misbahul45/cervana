# ADR-012: Launch segment

- Status: accepted by the owner on 2026-10-09 (Q-01 of `docs/01-audit/implementation-readiness.md`, D-01 of `docs/strategy/decision-register.md`)
- Date: 2026-10-09

## Context

The 2026-09-30 direction note describes a generic learning platform with accounting as the reference domain. The owner's v2 master prompt lists the launch segment as D-01 with default A (university accounting first). The two were never reconciled, and copy, onboarding and content scope depended on the answer.

## Decision

1. The launch segment is option A: university accounting students are the first learners and the first creators.
2. SMA students are a later segment. Anything that depends on minors (age gate, guardian consent, wallet, payout, creator role, public leaderboard for under-18 users) stays gated by D-02 and is not built for launch.
3. The copy guard that avoids school-level wording stays in force for launch copy.
4. This ADR fixes the first segment only. It does not change the longer-term product direction recorded on 2026-09-30.

## Consequences

- Onboarding, copy and the golden accounting graph target university-level accounting.
- D-02 (minors) is required only if the segment later widens to option B or C.
- D-08, D-05, D-12 and D-13 of the register remain `PROPOSED, owner-confirm first`.
