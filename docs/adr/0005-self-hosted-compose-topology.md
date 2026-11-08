# 0005 — Single-host Docker Compose topology

- **Status:** Accepted
- **Date:** 2026-10-27

## Context

Cashow is single-owner, self-hosted, and sized for one small server (1 vCPU,
2 GB RAM). The plan requires deployment from day one and a backup that can be
restored, not a platform-specific hosting stack.

## Decision

Ship one `docker-compose.yml` with:

| Service    | Role                                                                         | Exposure                               |
| ---------- | ---------------------------------------------------------------------------- | -------------------------------------- |
| `postgres` | `docker.io/library/postgres:18-alpine`, named volume, tuned for small memory | internal only, no host port            |
| `migrate`  | one-shot `prisma db migrate` before web/worker                               | internal only                          |
| `web`      | Next.js standalone output on Bun, non-root, read-only rootfs                 | internal; localhost port for debugging |
| `worker`   | same image, worker entrypoint                                                | internal                               |
| `proxy`    | Caddy: TLS, headers, body cap, health-aware upstream                         | host 80/443                            |
| `backup`   | nightly `pg_dump` + uploads tar → `age` → local dir (profile `backup`)       | internal                               |

Two networks: `backend` for Postgres/web/worker/migrate and `edge` for
proxy/web. Postgres never joins `edge` and never publishes a port.

Secrets are supplied through the environment or `<NAME>_FILE` files (Docker
secrets / read-only mounts); images contain no secrets. Deployment is plain
Compose; Dokploy/Coolify are optional and must not be required.

## Consequences

- The same Compose file runs on a laptop and on the server; only `.env` and the
  domain differ.
- `migrate` must succeed before web/worker start; a failed migration fails the
  release.
- The backup profile is opt-in so the base stack starts without a backup key.
  A production deployment must enable it and keep the age private key off the
  server.
- Multi-architecture images are built from the same Dockerfile targets (web,
  worker) on a version tag.
