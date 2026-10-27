# 0006 — Access option for the server

- **Status:** Proposed
- **Date:** 2026-10-27

## Context

Cashow holds a complete record of someone's finances and will be reachable from
a phone. The plan lists three access options and recommends the private network.
The final choice depends on the server (home server or VPS) and the backup
target, which are not decided yet. Passkeys are bound to the domain, so the
permanent name must be chosen before the first passkey is created.

## Options

| Option                               | How                                                                     | Trade-off                                                                                                    |
| ------------------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **A. Private network** (recommended) | Tailscale or WireGuard; Caddy serves a certificate for the private name | Nothing exposed to the internet; the phone needs the VPN app. Push still works because delivery is outbound. |
| B. Tunnel with access policy         | Cloudflare Tunnel + Cloudflare Access in front of login                 | Reachable anywhere, no open inbound ports; traffic passes through a third party.                             |
| C. Public domain                     | Caddy on 80/443 with a firewall and CrowdSec/fail2ban                   | Simplest; the largest attack surface.                                                                        |

## Provisional decision

Default to **option A**. Keep the `proxy` service so A can be served over a
private name, and keep B/C possible without changing the app. Do not create
passkeys until `CASHOW_DOMAIN` is final.

## Open questions

1. Home server or VPS?
2. Backup target: S3-compatible bucket, NAS, or external drive?
3. Permanent domain or private name?

Record the answers here and mark this ADR accepted before Phase 0 is signed off.
