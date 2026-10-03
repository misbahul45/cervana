# syntax=docker/dockerfile:1.6
# ---------- Runtime stage (uses locally-built .output from host) ----------
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    NITRO_PORT=3000 \
    PORT=3000

RUN apk add --no-cache wget dumb-init \
 && addgroup -S reducera && adduser -S reducera -G reducera

COPY --chown=reducera:reducera .output ./.output
COPY --chown=reducera:reducera package.json ./package.json

USER reducera

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

CMD ["node", ".output/server/index.mjs"]
