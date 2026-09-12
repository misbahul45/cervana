# CERVANA

AI-powered learning platform for vocational accounting students, combining Retrieval-Augmented Generation with gamified microlearning.

## Overview

CERVANA is a full-stack web platform that helps SMK Akuntansi students prepare for competency certification through:

- RAG-based AI tutor over accounting curriculum (PDF, video, modules)
- Adaptive quizzes with real-time evaluation
- Gamification (points, streaks, badges, leaderboard)
- Admin dashboard for content, progress, and analytics management

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend (Student) | Nuxt | 4.x |
| Frontend (Admin) | SvelteKit | 2.x |
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
       ┌──────────────┼──────────────┬──────────────┐
       ▼              ▼              ▼              ▼
  ┌─────────┐   ┌──────────┐   ┌─────────┐   ┌──────────┐
  │   web   │   │  admin   │   │   api   │   │  ai-api  │
  │  Nuxt   │   │SvelteKit │   │ NestJS  │   │ FastAPI  │
  │  :3000  │   │  :3001   │   │  :3002  │   │  :3003   │
  └─────────┘   └──────────┘   └────┬────┘   └────┬─────┘
                                   │              │
                           ┌───────┴──────┐       │
                           ▼              ▼       ▼
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
| `admin` | Admin dashboard (SvelteKit) | 3001 |
| `api` | Core REST API (auth, users, gamification, content) | 3002 |
| `ai-api` | AI inference, RAG orchestration, embedding pipeline | 3003 |
| `celery-worker` | Async embedding & indexing tasks | — |
| `postgres` | Primary OLTP database | 5432 (internal) |
| `redis` | Cache, BullMQ queue, Celery broker | 6379 (internal) |
| `qdrant` | Vector store for RAG retrieval | 6333 (internal) |

## Repository Layout

```
cervana/
├── cervana-api/            NestJS API + Prisma schema
├── ai-api-cervana/         FastAPI + Celery + LangChain pipeline
├── web-cervana/            Nuxt student app
├── admin-cervana/          SvelteKit admin dashboard
├── nginx/                  Reverse proxy configuration
├── postgres/init/          SQL bootstrap scripts
├── qdrant/                 Vector DB configuration
├── docker-compose.yml      Development stack
├── docker-compose.prod.yml Production stack
├── AGENTS.md               Operating rules for Docker/deployment
└── .env.example            Environment variable template
```

## Prerequisites

- Docker Engine 24+ with Compose v2
- 8 GB RAM minimum, 16 GB recommended (AI/API services are memory-intensive)
- 20 GB free disk space
- Host ports available: `80`, `443`, `3000`, `3001`, `3002`, `3003`, `5433`, `6333`, `6380`

## Quick Start (Development)

```bash
git clone <repository-url> cervana
cd cervana
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

docker build -t cervana/api:$IMAGE_TAG      ./cervana-api
docker build -t cervana/ai-api:$IMAGE_TAG   ./ai-api-cervana
docker build -t cervana/web:$IMAGE_TAG      ./web-cervana
docker build -t cervana/admin:$IMAGE_TAG    ./admin-cervana
```

Push to a private registry if deploying across multiple hosts.

### Configure Environment

On the production host:

```bash
git clone <repository-url> cervana
cd cervana
cp .env.example .env
```

Edit `.env` and set:

- `NODE_ENV=production`
- `IMAGE_TAG=<version>`
- `POSTGRES_PASSWORD`, `COOKIE_SECRET`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` to strong random values
- `PUBLIC_API_URL`, `PUBLIC_AI_URL`, `PUBLIC_WEB_URL`, `PUBLIC_ADMIN_URL` to the public HTTPS endpoints
- LLM provider keys: `GEMINI_API_KEY` or `OPENAI_API_KEY`

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
certbot certonly --standalone -d cervana.example.com

mkdir -p nginx/certs/cervana.example.com
cp /etc/letsencrypt/live/cervana.example.com/fullchain.pem nginx/certs/
cp /etc/letsencrypt/live/cervana.example.com/privkey.pem   nginx/certs/

mv nginx/conf.d/01-ssl.conf.example nginx/conf.d/01-ssl.conf

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
| Network segmentation | Single bridge | Split `cervana_backend` + `cervana_frontend` |
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
| `PUBLIC_*` | Public URLs exposed to browser (admin app) |
| `*_INTERNAL` | Service-to-service URLs resolved via Docker DNS |
| `GEMINI_API_KEY` / `OPENAI_API_KEY` | LLM provider credentials |
| `IMAGE_TAG` | Production image version (rollback control) |

Full naming and precedence rules are documented in [`AGENTS.md`](./AGENTS.md).

## Operations

```bash
docker compose ps                                          # Service health
docker compose logs -f api                                  # Tail API logs
docker compose exec postgres pg_dump -U cervana_prod cervana > backup.sql
docker compose exec api npx prisma studio                  # Prisma GUI
docker compose restart ai-api                              # Restart single service
docker compose up -d --build web                           # Rebuild single service
docker compose down -v                                     # Remove all data (DESTRUCTIVE)
```

Production equivalents:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f --tail=100 ai-api
docker compose -f docker-compose.prod.yml exec postgres pg_dump -U cervana_prod cervana > backup-$(date +%F).sql
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