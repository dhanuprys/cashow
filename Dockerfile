# syntax=docker/dockerfile:1.7

# Cashow — production multi-stage build.
#
#   web     Next.js standalone output on Bun, running as non-root user
#   worker  background worker and database migration runner
#
# Both targets share the dependencies layer for fast, cached builds.

ARG BUN_VERSION=1.4.2

FROM docker.io/oven/bun:${BUN_VERSION}-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---------------------------------------------------------------------------
# Dependencies (cached on package.json + lockfile changes)
# ---------------------------------------------------------------------------
FROM base AS deps
COPY package.json bun.lock bunfig.toml ./
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/ai/package.json packages/ai/
COPY packages/config/package.json packages/config/
COPY packages/db/package.json packages/db/
COPY packages/domain/package.json packages/domain/
COPY packages/notify/package.json packages/notify/
COPY packages/services/package.json packages/services/
RUN bun install --frozen-lockfile

# ---------------------------------------------------------------------------
# Build (Next.js standalone output)
# ---------------------------------------------------------------------------
FROM deps AS builder
COPY . .
RUN bun run --filter @cashow/web build

# ---------------------------------------------------------------------------
# Shared runtime user & directories
# ---------------------------------------------------------------------------
FROM base AS runtime-base
RUN addgroup -S cashow && adduser -S -G cashow cashow \
  && mkdir -p /app/data /app/apps/web/.next/cache \
  && chown -R cashow:cashow /app

# ---------------------------------------------------------------------------
# Target 1: web (Next.js standalone server)
# ---------------------------------------------------------------------------
FROM runtime-base AS web
USER cashow
COPY --from=builder --chown=cashow:cashow /app/apps/web/.next/standalone ./
COPY --from=builder --chown=cashow:cashow /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=cashow:cashow /app/apps/web/public ./apps/web/public

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/api/health || exit 1

CMD ["bun", "apps/web/server.js"]

# ---------------------------------------------------------------------------
# Target 2: worker (background jobs + migrations)
# ---------------------------------------------------------------------------
FROM runtime-base AS worker
USER cashow
COPY --from=builder --chown=cashow:cashow /app ./

CMD ["bun", "apps/worker/src/index.ts"]
