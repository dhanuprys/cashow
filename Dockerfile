# syntax=docker/dockerfile:1.7

# Cashow — one repository, two runtime targets.
#
#   web     multi-stage Next.js standalone output on Bun, non-root
#   worker  the same source and dependencies, running the worker entrypoint
#
# Both targets share the dependency layer so `docker build --target web` and
# `--target worker` reuse the same install step. The `migrate` Compose service
# reuses the worker target with a different command.

ARG BUN_VERSION=1.4.2

FROM oven/bun:${BUN_VERSION}-alpine AS base
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
# Shared runtime user
# ---------------------------------------------------------------------------
FROM base AS runtime-base
RUN addgroup -S cashow && adduser -S -G cashow cashow \
  && mkdir -p /app/data && chown cashow:cashow /app/data

# ---------------------------------------------------------------------------
# web — only the standalone server, static assets and public files
# ---------------------------------------------------------------------------
FROM runtime-base AS web
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=builder --chown=cashow:cashow /app/apps/web/.next/standalone ./
COPY --from=builder --chown=cashow:cashow /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=cashow:cashow /app/apps/web/public ./apps/web/public

USER cashow
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/api/health || exit 1

CMD ["bun", "apps/web/server.js"]

# ---------------------------------------------------------------------------
# worker — full source + dependencies (also used by the migrate job)
# ---------------------------------------------------------------------------
FROM runtime-base AS worker
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --chown=cashow:cashow . .

USER cashow

CMD ["bun", "apps/worker/src/index.ts"]
