# 0006 — Access option and backup target

- **Status:** Proposed
- **Date:** 2026-10-27

## Context

Cashow holds a complete record of someone's finances and will be reachable from
a phone. The plan lists three access options and recommends the private network.
The final choice depends on the server (home server or VPS) and the backup
target. Passkeys are bound to the domain, so the permanent name must be chosen
before the first passkey is created.

## Options

| Option                               | How                                                                     | Trade-off                                                                                                    |
| ------------------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **A. Private network** (recommended) | Tailscale or WireGuard; Caddy serves a certificate for the private name | Nothing exposed to the internet; the phone needs the VPN app. Push still works because delivery is outbound. |
| B. Tunnel with access policy         | Cloudflare Tunnel + Cloudflare Access in front of login                 | Reachable anywhere, no open inbound ports; traffic passes through a third party.                             |
| C. Public domain                     | Caddy on 80/443 with a firewall and CrowdSec/fail2ban                   | Simplest; the largest attack surface.                                                                        |

## Decisions so far

- **Backup target: a plain local path.** The nightly job writes its `pg_dump`
  and uploads tar, encrypted with `age`, straight into `BACKUP_DIR` — a local
  relative path bind-mounted from the host (default `./backups`). There is no
  dedicated volume, no rclone remote, and no third-party upload tool. Two
  consequences are recorded in the deployment docs:
  - Because the artifacts are ordinary files on the host, point `BACKUP_DIR` at
    a directory that survives losing the machine (an attached disk or a synced
    folder) and make sure the path exists before enabling the profile.
  - An off-site copy is still recommended for fire/theft, but it is not a
    Phase 0 requirement. The monthly restore drill restores into a throwaway
    database and never touches the live one.
- **Access option and permanent domain remain undecided.** Default to
  **option A** until the server is chosen. Keep `proxy` so A can be served over
  a private name, and keep B/C possible without changing the app.

## Consequences

- `WEB_ORIGIN`, `CASHOW_DOMAIN` and the WebAuthn RP ID must stay on
  `localhost`/a temporary name until the domain is settled.
- Do **not** create the real owner passkey before the permanent name is set:
  a passkey registered on `localhost` or a temporary host cannot be used on the
  final origin. The `/setup` flow stays open only while zero users exist, so
  the moment the name is final is the moment to run setup.

## Open questions

1. Home server or VPS?
2. Permanent domain or private name (and therefore the WebAuthn RP ID)?
3. Off-site copy of the external-drive backup: none, second drive, or object
   storage?

Mark this ADR accepted when 1 and 2 are answered.
