# Cashow

> **Ikuti ke mana uangmu mengalir.**  
> *A self-hosted money traceability ledger: income arrives, expenses draw from it through explicit allocations, bank balances stay 100% faithful to reality, and every figure is derived rather than stored.*

Cashow is a modern personal finance and cashflow tracking platform engineered for sovereign data ownership, mathematical accuracy, and proactive financial intelligence. It rejects traditional "black box" aggregate balances in favor of **envelope traceability**, **virtual goal reservations**, **safe-to-spend guardrails**, and **human-in-the-loop AI assistance**.

---

## Highlights

- **Traceable Allocations (Envelope Method):** Expenses explicitly link to the income sources funding them. You always know which paycheck, invoice, or side-income funded each expense.
- **Virtual Savings Goals:** Real bank balances remain 100% faithful to bank statements. Savings goals are non-destructive reservation overlays that protect funds by deducting from your daily safe-to-spend allowance without mutating account balances.
- **Safe-to-Spend Engine:** Live calculation of your daily spending allowance based on remaining days, upcoming recurring bills, and active goal reservations. Includes disruptive deficit warnings if physical balances fall below goal commitments.
- **AI Financial Assistant (`/app/chat`):** Integrated conversational intelligence (DeepSeek, Google Gemini, OpenAI/compatible) with strict write-tool approval gates. Capable of parsing free-form dated transaction lists (e.g. `53k`, `1,5jt`), asking clarifying questions when data is ambiguous, and batch-recording entries with a single confirmation.
- **Reconciliation & Lock Checkpoints:** Periodic balance snapshots, zero-gap reconciliation checks, and period checkpoints that lock settled historical ranges against retroactive tampering.
- **Strict Integer Arithmetic:** All monetary amounts are represented as 64-bit integer rupiah (`bigint` / `BigInt`). No floating-point rounding errors.
- **Flexible & Secure Authentication:** Native WebAuthn Passkeys (biometrics/hardware keys), scrypt-hashed passwords with live strength validation, and Google OAuth integration.
- **Production-Ready Containerization:** Multi-stage Bun Docker image (~70 MB standalone output) with separate web and worker targets, automated migrations, health checks, and GitHub Actions CI/CD to GitHub Container Registry (`ghcr.io/dhanuprys/cashow`).

---

## Tech Stack

| Layer                         | Technology                                                                      | Details                                                                                   |
| :---------------------------- | :------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------- |
| **Runtime & Package Manager** | [Bun](https://bun.sh) 1.4.2+                                                    | Workspaces monorepo, fast package resolution, single `bun.lock`                           |
| **Web Framework**             | [Next.js](https://nextjs.org) 16 (App Router)                                   | Standalone output, Server Actions, Cache Components, React 19                             |
| **UI & Styling**              | [Tailwind CSS](https://tailwindcss.com) v4 + [shadcn/ui](https://ui.shadcn.com) | Mobile-first responsive design, Base UI primitives, dark mode                             |
| **Database**                  | [PostgreSQL](https://www.postgresql.org) 17                                     | `docker.io/library/postgres:17-alpine`, custom PL/pgSQL triggers for cross-row invariants |
| **ORM & Data Layer**          | [Prisma](https://www.prisma.io) 8                                               | Contract-first workflow (`contract.prisma` → `contract.json`)                             |
| **Authentication**            | Passkeys + Passwords + OAuth                                                    | SimpleWebAuthn, scrypt (`crypto.scrypt`), Google OAuth, session cookies                   |
| **AI Integration**            | [Vercel AI SDK](https://sdk.vercel.ai)                                          | Multi-provider streaming, dynamic tools, human-approval execution gates                   |
| **Background Processing**     | Custom Outbox Worker                                                            | Transactional outbox pattern, scheduled rule engine, push notifications                   |
| **Quality & Linter**          | [Biome](https://biomejs.dev) 2 + TypeScript                                     | Fast linting, code formatting, strict TypeScript configuration                            |
| **Containerization**          | Docker & Compose v2                                                             | Multi-stage build, rootless execution, automated migration orchestrator                   |

---

## Architecture & Monorepo Layout

```
cashow/
├── apps/
│   ├── web/                     # Next.js 16 frontend, Server Actions & API endpoints
│   └── worker/                  # Background daemon: outbox events, rules & notification delivery
├── packages/
│   ├── domain/                  # Pure business logic: money math, pacing, schemas & formatters
│   ├── services/                # Use-cases: accounts, transactions, goals, budgets & audit log
│   ├── db/                      # Prisma 8 contract, migrations, generated client & seeds
│   ├── config/                  # Validated Zod environment configuration & Docker secrets loader
│   ├── ai/                      # AI provider abstraction (DeepSeek, Gemini, OpenAI)
│   └── notify/                  # Notification transports (Web Push)
├── deploy/                      # Backup scripts, age encryption keys, recovery tooling
├── docs/                        # Architecture Decision Records (ADRs) and design specs
├── scripts/                     # Integration tests, benchmarks (100k seed), and verification gates
├── Dockerfile                   # Production multi-stage Docker build (targets: web, worker)
└── docker-compose.yml           # Self-contained stack: web, worker, migrate, postgres, backup
```

---

## Getting Started (Local Development)

### Prerequisites

- [Bun](https://bun.sh) (v1.4.2 or higher)
- PostgreSQL 17 (local instance or Docker container)
- Docker & Docker Compose v2 (optional, for containerized run)

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/dhanuprys/cashow.git
cd cashow
bun install
```

### 2. Environment Configuration

Copy the example environment file and adjust your database connection:

```bash
cp .env.example .env
```

Ensure `DATABASE_URL` points to an active PostgreSQL database:

```env
DATABASE_URL="postgresql://default:default@localhost:5432/cashow"
WEB_ORIGIN="http://localhost:3000"
```

### 3. Initialize Database & Run Migrations

```bash
# Apply all Prisma migrations to the database
bun run db:migrate

# Verify schema matches the contract
bun run db:verify
```

### 4. Start Development Servers

```bash
# Start Next.js development server (Turbopack)
bun run dev

# (Optional) In a separate terminal, start the background worker
bun run worker
```

Open [http://localhost:3000](http://localhost:3000) in your browser. If no users exist, you will be directed to `/setup` to initialize the owner account.

---

## Core Features & Route Overview

### 1. Dashboard (`/app`)

- **3-Tier Modular Bento Layout:**
  - **KPI Strip:** Net Cashflow, Safe-to-Spend, Total Liquid Balance, and Active Goal Reservations.
  - **Tier 1 (Guardrails & Targets):** `SafeToSpendCard` (daily limit, days left, recurring buffer) side-by-side with `DashboardGoalsCard` (compact target progress, top 3 active goals, inline "Sisihkan" reserve action).
  - **Tier 2 (Trends):** Daily cashflow chart and spending-by-category distribution chart.
  - **Tier 3 (Activity & Balances):** Recent transactions feed alongside liquid balances per account and an inline quick-add form.

### 2. Virtual Savings Goals (`/app/goals`)

- **Real Balance Preservation:** Bank balances are untouched. Goals allocate a virtual hold on your free cash.
- **Pacing Metrics:** Calculates whether you are _Ahead_, _On Track_, or _Behind_ based on monthly target deadlines.
- **Account Selector with Free Cash Guard:** Shows exactly how much unreserved cash is available in each account before committing.
- **Smart Presets:** One-click chips for "Sisa Target" and "Saran Bulanan".
- **Archiving Lifecycle:** Archiving a goal automatically releases its reserved funds back to free cash in a single transaction.

### 3. AI Financial Assistant (`/app/chat`)

- **Multi-Model Support:** Switch between DeepSeek (`deepseek-chat`, `deepseek-reasoner`), Google Gemini, and OpenAI-compatible endpoints configured in Settings.
- **Thread Management:** Create, rename, switch, and delete chat conversations.
- **Bulk Transaction Ingestion:** Paste free-form dated notes (e.g., `1 November: bensin 53k, kopi 25rb`)—Cashow parses shorthand amounts and asks clarifying questions if dates, accounts, or amounts are missing.
- **Human-in-the-Loop Approval:** Financial write actions (`createTransaction`, `createBatchTransactions`, `createTransfer`) render an interactive summary card. Nothing is written to the ledger until you explicitly click **Setujui**.

### 4. Transactions & Allocations (`/app/transactions`)

- Full ledger list with searching, filtering, and pagination.
- **Envelope Allocations:** Link expenses to specific income entries to enforce spending discipline.
- **Transfers with Fee Tracking:** Atomic balance movement between accounts with explicit fee categorization.
- **Attachment Storage:** Upload proof-of-payment receipts downscaled client-side; stored securely on local storage volumes.

### 5. Accounts & Reconciliation (`/app/accounts`)

- Support for Bank, E-Wallet, Cash, and Investment accounts.
- **Reconciliation Snapshots:** Compare real bank statements against calculated balances and record variance adjustments.
- **Checkpoint Locking:** Freeze past accounting periods so historical figures cannot be retroactively modified.
- **Reserved Badges:** Real-time visibility into how much of each account's balance is locked into savings goals.

### 6. Settings & Security (`/app/settings`)

- **Profile Preferences:** Currency, timezone (WIB, WITA, WIT), week start day, and budget payday offset.
- **Password Management:** Set or change passwords with real-time strength scoring and confirmation checks.
- **Passkeys (WebAuthn):** Add, manage, and label biometric devices or hardware security keys.
- **Connected Accounts:** Google OAuth account linkage.
- **AI Model Keys:** Configure API credentials for external AI providers locally.
- **Audit & Outbox Viewer:** Inspect historical audit logs and system event processing queues.

---

## Production Deployment (Docker)

Cashow ships with a production-ready, rootless multi-stage `Dockerfile` and a streamlined `docker-compose.yml`.

### Architecture

```
                  ┌──────────────────────────────────────────────┐
                  │ External Reverse Proxy (Host Nginx / Caddy /  │
                  │ Cloudflare Tunnel / Traefik)                 │
                  └──────────────────────┬───────────────────────┘
                                         │ HTTP :3000
                                         ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Docker Network: backend                                                │
│                                                                        │
│   ┌────────────────────┐     ┌───────────────────┐                     │
│   │   cashow-web       │     │   cashow-worker   │                     │
│   │   (Next.js Stand.) │     │   (Outbox Daemon) │                     │
│   └─────────┬──────────┘     └─────────┬─────────┘                     │
│             │                          │                               │
│             │ depends_on               │ depends_on                    │
│             ▼                          ▼                               │
│   ┌──────────────────────────────────────────────┐                     │
│   │   cashow-migrate (Runs migrations & exits)   │                     │
│   └──────────────────────┬───────────────────────┘                     │
│                          │                                             │
│                          ▼                                             │
│   ┌──────────────────────────────────────────────┐                     │
│   │   cashow-postgres (PostgreSQL 17 Alpine)     │                     │
│   └──────────────────────────────────────────────┘                     │
└────────────────────────────────────────────────────────────────────────┘
```

### Deploying with Prebuilt GHCR Images

1. **Clone the repository and copy the production environment template:**

   ```bash
   cp .env.production.example .env
   ```

2. **Configure your `.env`:**

   ```env
   NODE_ENV="production"
   POSTGRES_USER="cashow"
   POSTGRES_PASSWORD="generate-a-strong-password"
   POSTGRES_DB="cashow"
   WEB_PORT="3000"
   WEB_ORIGIN="https://cashow.yourdomain.com"
   AUTH_SECRET="generate-a-32-byte-hex-string"
   ```

3. **Start the stack:**

   ```bash
   docker compose pull
   docker compose up -d
   ```

   _The `migrate` container will automatically run pending migrations and exit before `web` and `worker` start serving traffic._

4. **Verify Container Health:**

   ```bash
   docker compose ps
   curl -I http://localhost:3000/api/health   # Liveness check (200 OK)
   curl -I http://localhost:3000/api/ready    # Readiness check (200 OK)
   ```

5. **Connect Your Reverse Proxy:**
   Point your external reverse proxy (Caddy, Nginx, Traefik, or Cloudflare Tunnel) to `http://127.0.0.1:3000` with standard WebSocket and proxy headers enabled.

---

## Automated Backups & Disaster Recovery

An automated, encrypted backup container is provided via the `backup` Compose profile.

### Setting Up Encrypted Backups

1. Generate an [age](https://github.com/FiloSottile/age) encryption keypair:

   ```bash
   mkdir -p secrets
   age-keygen -o secrets/age.key
   ```
2. Set the public key in your `.env`:

   ```env
   BACKUP_AGE_RECIPIENT="age1..."
   BACKUP_DIR="./backups"
   ```
3. Start the backup container:

   ```bash
   docker compose --profile backup up -d
   ```

Backups execute nightly at **02:15 UTC**, creating two encrypted artifacts in `BACKUP_DIR`:
1. `cashow-<timestamp>.dump.age`: PostgreSQL database dump (`pg_dump` custom format).
2. `cashow-<timestamp>-files.tar.gz.age`: Compressed archive of all attachment receipts.

### Testing Restore Drills

Test disaster recovery into a throwaway database:

```bash
STAMP="20261106T021500Z"

# Restore database dump into a test database
docker compose --profile backup run --rm backup /usr/local/bin/restore.sh \
  "/backups/cashow-$STAMP.dump.age" cashow_drill

# Restore receipt attachments into a test folder
docker compose --profile backup run --rm backup /usr/local/bin/restore-files.sh \
  "/backups/cashow-$STAMP-files.tar.gz.age" /tmp/drill_uploads
```

---

## Testing & Quality Verification Suite

Cashow enforces strict domain testing and verification gates:

```bash
# Code quality and style checks (Biome)
bun run check

# TypeScript type validation across all workspaces
bun run typecheck

# Fast domain unit tests
bun run test

# Database-level allocation and integrity gate
bun run test:ledger

# Payment plan milestones, chains, and reconciliation gate
bun run test:chains

# Cashflow summaries, budget calculations, and pacing gate
bun run test:summary

# Background rules, triggers, and notification delivery gate
bun run test:rules

# Virtual savings goals, reserve limits, and pacing gate
bun run test:goals

# 100,000 transaction performance benchmark (p95 latency checks)
bun run seed
bun run bench
bun run seed:clean
```

---

## Architecture Decision Records (ADRs)

Core technical choices are documented under [`docs/adr/`](docs/adr/):

- **[ADR 0001: Next.js App Router on Bun](docs/adr/0001-nextjs-app-router-on-bun.md)**
- **[ADR 0002: PostgreSQL 17 via Prisma 8](docs/adr/0002-postgres-17-prisma-8.md)**
- **[ADR 0003: Monetary Representation as BigInt](docs/adr/0003-monetary-representation.md)**
- **[ADR 0004: Allocation Invariants via SQL Triggers](docs/adr/0004-allocation-invariants.md)**
- **[ADR 0005: Biome for Tooling & Style](docs/adr/0005-biome-tooling.md)**
- **[ADR 0006: Self-Hosted Deployment & Network Isolation](docs/adr/0006-access-option.md)**
- **[ADR 0007: WebAuthn Passkeys & Identity Security](docs/adr/0007-passkey-auth.md)**
- **[ADR 0008: Compatibility & Readiness Probes](docs/adr/0008-compat-probes.md)**
- **[ADR 0009: Receipt Attachment Storage Architecture](docs/adr/0009-attachment-storage.md)**
- **[Savings Goals Design Spec](docs/ideas/savings-goals.md)**

---

## License

Private project. All rights reserved.
