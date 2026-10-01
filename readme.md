# REDUCERA

AI-powered learning platform for vocational accounting students, combining Retrieval-Augmented Generation with gamified microlearning.

## Overview

REDUCERA is a full-stack web platform that helps SMK Akuntansi students prepare for competency certification through:

- RAG-based AI tutor over accounting curriculum (PDF, video, modules)
- Adaptive quizzes with real-time evaluation
- Gamification (points, streaks, badges, leaderboard)

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend (Student) | Nuxt | 4.x |
| Backend API | NestJS + Prisma | 11.x / 7.x |
| AI Service | FastAPI + LangChain + Celery | 0.121+ / 0.3+ / 5.5+ |
| Vector Database | Qdrant | 1.12+ |
| Relational Database | PostgreSQL | 15 |
| Cache / Broker | Redis | 7 |
| Reverse Proxy | Nginx | 1.27 |
| Package Manager | pnpm | 10.x |
| Python Tooling | uv + pyproject | latest |
| Containerization | Docker Compose | v2 |

## Architecture

```
                   Browser
                      │
                      ▼
                 ┌─────────┐
                 │  Nginx  │ :80 / :443
                 └────┬────┘
       ┌──────────────┼──────────────┐
       ▼              ▼              ▼
  ┌─────────┐   ┌─────────┐   ┌──────────┐
  │   web   │   │   api   │   │  ai-api  │
  │  Nuxt   │   │ NestJS  │   │ FastAPI  │
  │  :3000  │   │  :3002  │   │  :3003   │
  └─────────┘   └────┬────┘   └────┬─────┘
                     │             │
             ┌───────┴──────┐      │
             ▼              ▼      ▼
        ┌────────┐    ┌─────────┐  ┌──────────┐
        │postgres│    │  redis  │  │ celery   │
        │  :5432 │    │  :6379  │  │ worker   │
        └────────┘    └─────────┘  └────┬─────┘
                                        ▼
                                   ┌─────────┐
                                   │ qdrant  │
                                   │  :6333  │
                                   └─────────┘
```

### Service Responsibilities

| Service | Role | Exposed Port |
|---|---|---|
| `nginx` | Reverse proxy, TLS termination, static caching | 80, 443 |
| `web` | Student-facing Nuxt SSR | 3000 |
| `api` | Core REST API (auth, users, gamification, content) | 3002 |
| `ai-api` | AI inference, RAG orchestration, embedding pipeline | 3003 |
| `celery-worker` | Async embedding & indexing tasks | — |
| `postgres` | Primary OLTP database | 5432 (internal) |
| `redis` | Cache, BullMQ queue, Celery broker | 6379 (internal) |
| `qdrant` | Vector store for RAG retrieval | 6333 (internal) |

## Repository Layout

```
reducera/
├── apps/
│   └── web/                 Nuxt web app
├── services/
│   ├── api/                 NestJS API + Prisma schema
│   └── ai-api/              FastAPI + Celery + LangChain pipeline
├── infra/
│   ├── nginx/               Reverse proxy configuration
│   ├── postgres/init/       SQL bootstrap scripts
│   ├── qdrant/              Vector DB configuration
│   └── scripts/             One-off operational scripts
├── docs/                    Architecture, audits, plans
├── docker-compose.yml       Development stack
├── docker-compose.prod.yml  Production stack
├── AGENTS.md                Operating rules for Docker/deployment
└── .env.example             Environment variable template
```

## Prerequisites

- Docker Engine 24+ with Compose v2
- 8 GB RAM minimum, 16 GB recommended (AI/API services are memory-intensive)
- 20 GB free disk space
- Host ports available: `80`, `443`, `3000`, `3002`, `3003`, `5433`, `6333`, `6380`

## Quick Start (Development)

```bash
git clone <repository-url> reducera
cd reducera
cp .env.example .env
```

Generate required secrets and replace placeholders in `.env`:

```bash
openssl rand -base64 48   # COOKIE_SECRET
openssl rand -base64 48   # JWT_ACCESS_SECRET
openssl rand -base64 48   # JWT_REFRESH_SECRET
openssl rand -base64 48   # POSTGRES_PASSWORD
```

Build and start all services:

```bash
docker compose up -d --build
```

Initial build takes 5–10 minutes due to PyTorch and dependency installation in `ai-api`.

Verify health status:

```bash
docker compose ps
curl http://localhost/nginx-health
curl http://localhost/api/v1/docs
```

## Production Deployment

### Build Images

```bash
export IMAGE_TAG=1.0.0

docker build -t reducera/api:$IMAGE_TAG      ./services/api
docker build -t reducera/ai-api:$IMAGE_TAG   ./services/ai-api
docker build -t reducera/web:$IMAGE_TAG      ./apps/web
```

Push to a private registry if deploying across multiple hosts.

### Configure Environment

On the production host:

```bash
git clone <repository-url> reducera
cd reducera
cp .env.example .env
```

Edit `.env` and set:

- `NODE_ENV=production`
- `IMAGE_TAG=<version>`
- `POSTGRES_PASSWORD`, `COOKIE_SECRET`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` to strong random values
- `PUBLIC_API_URL`, `PUBLIC_AI_URL`, `PUBLIC_WEB_URL` to the public HTTPS endpoints
- LLM: `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and the two modes `OPENAI_MODEL_FLASH` (fast) and `OPENAI_MODEL_THINKING` (reasoning)
- Embeddings (Hugging Face Inference): `HF_TOKEN`, `HF_EMBEDDING_MODEL`, `EMBEDDING_DIM`

### Run Database Migrations

```bash
docker compose -f docker-compose.prod.yml --profile migrate run --rm api-migrate
```

This uses a one-shot init container that runs `prisma migrate deploy` then exits.

### Start Services

```bash
docker compose -f docker-compose.prod.yml up -d
```

### TLS Configuration

```bash
certbot certonly --standalone -d reducera.example.com

mkdir -p infra/nginx/certs/reducera.example.com
cp /etc/letsencrypt/live/reducera.example.com/fullchain.pem infra/nginx/certs/
cp /etc/letsencrypt/live/reducera.example.com/privkey.pem   infra/nginx/certs/

mv infra/nginx/conf.d/01-ssl.conf.example infra/nginx/conf.d/01-ssl.conf

docker compose -f docker-compose.prod.yml restart nginx
```

### Rollback

```bash
sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=<previous-version>/' .env
docker compose -f docker-compose.prod.yml up -d
```

## Development vs Production

| Aspect | Development | Production |
|---|---|---|
| Image source | Built from source on `up` | Pre-built with immutable tag |
| Service ports | Exposed to host for debugging | Only Nginx exposed |
| Network segmentation | Single bridge | Split `reducera_backend` + `reducera_frontend` |
| Resource limits | None | `memory` + `cpus` per service |
| Celery worker | Subprocess inside `ai-api` | Dedicated `celery-worker` service |
| Qdrant | Optional | Required for AI |
| Log rotation | Default | `json-file` 20m × 5 |
| Migrations | Manual | One-shot init container |

## Environment Variables

All configuration is centralized in a single root `.env` file. See `.env.example` for the full template.

| Variable | Purpose |
|---|---|
| `POSTGRES_*` | Database credentials and host port |
| `REDIS_*` | Cache and broker |
| `QDRANT_*` | Vector database endpoint and collections |
| `COOKIE_SECRET`, `JWT_*` | Authentication secrets |
| `NUXT_PUBLIC_*` | Public URLs exposed to browser (student app) |
| `PUBLIC_*` | Public URLs used by nginx and the services |
| `*_INTERNAL` | Service-to-service URLs resolved via Docker DNS |
| `OPENAI_API_KEY`, `OPENAI_BASE_URL` | LLM gateway credentials |
| `OPENAI_MODEL_FLASH`, `OPENAI_MAX_TOKENS`, `OPENAI_FLASH_TEMPERATURE` | Fast mode model, token budget, optional temperature |
| `OPENAI_MODEL_THINKING`, `OPENAI_THINKING_MAX_TOKENS` | Thinking mode model and token budget |
| `HF_TOKEN`, `HF_EMBEDDING_MODEL`, `HF_EMBEDDING_URL`, `EMBEDDING_DIM` | Remote embeddings via Hugging Face Inference |
| `IMAGE_TAG` | Production image version (rollback control) |

Full naming and precedence rules are documented in [`AGENTS.md`](./AGENTS.md).

## Operations

```bash
docker compose ps                                          # Service health
docker compose logs -f api                                  # Tail API logs
docker compose exec postgres pg_dump -U reducera_prod reducera > backup.sql
docker compose exec api npx prisma studio                  # Prisma GUI
docker compose restart ai-api                              # Restart single service
docker compose up -d --build web                           # Rebuild single service
docker compose down -v                                     # Remove all data (DESTRUCTIVE)
```

Production equivalents:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f --tail=100 ai-api
docker compose -f docker-compose.prod.yml exec postgres pg_dump -U reducera_prod reducera > backup-$(date +%F).sql
```

## Health Endpoints

| Endpoint | Service | Method |
|---|---|---|
| `/nginx-health` | Nginx | `curl http://localhost/nginx-health` |
| `/api/v1/docs` | NestJS Swagger UI | `curl http://localhost/api/v1/docs` |
| `/ai/` | FastAPI root | `curl http://localhost/ai/` |

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/<name>`)
3. Follow conventions in `AGENTS.md`
4. Verify with `docker compose config` before committing
5. Submit a pull request with a clear description

Commit format: `<scope>: <imperative summary>` (e.g., `api: add rate limiter middleware`)

## License

Proprietary. All rights reserved.