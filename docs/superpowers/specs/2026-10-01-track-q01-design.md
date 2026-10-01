# Track Q-01 — Fix 4 pre-existing test_rate_limit failures

> **Status**: `draft` · **Owner**: `executor` · **Last reviewed**: `2026-10-01`
>
> Companion to [`docs/plans/reducera-v1-execution-plan.md`](../../plans/reducera-v1-execution-plan.md) §8.10.
> Scopes only Q-01. Other Q tasks (Q-02 `llama_index` missing, Q-03 `__init__.py` already present, Q-04 `vitest` already configured) are out of scope.

---

## 1. Context

Track Q is the quality/tests track. The execution plan §8.10 specifies four Q tasks:

- Q-01 Fix 4 pre-existing `test_rate_limit` failures (bucket starts full, burst does not bound initial allowance): **incomplete**. `cd services/ai-api && pytest config/__tests__/test_rate_limit.py` reports `4 failed, 2 passed`.
- Q-02 Fix cross-lesson memory fallback bug (out of scope; `llama_index` missing causes `test_memory.py` collection error — separate issue).
- Q-03 Add `__init__.py` to `__tests__/` packages: **already complete**. Both `services/ai-api/config/__tests__/__init__.py` and `services/ai-api/utils/tools/__tests__/__init__.py` exist.
- Q-04 Vitest for `apps/web`: **already complete**. `apps/web/vitest.config.ts` exists; `apps/web/package.json` declares `"test": "vitest run"`.

This spec closes Q-01.

---

## 2. Goal

`pytest config/__tests__/test_rate_limit.py` reports `6 passed, 0 failed` (was `4 failed, 2 passed`).

---

## 3. Scope

### 3.1 In scope

- Modify the rate-limiter implementation (likely `services/ai-api/config/rate_limit.py`) so the bucket starts with `capacity - burst` tokens (standard token-bucket semantics: capacity is steady-state, burst is one-shot above steady state). This ensures the first `burst + 1` requests within one window are correctly rate-limited.
- If existing tests assume a different semantic (e.g., bucket starts full at `capacity`), update the test expectations to match the new standard semantics. Do not change test assertions silently; read each failing test and update the asserted `last_refill` / `tokens` / status code to match the new bucket-start-full-at-zero-burst behavior.
- No new files. No changes to the public decorator signature.

### 3.2 Out of scope

- Q-02 (`llama_index` missing). Not in scope here.
- Q-03, Q-04 (already complete).
- New rate-limit policies or features. No new headers, no new metrics, no new storage backends.
- Production `pyproject.toml` dependency changes (the test runs in a `uv run --no-project` env that already includes `requests`, `fastapi`, `python-dotenv`, `pydantic`, `httpx`).

### 3.3 Constraints

| Source | Rule |
|---|---|
| `AGENTS.md` | No comments in code, Dockerfiles, compose, nginx, or config files |
| `AGENTS.md` | Never `git add`, `git commit`, `git push`, `git reset --hard`, `git rebase`, `git stash drop`, `git stash`. Stage and commit are owner actions |
| `AGENTS.md` | No secrets in tracked files, docs, or logs |
| `AGENTS.md` | Never run `prisma format` |
| execution plan §2 | Keep each task's diff reviewable; < ~400 lines |

---

## 4. Approach

Approach A from brainstorming: the bucket starts with `capacity - burst` tokens, so `burst + 1` requests in a window trigger the 429. This is the standard token-bucket semantic. The current behavior starts the bucket at `capacity` (full), which means the first `burst` requests get through regardless of burst configuration — `burst` only takes effect after the bucket is depleted, which never happens on a fresh process.

The implementer:

1. Reads `services/ai-api/config/rate_limit.py` to understand the current bucket initialization.
2. Reads `services/ai-api/config/__tests__/test_rate_limit.py` to understand each failing test's asserted behavior.
3. Modifies the bucket constructor (or `__init__` equivalent) so `tokens = max(0, capacity - burst)`.
4. Updates test assertions (if needed) so they match the new behavior. Read each failing test carefully; do not assume the test was correct under the old buggy behavior.

---

## 5. File Structure

| File | Created or Modified | Responsibility |
|---|---|---|
| `services/ai-api/config/rate_limit.py` | Modify | Bucket initialization = `capacity - burst` |
| `services/ai-api/config/__tests__/test_rate_limit.py` | Modify (conditional) | Test assertions match new behavior |

No new files.

---

## 6. Task Detail

### 6.1 Read existing implementation

```
grep -n "tokens\s*=\|capacity\|burst\|__init__" services/ai-api/config/rate_limit.py | head -30
cat services/ai-api/config/__tests__/test_rate_limit.py
```

Identify:
- The current bucket initialization (where `tokens` is set).
- The 4 failing tests (their names and asserted state).
- The 2 passing tests (their names and asserted state) — confirm they still pass after the change.

### 6.2 Apply the fix

Open `services/ai-api/config/rate_limit.py`. In the bucket constructor (likely `__init__`), replace the line that sets `self.tokens` so it reflects the steady-state limit:

```python
self.tokens = max(0, self.capacity - self.burst)
```

If the file uses different variable names (e.g., `self._tokens`, `self.tokens_remaining`), apply the equivalent change. Do not rename variables.

If the rate limiter is implemented as a closure (not a class), find the `tokens = capacity` line and apply the same change.

### 6.3 Update test expectations (if needed)

Open `services/ai-api/config/__tests__/test_rate_limit.py`. For each of the 4 failing tests, read the assertion and determine whether the new bucket-start-at-`capacity - burst` semantic invalidates the assertion. If yes, update the assertion to match. If no, leave the test alone and rely on the fix to make it pass.

Common pattern: tests that assert "first burst requests succeed" need `burst + 1` requests to fail. Tests that assert "bucket refills over time" need the refill math to use the new starting token count.

### 6.4 Verify

| Check | Command | Expected |
|---|---|---|
| 6/6 pass | `cd services/ai-api && uv run --no-project --with pytest --with requests --with fastapi --with python-dotenv --with pydantic --with httpx pytest -q config/__tests__/test_rate_limit.py` | `6 passed` |
| Other `config/__tests__/` files unchanged | Run the same pytest but exclude `test_embedding_pipeline.py` and any other llama_index-dependent tests | no new failures |
| Production code path unaffected | Read the decorator signature in `rate_limit.py`; confirm public API unchanged | matches existing usage |

---

## 7. Risk Register

| Risk | Severity | Mitigation | Rollback |
|---|---|---|---|
| Changing `tokens = capacity` to `tokens = max(0, capacity - burst)` shifts behavior in production (not just tests) | Medium | Read the existing tests to confirm the new semantic is what they assert; if tests pass after the change, production behavior is correct | Revert to `tokens = capacity` and update tests to match (different failure mode) |
| `burst = 0` edge case (no burst) | Low | `max(0, capacity - 0) = capacity`, so behavior is unchanged when burst is 0 | n/a |
| Test infrastructure drift (uv version, pytest version) | Low | Run the verify command in the same shell that previously failed; if it passes there, it passes here | n/a |

---

## 8. Tools and Skills

### 8.1 Tools

| Tool | Use |
|---|---|
| `bash` | grep, uv run pytest |
| `read`/`edit` | Source + test changes |

### 8.2 Skills

| Skill | When |
|---|---|
| `brainstorming` | Drafting this spec |
| `writing-plans` | Next: produces implementation plan |
| `executing-plans` | Execution (inline mode chosen) |
| `verification-before-completion` | Before claiming DONE |

### 8.3 Sequencing

```
brainstorming (this spec)
  → spec self-review
  → user review
  → writing-plans
  → executing-plans
  → final report
```

---

## 9. Deliverables

1. This spec at `docs/superpowers/specs/2026-10-01-track-q01-design.md`.
2. Implementation plan at `docs/superpowers/plans/2026-10-01-track-q01-plan.md`.
3. Executed Q-01:
   - `services/ai-api/config/rate_limit.py` bucket-start fix
   - `services/ai-api/config/__tests__/test_rate_limit.py` assertion updates (if needed)
   - 6/6 tests pass
4. Final report.

---

## 10. Completion Condition

- Spec written and approved.
- Implementation plan written and approved.
- `pytest config/__tests__/test_rate_limit.py` → 6/6 pass, exit 0.
- No other `config/__tests__/` test newly fails.
- No public API change in `rate_limit.py` (decorator signature unchanged).
- No `git add`/`commit`/`push` performed by agent.
- No secrets in tracked files, docs, or logs.

---

## 11. Cross-references

- [`docs/plans/reducera-v1-execution-plan.md`](../../plans/reducera-v1-execution-plan.md) §8.10 (Track Q source of truth).
- `services/ai-api/config/rate_limit.py` (the file to fix).
- `services/ai-api/config/__tests__/test_rate_limit.py` (the test to verify).
- `AGENTS.md` (rules).
- Q-02 (out of scope; documented for owner follow-up).