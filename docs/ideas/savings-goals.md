# Savings Goals (Target Tabungan & Reservasi Dana)

## Problem Statement

How might we enable users to set aside money and save toward tangible targets (emergency fund, gear, vacations) while strictly keeping their bank account balances identical to their real-world bank statements?

---

## The Core Constraint

> **"The bank account in the system must always carry the current real value."**
- **No fictitious transfers:** We do not create fake "Celengan" accounts and fake transfers, which would desynchronize the Cashow bank balance from m-Banking.
- **No fictitious expenses:** We do not record "savings" as expenses, which would distort monthly net cashflow and P&L statements.
- **Bank Reconciliation stays 100% pure:** Bank snapshots, statement checkpoints, and reconciliation formulas evaluate physical cashflow unhindered.

---

## Recommended Direction: Virtual Goal Reservations

Cashow already operates on a "Derive, do not store" and "Locked Allocations" architectural philosophy (seen in `Allocation` and `PaymentPlan`).

Goals operate as an **overlay reservation layer** on top of real account balances:

```
Real Bank Account Balance (BCA) = Rp 10.000.000  <-- Exactly matches m-Banking
├── Cadangan Goal "Dana Darurat" = Rp  3.000.000  (Reserved)
├── Cadangan Goal "Laptop Baru"   = Rp  1.500.000  (Reserved)
└── Saldo Bebas (Available Cash) = Rp  5.500.000  (Safe To Spend)
```

### 1. Goal Lifecycle & Workflows

1. **Create Goal (`Goal`)**:
   - Target Name (e.g. "Dana Darurat", "Beli MacBook M4", "Liburan Jepang").
   - Target Amount (e.g. Rp 30.000.000).
   - Target Date (optional, e.g. `2026-12-31`).
   - Category / Icon / Color accent.
2. **Deposit / Set Aside (`GoalReservation`)**:
   - User chooses an Account (e.g. BCA) and an amount to allocate (e.g. Rp 2.000.000).
   - **Account Balance does not change** (remains Rp 10.000.000).
   - **Goal progress increases** (+Rp 2.000.000).
   - **Safe To Spend (Batas Belanja Aman)** automatically subtracts this reservation so the user is prevented from spending it on daily discretionary purchases.
3. **Withdraw / Release Reservation**:
   - If the user changes their mind or needs liquidity, they can release funds back to "Saldo Bebas" with zero fee or friction.
4. **Fulfill / Spend from Goal**:
   - When the user finally buys the item (e.g. buys the MacBook for Rp 25.000.000), they record an ordinary `EXPENSE` from BCA and link it to the Goal.
   - The reservation is unlocked and marked fulfilled, and the real expense deducts from BCA.

---

## Pacing & Financial Health Integration

1. **Smart Pacing Engine**:
   - Calculates monthly / weekly required contribution:
     $$\text{Target Bulanan} = \frac{\text{Target} - \text{Terkumpul}}{\text{Sisa Bulan}}$$
   - Flags progress as:
     - `Tepat Waktu` (On Track)
     - `Perlu Tambahan` (Behind Pace)
     - `Tercapai` (Goal Completed)
2. **Over-Reservation Guard (Reality Check)**:
   - If emergency spending causes the real account balance to drop below total reserved goals, Cashow flags the goal:
     - `Terganggu (Defisit kas riil Rp X)` instead of pretending the reservation is insulated from real-world bankruptcy.

---

## Data Model Design (Prisma Contract)

```prisma
model Goal {
  id             String            @id @onCreate(uuid(7))
  userId         String
  user           User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  name           String
  description    String?
  targetAmount   BigInt
  targetDate     DateString?
  color          String?
  icon           String?
  status         GoalStatus        @default(ACTIVE)
  archivedAt     TimestamptzString?
  createdAt      TimestamptzString @onCreate(now())
  updatedAt      TimestamptzString @onCreate(now()) @onUpdate(now())

  reservations   GoalReservation[]

  @@index([userId])
  @@index([userId, status])
}

enum GoalStatus {
  ACTIVE
  PAUSED
  COMPLETED
  ARCHIVED
}

model GoalReservation {
  id             String      @id @onCreate(uuid(7))
  userId         String
  user           User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  goalId         String
  goal           Goal        @relation(fields: [goalId], references: [id], onDelete: Cascade)
  accountId      String
  account        Account     @relation(fields: [accountId], references: [id], onDelete: Restrict)
  amount         BigInt
  note           String?
  createdAt      TimestamptzString @onCreate(now())

  @@index([userId, goalId])
  @@index([accountId])
}
```

---

## Key Assumptions to Validate

- [ ] Users understand the difference between _real bank balance_ and _saldo bebas (unreserved cash)_ without feeling confused when checking m-Banking.
- [ ] Subtracting goal reservations from the "Batas Belanja Aman" (Safe to Spend) effectively prevents impulsive spending without making users feel cash-starved.
- [ ] Linking a final expense transaction to a goal feels intuitive as a closing milestone.

---

## MVP Scope (Phase 1)

- **Goal Management Screen (`/app/goals`)**:
  - List of active goals with progress rings, collected amount, target, and remaining time.
  - "Buat Target Baru" dialog form (Target name, amount, target date, source accounts).
- **Deposit / Reservasi Action**:
  - Set aside money from an account (`GoalReservation`).
  - Progress bar recalculation.
- **Account View Integration (`/app/accounts`)**:
  - Show sub-pills under accounts: `Saldo Total Rp 10.000.000` · `Rp 3.000.000 Dicadangkan untuk Goals`.
- **Safe to Spend (`getSafeToSpend`) Update**:
  - Integrate active reservations into the daily safe-to-spend calculation:
    $$\text{Available to Spend} = \text{Liquid Balances} - \text{Upcoming Drafts} - \text{Goal Reservations}$$

---

## Not Doing (and Why)

- **Virtual Interest / Investment compounding simulation**: Cashow is a precision ledger, not a robo-advisor or mutual fund platform. Real interest is logged as an `INCOME` from the bank.
- **Auto-debit from real banks**: Cashow operates on local data sovereignty with no third-party open-banking aggregators or scraping credentials.
- **Multi-currency goal reservations in MVP**: Keep reservations denominated in the account's primary currency (IDR) to avoid FX rate fluctuations distorting targets.

---

## Open Questions

1. Should users be able to lock multiple accounts to a single goal (e.g. Rp 2jt di BCA + Rp 1jt di Mandiri untuk 1 target laptop)? _(Recommended: Yes, supported cleanly via individual `GoalReservation` rows)._
2. Should completed goals be celebrated with an achievement badge or confetti animation? _(Recommended: Yes, positive reinforcement aids long-term saving habits)._
