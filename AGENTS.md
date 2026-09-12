---
name: cervana-agents
description: Operating rules for Cervana Docker, deployment, environment, and code conventions
metadata:
  owner: cervana
  scope: project
  language: en
  authority: governing-policy
---

# CERVANA Agent Operating Rules

## Environment Variables

- Use only one `.env` file at the repository root.
- Never create `.env` files inside service subdirectories.
- Commit only `.env.example`. The real `.env` is gitignored.
- Reference variables in compose via `${VAR}` with sensible defaults.
- Never hardcode secrets in `docker-compose.yml`, `Dockerfile`, or source code.
- Rotate `COOKIE_SECRET`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` for every environment.
- Generate secrets with `openssl rand -base64 48` or `python3 -c "import secrets; print(secrets.token_urlsafe(48))"`.
- Service-to-service URLs use Docker service names (`postgres`, `redis`, `api`, `ai-api`, `qdrant`, `celery-worker`).
- Browser-facing URLs (`NUXT_PUBLIC_*`, `PUBLIC_*`) use public host (`http://localhost` or `https://cervana.example.com`).

## Service Naming Convention

| Service | Compose Name | Container Name | Internal Port | Host Port (dev) | Image (prod) |
|---|---|---|---|---|---|
| PostgreSQL | `postgres` | `cervana_postgres` | 5432 | 5433 | `postgres:15-alpine` |
| Redis | `redis` | `cervana_redis` | 6379 | 6380 | `redis:7-alpine` |
| Qdrant | `qdrant` | `cervana_qdrant` | 6333 | 6333 | `qdrant/qdrant:v1.12.4` |
| NestJS API | `api` | `cervana_api` | 3002 | 3002 | `cervana/api:<tag>` |
| FastAPI AI | `ai-api` | `cervana_ai_api` | 3003 | 3003 | `cervana/ai-api:<tag>` |
| Celery Worker | `celery-worker` | `cervana_celery_worker` | — | — | `cervana/ai-api:<tag>` |
| Nuxt Web | `web` | `cervana_web` | 3000 | 3000 | `cervana/web:<tag>` |
| SvelteKit Admin | `admin` | `cervana_admin` | 3001 | 3001 | `cervana/admin:<tag>` |
| Nginx | `nginx` | `cervana_nginx` | 80, 443 | 80, 443 | `nginx:1.27-alpine` |

## Docker Compose Rules

- Always set `restart: unless-stopped`. Never use `restart: always`.
- Every service must define `healthcheck` with `test`, `interval`, `timeout`, `retries`, `start_period`.
- Use `depends_on` with `condition: service_healthy` or `condition: service_started`.
- Never expose service ports directly to the host in `docker-compose.prod.yml`. Use `expose` only.
- Only `nginx` exposes ports to the host.
- Use named volumes for persistent data. Never use bind mounts for database or model data.
- Networks: `cervana_network` for dev (single), `cervana_backend` + `cervana_frontend` for prod (split).
- Logging driver: `json-file` with `max-size: 20m` and `max-file: 5`.
- Production compose must declare `deploy.resources.limits` for memory and CPU.
- Production must use image references (`image:`) not just `build:` for runtime rollback.

## Dockerfile Rules

- Use multi-stage builds. Final stage named `runner`.
- Use `dumb-init` or `tini` as `ENTRYPOINT` for proper signal handling.
- Run as non-root user (`USER cervana`) in the runtime stage.
- Pin base image to a specific minor version (e.g. `node:20-alpine` not `node:latest`).
- Use `--mount=type=cache,target=/root/.local/share/pnpm/store` for pnpm layer caching.
- Copy only build artifacts (`dist`, `.output`, `build`) to the runtime stage.
- Install `wget` or `curl` in runtime stage for healthcheck.
- Set `ENV NODE_ENV=production` in runtime stage for Node images.
- Set `ENV PYTHONUNBUFFERED=1` and `PIP_NO_CACHE_DIR=1` for Python images.
- Define `HEALTHCHECK` directive inside the Dockerfile, not only in compose.
- Use `EXPOSE` to document port usage, but do not publish from Dockerfile.

## Code Rules

- No comments in code unless explicitly requested.
- No comments in Dockerfile, docker-compose, nginx.conf, or configuration files.
- Configuration files should be self-documenting through structure and naming.
- Use environment variables for all deployment-specific values.
- Never commit secrets, tokens, API keys, or passwords to the repository.

## Network Architecture

- Browser → Nginx (port 80/443).
- Nginx routes `/` → web:3000, `/admin/` → admin:3001, `/api/` → api:3002, `/ai/` → ai-api:3003.
- All inter-service traffic uses Docker internal DNS (service names).
- Redis serves three roles: app cache, BullMQ broker, Celery broker.
- Qdrant stores embeddings for RAG pipeline.
- Celery worker is a separate service. Never spawn it as a subprocess inside ai-api container.

## Deployment Workflow

- Development: `docker compose up -d --build`.
- Production build: `docker compose -f docker-compose.yml -f docker-compose.build.yml build`.
- Production deploy: `docker compose -f docker-compose.prod.yml up -d`.
- Database migrations: `docker compose -f docker-compose.prod.yml --profile migrate up api-migrate`.
- Rollback: change `IMAGE_TAG` in `.env`, then `docker compose -f docker-compose.prod.yml up -d`.
- View logs: `docker compose -f docker-compose.prod.yml logs -f <service>`.
- Health verification: `curl http://localhost/nginx-health` (returns 200 if Nginx is up).

## Forbidden Actions

- Never run `docker compose down -v` in production without explicit confirmation.
- Never edit files inside a running container. Edit on host then rebuild.
- Never use `latest` tag for production images.
- Never bypass healthcheck with `condition: service_started` for critical dependencies.
- Never commit `.env`, `nginx/certs/`, or `qdrant/storage/`.
- Never expose Postgres, Redis, or Qdrant ports to the host in production.
- Never run containers as root in production.

## Required Verification Before Claiming Complete

- `docker compose config` returns valid YAML without errors.
- `docker compose -f docker-compose.prod.yml config` returns valid YAML.
- All services start and report healthy: `docker compose ps`.
- `curl http://localhost/nginx-health` returns 200.
- `curl http://localhost/api/v1/docs` returns Swagger UI.
- Frontend loads at `http://localhost/`.
- Admin loads at `http://localhost/admin/`.

## Git Operations

- The repository uses a **single root `.git`**. Never initialize or clone git inside service subdirectories (`cervana-api/`, `ai-api-cervana/`, `web-cervana/`, `admin-cervana/`).
- **Never run `git add`.** Staging is the owner's responsibility.
- **Never run `git commit`.** Committing is the owner's responsibility.
- **Never run `git push`, `git pull --rebase`, `git merge`, `git rebase`, `git reset --hard`, or `git stash drop` without explicit instruction.**
- **Never amend commits** (`git commit --amend`).
- **Never skip hooks** (`--no-verify`, `--no-gpg-sign`).
- **Never force-push** (`--force`, `-f`, `--force-with-lease`).
- **Never update git config** (`git config user.name`, `user.email`, etc.).
- The agent may only read git state: `git status`, `git log`, `git diff`, `git show`, `git branch` (read-only).
- When work is complete, the agent reports the list of changed and untracked files. The owner performs staging and commits.