# syntax=docker/dockerfile:1.6

FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.15.0 --activate

RUN apk add --no-cache python3 make g++ openssl

COPY package.json pnpm-lock.yaml .npmrc* ./

RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY . .

ENV DATABASE_URL=postgresql://reducera_prod:change_me_strong_random_password_min_24_chars@postgres:5432/reducera

RUN pnpm prisma generate
RUN pnpm build

RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm prune --prod --ignore-scripts


FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3002 \
    DATABASE_URL=postgresql://reducera_prod:change_me_strong_random_password_min_24_chars@postgres:5432/reducera

RUN apk add --no-cache wget openssl dumb-init \
    && addgroup -S reducera && adduser -S reducera -G reducera

COPY --from=builder --chown=reducera:reducera /app/node_modules ./node_modules
COPY --from=builder --chown=reducera:reducera /app/dist ./dist
COPY --from=builder --chown=reducera:reducera /app/prisma ./prisma
COPY --from=builder --chown=reducera:reducera /app/package.json ./package.json
COPY --from=builder --chown=reducera:reducera /app/src ./src

USER reducera

EXPOSE 3002

ENTRYPOINT ["dumb-init", "--"]

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3002/api/v1/docs || exit 1

CMD ["node", "dist/main.js"]