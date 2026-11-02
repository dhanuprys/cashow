# Cashow — Task Map & Implementation Plan

This document is the working map for the next improvement pass. It is ordered so
that the highest-leverage, lowest-risk work comes first. Items already shipped
(mobile bottom nav, dark mode, `userSettings` memoisation, content-shaped
skeletons, per-page titles, error boundaries, the shadcn date picker, contrast
fixes, etc.) are intentionally **not** repeated here.

## 1. App map

### Pages (`apps/web/app`)

| Route                         | File                                      | Notes                                                   |
| ----------------------------- | ----------------------------------------- | ------------------------------------------------------- |
| `/`                           | `app/page.tsx`                            | Landing, CTA resolves to setup/app/login                |
| `/login`, `/setup`            | `login/page.tsx`, `setup/page.tsx`        | Passkey + password                                      |
| `/app`                        | `app/app/page.tsx`                        | Dashboard: KPI strip, charts, recent tx, month switcher |
| `/app/transactions`           | `app/app/transactions/page.tsx`           | List + 12-col filter bar + pagination                   |
| `/app/transactions/new`       | `app/app/transactions/new/page.tsx`       | Create income/expense/transfer; share target            |
| `/app/transactions/[id]`      | `app/app/transactions/[id]/page.tsx`      | Detail, attachments, restore/delete                     |
| `/app/transactions/[id]/edit` | `app/app/transactions/[id]/edit/page.tsx` | Edit                                                    |
| `/app/accounts`               | `app/app/accounts/page.tsx`               | Accounts, snapshots, checkpoints                        |
| `/app/budgets`                | `app/app/budgets/page.tsx`                | Budgets + progress + create form                        |
| `/app/categories`             | `app/app/categories/page.tsx`             | Categories, subcategories, archive                      |
| `/app/plans`                  | `app/app/plans/page.tsx`                  | Plans list                                              |
| `/app/plans/[id]`             | `app/app/plans/[id]/page.tsx`             | Plan detail, items, progress                            |
| `/app/recurring`              | `app/app/recurring/page.tsx`              | Templates + drafts                                      |
| `/app/rules`                  | `app/app/rules/page.tsx`                  | Rules + visual builder                                  |
| `/app/inbox`                  | `app/app/inbox/page.tsx`                  | Notifications + push subscribe                          |
| `/app/import`                 | `app/app/import/page.tsx`                 | CSV import                                              |
| `/app/chat`                   | `app/app/chat/page.tsx`                   | AI chat (history)                                       |
| `/app/settings`               | `app/app/settings/page.tsx`               | Profile, passkeys, audit, outbox, theme                 |

### Feature modules (`packages/services/src`)

`accounts`, `attachments`, `audit`, `budgets`, `categories`, `context`/`context-pack`,
`defaults`, `notifications`, `outbox`, `plans`, `recurring`, `rules`, `snapshots`,
`summary`, `transactions`, `users`.

### Shared UI (`apps/web/components`)

`ledger/*` (forms, charts, nav, skeletons, date-picker, theme toggle),
`auth/*`, `ui/*` (shadcn: button, card, input, native-select, dialog, sheet,
popover, calendar, chart, …).

## 2. Remaining mobile-centric gaps (per page)

### P0 — blocks a good phone experience

- **`/app/transactions`**: filter bar now flex-wraps; verify the date pickers and
  the "Tampilkan yang dihapus" checkbox don't overflow on a 320 px viewport.
- **`/app/accounts`**: the snapshot/reconciliation `<details>` block is long; on
  phones the `max-w-sm` unlock form and the snapshot list need a stacked layout
  review. Add `min-w-0` to the account name column (done in pass 1, re-verify).
- **`/app` (dashboard)**: KPI strip is `sm:grid-cols-3` (single column on phone)
  — acceptable, but the three cards should be horizontally scrollable or
  collapsed into a single "summary" card on <360 px to avoid a very tall first
  screen.
- **`/app/plans/[id]`**: the items table is rendered as a list; confirm tap
  targets on "Tandai dibayar" / "Hapus tahap" are ≥ 44 px.

### P1 — polish that reads as "desktop-first"

- **Every form**: sticky submit bar pattern (already on transaction form) should
  be applied to `account-form`, `budget-form`, `category-form`, `plan-form`,
  `plan-item-form`, `recurring-form`, `rule-builder-form`, `settings-form`,
  `snapshot-form`, `transfer-form`.
- **Inline secondary actions** (`Tandai dibaca`, `Tunda 1 jam`, `Hapus`,
  `Cabut`, `Arsipkan`) — bump to `min-h-9`/`min-h-10` hit areas (partially
  done; audit the rest).
- **`/app/settings`**: audit log + outbox lists use `text-xs` timestamps that
  can wrap; add `break-words` / `min-w-0`.
- **`/app/chat`**: the message input should be pinned to the bottom of the
  viewport on phones (like a chat app), with the transcript scrolling above.
- **`/app/import`**: the CSV textarea is tall; on phones a file-picker-first
  flow (already added) is good, but the textarea should collapse to ~6 rows
  and the sample button should be reachable without scrolling.
- **`/app/inbox`**: notification cards with `PushSubscribe` should stack the
  "Aktifkan push" button below the text on narrow screens.

### P2 — nice-to-have

- **Bottom sheet for filters**: the transactions filter bar could move into a
  Sheet on phones instead of wrapping inline.
- **Pull-to-refresh** on the dashboard and transaction list (PWA).
- **Haptic feedback** on quick-add success (mobile only).
- **Landscape phone** handling for charts (rotate hint).

## 3. Feature completeness gaps

### A. Data & correctness

- `revalidateLedger()` covers the main paths; verify `/app/chat` and
  `/app/import` are not stale after a transaction is created (they read
  aggregates).
- `listCategories({ withTransactionCount })` is opt-in; the budgets page and
  recurring page still call `listCategories(ctx)` without the count — confirm
  they don't render `transactionCount`.
- Audit log is capped at 15 rows; add "load more" pagination.
- Outbox events are capped at 5 rows; same.

### B. Accessibility (remaining)

- `transaction-list` rows are `<li>` inside `<ul>` but the whole row is a
  `<Link>` — confirm screen readers announce it as a link, not a list item
  with a nested link (acceptable, but verify).
- Charts: the hidden `<table>` alternative should be toggleable ("show data
  table") rather than only screen-reader visible, for sighted keyboard users.
- `PasskeyManager` revoke uses `window.confirm` — replace with an
  `AlertDialog` for consistency.
- Form validation: `Field`/`FieldGroup` shadcn primitives exist but most forms
  still use raw `<div>` + `<Label>`. Migrate to `FieldGroup`/`Field` for
  consistent error display and `aria-invalid` wiring.

### C. Performance (remaining)

- Dashboard still runs ~13 queries; profile with `EXPLAIN` on the slowest
  (`listTransactions` with filters, `getSummary` aggregates).
- `cashflow-chart` and `category-chart` receive `number` (converted from
  `bigint` upstream) — keep an eye on precision for very large sums.
- Images/attachments: no `loading="lazy"` on receipt thumbnails; add it.
- Service worker (`sw.js`) caches aggressively; verify it doesn't serve stale
  HTML after a deploy (cache-busting).

### D. Polish (remaining)

- **Empty states**: some pages use `Empty` component, others use ad-hoc
  `<p>`. Standardise on `Empty`.
- **Toast feedback**: success messages are inline; add a toast for "Tercatat ✓"
  on quick-add so the user gets feedback even if they've scrolled.
- **Keyboard shortcuts**: `⌘K` opens the palette; add `g d`, `g t` etc. for
  quick navigation (optional).
- **Onboarding**: first-run empty state on the dashboard should point to
  "Tambah akun" then "Catat transaksi".
- **Print/export**: a "Cetak laporan" button on the dashboard (CSS
  `@media print`).
- **i18n**: strings are Indonesian-only; if multi-language is ever needed,
  extract to a dictionary. (Out of scope unless requested.)

## 4. Implementation plan (batches)

### Batch E — Mobile sticky submit bars (mechanical, low risk)

Apply the sticky-submit pattern from `transaction-form.tsx` to:
`account-form`, `budget-form`, `category-form`, `plan-form`, `plan-item-form`,
`recurring-form`, `rule-builder-form`, `settings-form`, `snapshot-form`,
`transfer-form`.

**Effort**: ~1 h. **Risk**: low. **Gate**: biome + typecheck + build.

### Batch F — Form migration to `FieldGroup`/`Field` ✅ DONE

Migrated all forms (settings, account, budget, category, plan, plan-item, snapshot,
transfer, recurring, transaction, rule-builder) to `FieldGroup`/`Field`/
`FieldLabel`/`FieldDescription`. Replaced `window.confirm` in `PasskeyManager`
and `DeleteBudgetButton` with `AlertDialog`. Added toast feedback on every form
success. **Follow-up (not done):** wire `data-invalid`/`aria-invalid` per field
once server actions return per-field errors (currently errors are form-level).

**Effort**: ~3 h. **Risk**: medium (many files). **Gate**: all gates.

### Batch G — Mobile chat + inbox + import polish

- Pin chat input to the bottom of the viewport on phones.
- Stack `PushSubscribe` button below text on narrow screens.
- Collapse import textarea to ~6 rows on mobile; keep file picker primary.

**Effort**: ~1.5 h. **Risk**: low.

### Batch H — Performance profiling

- Run `EXPLAIN` on the 3 slowest queries; add indexes if missing.
- Add `loading="lazy"` to attachment thumbnails.
- Verify service-worker cache busting.

**Effort**: ~2 h. **Risk**: medium (DB changes).

### Batch I — Toast + empty-state standardisation

- Add a `toast` component (shadcn) and wire quick-add success + form saves.
- Replace ad-hoc empty states with the `Empty` component everywhere.

**Effort**: ~2 h. **Risk**: low.

### Batch J — Onboarding + print

- First-run dashboard empty state with guided steps.
- `@media print` stylesheet + "Cetak laporan" button.

**Effort**: ~2 h. **Risk**: low.

## 5. Out of scope (unless explicitly requested)

- Multi-language i18n.
- Native mobile app (React Native / Capacitor).
- Real-time sync / WebSocket.
- Multi-user / team features (schema is multi-user ready, but UI is single-owner).

## 6. Verification checklist for every batch

- [ ] `PATH="/home/dhanu/.bun/bin:$PATH" bun run typecheck`
- [ ] `PATH="/home/dhanu/.bun/bin:$PATH" bunx @biomejs/biome check`
- [ ] `PATH="/home/dhanu/.bun/bin:$PATH" bun test`
- [ ] `PATH="/home/dhanu/.bun/bin:$PATH" bun run build`
- [ ] Manual smoke test on a 375 px viewport (Chrome DevTools) and on
  `http://192.168.32.2:3000` over LAN.
- [ ] No new `console.error` / accessibility warnings in dev tools.
