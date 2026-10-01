# syntax=docker/dockerfile:1.6
# ---------- Build stage ----------
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.15.0 --activate

COPY package.json pnpm-lock.yaml .npmrc* ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# ---------- Production stage ----------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NITRO_PORT=3000 \
    PORT=3000

RUN apk add --no-cache wget dumb-init \
    && addgroup -S reducera && adduser -S reducera -G reducera

# Copy hanya artefak production (.output) — node_modules sudah di-bundle oleh Nitro
COPY --from=builder --chown=reducera:reducera /app/.output ./.output
COPY --from=builder --chown=reducera:reducera /app/package.json ./package.json

USER reducera

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

CMD ["node", ".output/server/index.mjs"]