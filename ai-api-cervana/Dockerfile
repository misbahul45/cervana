# syntax=docker/dockerfile:1.6
# ---------- Base stage ----------
FROM python:3.11-slim AS base
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    UV_LINK_MODE=copy

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        curl \
        ca-certificates \
    && pip install --no-cache-dir --upgrade pip uv \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# ---------- Dependencies stage ----------
FROM base AS deps
WORKDIR /app

# Salin hanya dependency manifests untuk layer caching
COPY pyproject.toml uv.lock ./

ENV UV_HTTP_TIMEOUT=600 \
    HF_HUB_HTTP_TIMEOUT=120

# Install PyTorch CPU (hemat ruang, tidak perlu CUDA di container)
RUN uv pip install --system --no-cache \
    "torch==2.9.0+cpu" \
    --index-url https://download.pytorch.org/whl/cpu

# Install project dependencies
RUN uv pip install --system --no-cache .

# ---------- Runtime stage ----------
FROM base AS runner
WORKDIR /app

ENV PYTHONPATH=/app \
    PORT=3003 \
    HF_HUB_ENABLE_HF_TRANSFER=1 \
    TRANSFORMERS_OFFLINE=0 \
    HF_ENDPOINT=https://huggingface.co \
    HF_HOME=/home/cervana/.cache/huggingface

RUN groupadd -r cervana && useradd -r -g cervana -m -d /home/cervana cervana \
    && mkdir -p /home/cervana/.cache/huggingface \
    && chown -R cervana:cervana /home/cervana

# Salin deps dari stage 'deps'
COPY --from=deps /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=deps /usr/local/bin /usr/local/bin

# Salin source code
COPY --chown=cervana:cervana . .

USER cervana

EXPOSE 3003

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -fsS http://localhost:3003/ || exit 1

# TIDAK spawn Celery sebagai subprocess lagi (lihat docker-compose.prod.yml).
# Cukup jalankan FastAPI; worker dipisah sebagai service 'celery-worker'.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3003", "--workers", "1", "--log-level", "info"]