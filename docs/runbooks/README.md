# Runbooks

Short, do-it-now procedures for the failures that actually happen. Each one is written so you can follow it under stress: prerequisites, the steps in order, and how to tell it worked.

| Runbook | When |
| --- | --- |
| [`restore-from-bare-server.md`](./restore-from-bare-server.md) | The machine is gone or the database will not start; rebuild from backups. |
| [`roll-back-a-release.md`](./roll-back-a-release.md) | A deploy broke something; return to the previous image. |
| [`lost-or-stolen-phone.md`](./lost-or-stolen-phone.md) | A device with an active passkey is missing. |
| [`rotate-secrets-and-backup-key.md`](./rotate-secrets-and-backup-key.md) | A secret leaked, or the age key needs replacing. |
| [`postgres-major-upgrade.md`](./postgres-major-upgrade.md) | Moving `pgdata` to a new Postgres major version. |
| [`deepseek-model-retirement.md`](./deepseek-model-retirement.md) | The configured DeepSeek model stops working. |
| [`push-fully-failing.md`](./push-fully-failing.md) | No notification reaches any device. |
| [`disk-full-or-db-wont-start.md`](./disk-full-or-db-wont-start.md) | Disk pressure or Postgres refuses to come up. |

## Conventions

- Commands assume the repo root on the host unless stated otherwise.
- `docker compose` always means the stack in `docker-compose.yml`; profiles are
  named in the command.
- Anything that writes to the live database says so explicitly. Everything else
  is read-only or operates on a copy.
- After any recovery, run `bun run db:verify` and the gates in
  `.github/workflows/ci.yml` before calling it done.
