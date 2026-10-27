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

- **Backup target: external drive.** The nightly job keeps its `pg_dump` →
  `age` → `rclone` chain, with the destination configured as a local/remote
  path on an attached disk (`BACKUP_RCLONE_REMOTE` pointing at the mount, or a
  `local` rclone remote). Two consequences are recorded in the deployment docs:
  - The drive must be mounted on the host and included in the Compose volume /
    bind mount; an unmounted drive must fail the backup loudly rather than
    write to the container filesystem.
  - An off-site copy is still recommended for fire/theft, but it is not a
    Phase 0 requirement. The restore drill in `docs/` already covers restoring
    from the archive.
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
