# Executive Summary

> **Status**: `planned` · **Owner**: `owner` · **Last reviewed**: `2026-10-02`
>
> One page: where ReduCera stands, what to decide first, what to build in order, what to leave out, and the next action; evidence is in [`01-verification-delta.md`](./01-verification-delta.md).

## Current state

1. The commerce side is built on the API: 273 routes with 0 undecided, orders, manual payment, entitlements, wallet, payout, refund, article and class authoring and moderation [VERIFIED: VD HC-01, HC-03, HC-04].
2. The learning side is not wired: mastery, AI credits, the accounting engine and evaluation exist as services with no route, and three of them have defects that mock tests do not catch [VERIFIED: VD VF-01 to VF-04].
3. `ai-api` is unchanged at 6 routes; 4 of them do not validate the caller, and the jobs from `api` cannot reach it because `AI_URL` is defined nowhere [VERIFIED: VD VF-07, VF-16].
4. A browser cannot reach the services as configured: nginx strips `/api/` and `/ai/`, and the new marketplace and checkout pages call URLs the API does not serve [VERIFIED: VD HC-14, HC-15].
5. Tests without a database: API 54 of 65 suites pass, 11 skipped, 0 failed (900 tests pass, 143 skipped); web 21 pass; `ai-api` light environment 59 pass and 8 fail on missing dependencies [VERIFIED: VD §9].

## Five decisions to make first

| Order | Decision | Default used | Why first |
|---|---|---|---|
| 1 | D-01 launch segment | University accounting students | Gates copy, onboarding and the minors question (D-02); the 2026-09-30 note says generic with minors, the repo and copy guard say university |
| 2 | D-08 mastery model | Elo-like, corrected, with magnitude tests | The current formula moves a score from 0.4 to 1.0 in one answer (VF-02) |
| 3 | D-05 money policy | Hold at least the 7-day refund window; full refunds only | Today earnings can leave before refunds close |
| 4 | D-12 reviewer actor | Capability granted by `ADMIN` | Creator supply has no reviewer but `ADMIN` |
| 5 | D-13 AI call path | Credit-spending calls go through `api` | Fixes the unauthenticated routes and enables credits |

## Five bets, in order

1. Make the stack reachable and safe: nginx prefix, web URLs, caller validation on `ai-api`, a CI run of the database suites (stage 0, about 8 weeks).
2. Close the learning core: server-side scoring, corrected mastery, the sandbox with routes, UI and platform scenarios (stage 1, about 10 weeks); open the pilot here.
3. Add reviewed creator supply and the checkout and admin screens (stage 2, about 11 weeks).
4. Pass the money-out gate: scheduler, hold, payout and refund UI, backup restore drill (stage 3, about 6 weeks).
5. Ship a metered tutor with credits and the safety tests (stage 4, about 12 weeks).

Durations assume one part-time developer at 4 work units per week [ASSUMPTION: `14-roadmap.md` §3.1]; they are estimates, not measurements.

## Not to build yet

Agent marketplace, optimizer and DSPy, payment gateway, institution licences, a second vertical, quests and worlds, global leaderboards, creator-authored scenarios before the reviewer queue exists.

## Single next action

Remove the trailing slash from the `proxy_pass` lines of `location /api/` and `location /ai/` in `infra/nginx/nginx.conf`, set `INTERNAL_AI_API_SECRET` and `MANUAL_PAYMENT_ACCOUNTS` in the root `.env`, bring the stack up, and record `curl http://localhost/api/v1/docs` (V1 plan task R-03).
