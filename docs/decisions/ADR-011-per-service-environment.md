# ADR-011: Per-service environment allow-lists

- Status: accepted by the owner on 2026-10-09 (Q-06 of `docs/01-audit/implementation-readiness.md`) and implemented the same day in `docker-compose.yml` and `docker-compose.prod.yml`
- Date: 2026-10-09

## Context

`env_file: .env` gives every container every variable. At runtime `api` holds `OPENAI_API_KEY` and `HF_TOKEN`, `ai-api` and `celery-worker` hold `DATABASE_URL` and the JWT secrets, and `web` holds all of them (`docs/01-audit/security-audit.md`, finding C-004). The source code respects the service ownership rules in `AGENTS.md`; the runtime environment does not.

## Decision

1. The single root `.env` stays the only environment file. No `.env` is created in a service directory.
2. `docker-compose.yml` and `docker-compose.prod.yml` stop using `env_file` for every service. Each service lists the variables it needs under `environment:`. `ai-api` and `celery-worker` run the same code and share the list `x-ai-runtime-environment` (a YAML anchor), so the two cannot drift again; before this change the worker lacked ten variables its code reads (the LLM models, `TAVILY_API_KEY`, `QDRANT_API_KEY`, `WEB_URL`, `ADMIN_URL`, `LOG_LEVEL`).

Constraints derived from the ownership table in `AGENTS.md`, implemented and enforced by `scripts/check-compose-env.py` (run from `scripts/check-ownership-rules.sh`); the owner has not confirmed them separately from the decision above:

- `ai-api` and `celery-worker` receive no `DATABASE_URL` and no JWT secret. `api` receives no LLM or embedding credential. `web` receives only `NUXT_*`, `PUBLIC_*` and the internal API URL.
- `INTERNAL_AI_API_SECRET` is listed for `api`, `ai-api` and `celery-worker` only.
- A service block that sets `env_file`, or a variable that does not belong to the service, fails `scripts/check-ownership-rules.sh`.

## Consequences

- A variable that is not listed reaches the container unset, and the code then falls back to its own default (as the worker did with the LLM models). The gate cannot see a variable the code reads but the list omits; that is why a new variable needs the two edits below.
- Adding a variable needs two edits: `.env.example` and the service's `environment:` list.
- Rolling this out needs a recreate of every application container; use `--no-deps` for services whose dependencies are healthy.
