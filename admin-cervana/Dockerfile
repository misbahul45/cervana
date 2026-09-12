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
    PORT=3001 \
    HOST=0.0.0.0 \
    ORIGIN=http://localhost:3001

RUN apk add --no-cache wget dumb-init \
    && addgroup -S cervana && adduser -S cervana -G cervana

# adapter-node output ke folder 'build/' (lihat svelte.config.js)
COPY --from=builder --chown=cervana:cervana /app/build ./build
COPY --from=builder --chown=cervana:cervana /app/package.json ./package.json

USER cervana

EXPOSE 3001

ENTRYPOINT ["dumb-init", "--"]

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/ || exit 1

CMD ["node", "build/index.js"]