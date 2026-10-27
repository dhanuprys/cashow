#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/bcbc0ebb82b058d57e4dadab5fa0619cee244c8cfded7b4e35e6660fa0e9c34b/contract';
import startContract from '../../snapshots/bcbc0ebb82b058d57e4dadab5fa0619cee244c8cfded7b4e35e6660fa0e9c34b/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/d7af935b39ceffe99bfd2da9505905a36754c373439fbc53f79ece8edf61f714/contract';
import endContract from '../../snapshots/d7af935b39ceffe99bfd2da9505905a36754c373439fbc53f79ece8edf61f714/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  lit,
  primaryKey,
  rawSql,
  sql,
} from '@prisma/orm-postgres/migration';

// ---------------------------------------------------------------------------
// Phase 2 invariants (plan §2, rule 5)
// ---------------------------------------------------------------------------
//
// The planner below builds the tables, columns and checks. The raw operations
// at the end of `operations` add the cross-row invariants a CHECK cannot
// express:
//   - a payment-plan item belongs to its plan's owner;
//   - a plan-linked income points at an item of the same owner and live plan;
//   - a transfer fee points at the same owner's transfer and its source account;
//   - an active checkpoint freezes transactions and snapshots at or before it;
//   - a checkpoint can only mark a zero-gap snapshot.

const ACTIVE_CHECKPOINT_FN = `
CREATE OR REPLACE FUNCTION "public"."cashow_active_checkpoint_at"(
  p_account_id text,
  p_instant timestamptz
)
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $fn$
  SELECT c."snapshotAt"
  FROM "public"."ReconciliationCheckpoint" c
  WHERE c."accountId" = p_account_id
    AND c."unlockedAt" IS NULL
    AND c."snapshotAt" >= p_instant
  ORDER BY c."snapshotAt" ASC
  LIMIT 1;
$fn$;
`;

const TRANSACTION_CHECKPOINT_LOCK_FN = `
CREATE OR REPLACE FUNCTION "public"."cashow_check_transaction_checkpoint_lock"()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
DECLARE
  locked_at timestamptz;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    locked_at := "public"."cashow_active_checkpoint_at"(OLD."accountId", OLD."occurredAt");
    IF locked_at IS NOT NULL THEN
      RAISE EXCEPTION 'transaction is locked by a checkpoint at %', locked_at
        USING ERRCODE = 'check_violation';
    END IF;
    IF OLD."destinationAccountId" IS NOT NULL THEN
      locked_at := "public"."cashow_active_checkpoint_at"(OLD."destinationAccountId", OLD."occurredAt");
      IF locked_at IS NOT NULL THEN
        RAISE EXCEPTION 'transaction destination is locked by a checkpoint at %', locked_at
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    locked_at := "public"."cashow_active_checkpoint_at"(NEW."accountId", NEW."occurredAt");
    IF locked_at IS NOT NULL THEN
      RAISE EXCEPTION 'transaction is locked by a checkpoint at %', locked_at
        USING ERRCODE = 'check_violation';
    END IF;
    IF NEW."destinationAccountId" IS NOT NULL THEN
      locked_at := "public"."cashow_active_checkpoint_at"(NEW."destinationAccountId", NEW."occurredAt");
      IF locked_at IS NOT NULL THEN
        RAISE EXCEPTION 'transaction destination is locked by a checkpoint at %', locked_at
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$fn$;
`;

const TRANSACTION_CHECKPOINT_LOCK_TRIGGER = `
CREATE TRIGGER "Transaction_checkpoint_lock"
BEFORE INSERT OR UPDATE OR DELETE ON "public"."Transaction"
FOR EACH ROW EXECUTE FUNCTION "public"."cashow_check_transaction_checkpoint_lock"();
`;

const SNAPSHOT_CHECKPOINT_LOCK_FN = `
CREATE OR REPLACE FUNCTION "public"."cashow_check_snapshot_checkpoint_lock"()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
DECLARE
  locked_at timestamptz;
  account_user text;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    locked_at := "public"."cashow_active_checkpoint_at"(OLD."accountId", OLD."recordedAt");
    IF locked_at IS NOT NULL THEN
      RAISE EXCEPTION 'snapshot is locked by a checkpoint at %', locked_at
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    SELECT a."userId" INTO account_user FROM "public"."Account" a WHERE a."id" = NEW."accountId";
    IF NOT FOUND THEN
      RAISE EXCEPTION 'snapshot account % does not exist', NEW."accountId"
        USING ERRCODE = 'foreign_key_violation';
    END IF;
    IF account_user <> NEW."userId" THEN
      RAISE EXCEPTION 'snapshot account belongs to another user'
        USING ERRCODE = 'check_violation';
    END IF;

    locked_at := "public"."cashow_active_checkpoint_at"(NEW."accountId", NEW."recordedAt");
    IF locked_at IS NOT NULL THEN
      RAISE EXCEPTION 'snapshot is locked by a checkpoint at %', locked_at
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$fn$;
`;

const SNAPSHOT_CHECKPOINT_LOCK_TRIGGER = `
CREATE TRIGGER "BalanceSnapshot_checkpoint_lock"
BEFORE INSERT OR UPDATE OR DELETE ON "public"."BalanceSnapshot"
FOR EACH ROW EXECUTE FUNCTION "public"."cashow_check_snapshot_checkpoint_lock"();
`;

const PLAN_ITEM_LINKS_FN = `
CREATE OR REPLACE FUNCTION "public"."cashow_check_plan_item_links"()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
DECLARE
  plan_user text;
BEGIN
  SELECT p."userId" INTO plan_user
  FROM "public"."PaymentPlan" p
  WHERE p."id" = NEW."planId";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'plan % does not exist', NEW."planId"
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF plan_user <> NEW."userId" THEN
    RAISE EXCEPTION 'plan item crosses users'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$fn$;
`;

const PLAN_ITEM_LINKS_TRIGGER = `
CREATE TRIGGER "PaymentPlanItem_links_check"
BEFORE INSERT OR UPDATE OF "planId", "userId" ON "public"."PaymentPlanItem"
FOR EACH ROW EXECUTE FUNCTION "public"."cashow_check_plan_item_links"();
`;

const TRANSACTION_PLAN_LINKS_FN = `
CREATE OR REPLACE FUNCTION "public"."cashow_check_transaction_plan_links"()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
DECLARE
  item_user text;
  item_plan text;
  plan_archived timestamptz;
  transfer_user text;
  transfer_type text;
  transfer_account text;
BEGIN
  IF NEW."planItemId" IS NOT NULL THEN
    SELECT i."userId", i."planId", p."archivedAt"
      INTO item_user, item_plan, plan_archived
    FROM "public"."PaymentPlanItem" i
    JOIN "public"."PaymentPlan" p ON p."id" = i."planId"
    WHERE i."id" = NEW."planItemId";
    IF NOT FOUND THEN
      RAISE EXCEPTION 'plan item % does not exist', NEW."planItemId"
        USING ERRCODE = 'foreign_key_violation';
    END IF;
    IF item_user <> NEW."userId" THEN
      RAISE EXCEPTION 'plan item belongs to another user'
        USING ERRCODE = 'check_violation';
    END IF;
    IF plan_archived IS NOT NULL THEN
      RAISE EXCEPTION 'plan item belongs to an archived plan'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF NEW."transferId" IS NOT NULL THEN
    SELECT t."userId", t."type", t."accountId"
      INTO transfer_user, transfer_type, transfer_account
    FROM "public"."Transaction" t
    WHERE t."id" = NEW."transferId";
    IF NOT FOUND THEN
      RAISE EXCEPTION 'transfer % does not exist', NEW."transferId"
        USING ERRCODE = 'foreign_key_violation';
    END IF;
    IF transfer_user <> NEW."userId" THEN
      RAISE EXCEPTION 'transfer fee crosses users'
        USING ERRCODE = 'check_violation';
    END IF;
    IF transfer_type <> 'TRANSFER' THEN
      RAISE EXCEPTION 'transfer fee points at a %', transfer_type
        USING ERRCODE = 'check_violation';
    END IF;
    IF NEW."accountId" <> transfer_account THEN
      RAISE EXCEPTION 'transfer fee must use the transfer source account'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$fn$;
`;

const TRANSACTION_PLAN_LINKS_TRIGGER = `
CREATE TRIGGER "Transaction_plan_links_check"
BEFORE INSERT OR UPDATE OF "planItemId", "transferId", "type", "userId", "accountId"
ON "public"."Transaction"
FOR EACH ROW EXECUTE FUNCTION "public"."cashow_check_transaction_plan_links"();
`;

const CHECKPOINT_GUARD_FN = `
CREATE OR REPLACE FUNCTION "public"."cashow_check_checkpoint_guard"()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
DECLARE
  snap_amount bigint;
  snap_recorded timestamptz;
  snap_account text;
  snap_user text;
  snap_deleted timestamptz;
  prev_amount bigint;
  prev_recorded timestamptz;
  base bigint;
  movement bigint;
  expected bigint;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW."snapshotId" IS DISTINCT FROM OLD."snapshotId"
       OR NEW."snapshotAt" IS DISTINCT FROM OLD."snapshotAt"
       OR NEW."accountId" IS DISTINCT FROM OLD."accountId"
       OR NEW."userId" IS DISTINCT FROM OLD."userId" THEN
      RAISE EXCEPTION 'checkpoint identity is immutable'
        USING ERRCODE = 'check_violation';
    END IF;
    IF OLD."unlockedAt" IS NOT NULL
       AND NEW."unlockedAt" IS DISTINCT FROM OLD."unlockedAt" THEN
      RAISE EXCEPTION 'checkpoint is already unlocked'
        USING ERRCODE = 'check_violation';
    END IF;
    IF OLD."unlockedAt" IS NULL AND NEW."unlockedAt" IS NULL
       AND NEW."unlockReason" IS DISTINCT FROM OLD."unlockReason" THEN
      RAISE EXCEPTION 'an unlock reason requires an unlock'
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  SELECT "amount", "recordedAt", "accountId", "userId", "deletedAt"
    INTO snap_amount, snap_recorded, snap_account, snap_user, snap_deleted
  FROM "public"."BalanceSnapshot"
  WHERE "id" = NEW."snapshotId";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'checkpoint snapshot % does not exist', NEW."snapshotId"
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF snap_deleted IS NOT NULL THEN
    RAISE EXCEPTION 'checkpoint snapshot is soft-deleted'
      USING ERRCODE = 'check_violation';
  END IF;
  IF snap_account <> NEW."accountId" OR snap_user <> NEW."userId" THEN
    RAISE EXCEPTION 'checkpoint snapshot belongs to another account or user'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW."snapshotAt" IS DISTINCT FROM snap_recorded THEN
    RAISE EXCEPTION 'checkpoint snapshotAt must equal the snapshot instant'
      USING ERRCODE = 'check_violation';
  END IF;

  prev_amount := NULL;
  prev_recorded := NULL;
  SELECT s."amount", s."recordedAt" INTO prev_amount, prev_recorded
  FROM "public"."BalanceSnapshot" s
  WHERE s."accountId" = NEW."accountId"
    AND s."deletedAt" IS NULL
    AND s."recordedAt" < NEW."snapshotAt"
  ORDER BY s."recordedAt" DESC
  LIMIT 1;

  IF FOUND THEN
    base := prev_amount;
  ELSE
    SELECT a."openingBalance" INTO base
    FROM "public"."Account" a
    WHERE a."id" = NEW."accountId";
  END IF;

  SELECT COALESCE(SUM(x.delta), 0) INTO movement
  FROM (
    SELECT CASE WHEN t."type" IN ('EXPENSE', 'TRANSFER') THEN -t."amount" ELSE t."amount" END AS delta
    FROM "public"."Transaction" t
    WHERE t."userId" = NEW."userId"
      AND t."deletedAt" IS NULL
      AND t."accountId" = NEW."accountId"
      AND t."occurredAt" <= NEW."snapshotAt"
      AND (prev_recorded IS NULL OR t."occurredAt" > prev_recorded)
    UNION ALL
    SELECT t."amount" AS delta
    FROM "public"."Transaction" t
    WHERE t."userId" = NEW."userId"
      AND t."deletedAt" IS NULL
      AND t."type" = 'TRANSFER'
      AND t."destinationAccountId" = NEW."accountId"
      AND t."occurredAt" <= NEW."snapshotAt"
      AND (prev_recorded IS NULL OR t."occurredAt" > prev_recorded)
  ) x;

  expected := base + movement;
  IF snap_amount <> expected THEN
    RAISE EXCEPTION 'checkpoint requires a zero-gap snapshot (gap %)', (snap_amount - expected)
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$fn$;
`;

const CHECKPOINT_GUARD_TRIGGER = `
CREATE TRIGGER "ReconciliationCheckpoint_guard"
BEFORE INSERT OR UPDATE ON "public"."ReconciliationCheckpoint"
FOR EACH ROW EXECUTE FUNCTION "public"."cashow_check_checkpoint_guard"();
`;

function rawInvariantOp(
  id: string,
  label: string,
  statement: string,
  invariantId?: string,
) {
  return rawSql({
    id,
    label,
    operationClass: 'additive',
    target: { id: 'postgres' },
    ...(invariantId === undefined ? {} : { invariantId }),
    precheck: [],
    execute: [{ description: label, sql: statement, params: [] }],
    postcheck: [],
  });
}

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropConstraint({
        schema: 'public',
        table: 'BalanceSnapshot',
        constraint: 'BalanceSnapshot_accountId_recordedAt_key',
      }),
      this.dropIndex({
        schema: 'public',
        table: 'ReconciliationCheckpoint',
        index: 'ReconciliationCheckpoint_accountId_verifiedAt_idx_b454d1d4',
      }),
      this.createTable({
        schema: 'public',
        table: 'PaymentPlan',
        columns: [
          col('archivedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'PaymentPlanItem',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('dueOn', 'date', { codecRef: { codecId: 'pg/date-string@1' } }),
          col('expectedAmount', 'int8', { notNull: true, codecRef: { codecId: 'pg/int8@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('label', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('note', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('planId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('sortOrder', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('expected_amount_positive_62ceb3db', sql`"expectedAmount" > 0`),
        ],
      }),
      this.addColumn({
        schema: 'public',
        table: 'Attachment',
        column: col('planId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Attachment',
        column: col('planItemId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'ReconciliationCheckpoint',
        column: col('unlockReason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Transaction',
        column: col('planItemId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Transaction',
        column: col('transferId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumnWithTemporaryDefault({
        schema: 'public',
        table: 'ReconciliationCheckpoint',
        column: 'snapshotAt',
        type: 'timestamptz',
        temporaryDefault: sql`'epoch'`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'Attachment',
        constraint: 'attachment_one_target_a019a492',
        expression: sql`num_nonnulls("transactionId", "planId", "planItemId") = 1`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'Transaction',
        constraint: 'plan_item_only_for_income_9ae1d02a',
        expression: sql`"planItemId" IS NULL OR "type" = 'INCOME'`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'Transaction',
        constraint: 'transfer_fee_only_for_expense_075b2aad',
        expression: sql`"transferId" IS NULL OR "type" = 'EXPENSE'`,
      }),
      this.addUnique({
        schema: 'public',
        table: 'Transaction',
        constraint: 'Transaction_transferId_key',
        columns: ['transferId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Attachment',
        index: 'Attachment_planId_idx_5b32079a',
        columns: ['planId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Attachment',
        index: 'Attachment_planItemId_idx_c9fb8d06',
        columns: ['planItemId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Attachment',
        index: 'Attachment_userId_planId_idx_092164f4',
        columns: ['userId', 'planId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Attachment',
        index: 'Attachment_userId_planItemId_idx_2d4e875e',
        columns: ['userId', 'planItemId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'BalanceSnapshot',
        index: 'BalanceSnapshot_live_unique_24c6a3e9',
        columns: ['accountId', 'recordedAt'],
        extras: { where: sql`"deletedAt" IS NULL`, unique: true },
      }),
      this.createIndex({
        schema: 'public',
        table: 'BalanceSnapshot',
        index: 'BalanceSnapshot_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'PaymentPlan',
        index: 'PaymentPlan_userId_archivedAt_idx_7b90304b',
        columns: ['userId', 'archivedAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'PaymentPlan',
        index: 'PaymentPlan_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'PaymentPlanItem',
        index: 'PaymentPlanItem_planId_idx_5b32079a',
        columns: ['planId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'PaymentPlanItem',
        index: 'PaymentPlanItem_planId_sortOrder_idx_d47cc6ce',
        columns: ['planId', 'sortOrder'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'PaymentPlanItem',
        index: 'PaymentPlanItem_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'PaymentPlanItem',
        index: 'PaymentPlanItem_userId_planId_idx_092164f4',
        columns: ['userId', 'planId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ReconciliationCheckpoint',
        index: 'Checkpoint_active_unique_bb3efe8e',
        columns: ['accountId', 'snapshotAt'],
        extras: { where: sql`"unlockedAt" IS NULL`, unique: true },
      }),
      this.createIndex({
        schema: 'public',
        table: 'ReconciliationCheckpoint',
        index: 'ReconciliationCheckpoint_snapshotId_idx_e639e2e6',
        columns: ['snapshotId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ReconciliationCheckpoint',
        index: 'ReconciliationCheckpoint_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Transaction',
        index: 'Transaction_planItemId_idx_c9fb8d06',
        columns: ['planItemId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'BalanceSnapshot',
        foreignKey: {
          name: 'BalanceSnapshot_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'PaymentPlan',
        foreignKey: {
          name: 'PaymentPlan_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Attachment',
        foreignKey: {
          name: 'Attachment_planId_fkey',
          columns: ['planId'],
          references: { schema: 'public', table: 'PaymentPlan', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'PaymentPlanItem',
        foreignKey: {
          name: 'PaymentPlanItem_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'PaymentPlanItem',
        foreignKey: {
          name: 'PaymentPlanItem_planId_fkey',
          columns: ['planId'],
          references: { schema: 'public', table: 'PaymentPlan', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Attachment',
        foreignKey: {
          name: 'Attachment_planItemId_fkey',
          columns: ['planItemId'],
          references: { schema: 'public', table: 'PaymentPlanItem', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ReconciliationCheckpoint',
        foreignKey: {
          name: 'ReconciliationCheckpoint_snapshotId_fkey',
          columns: ['snapshotId'],
          references: { schema: 'public', table: 'BalanceSnapshot', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ReconciliationCheckpoint',
        foreignKey: {
          name: 'ReconciliationCheckpoint_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Transaction',
        foreignKey: {
          name: 'Transaction_planItemId_fkey',
          columns: ['planItemId'],
          references: { schema: 'public', table: 'PaymentPlanItem', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Transaction',
        foreignKey: {
          name: 'Transaction_transferId_fkey',
          columns: ['transferId'],
          references: { schema: 'public', table: 'Transaction', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      rawInvariantOp(
        'function.cashow_active_checkpoint_at',
        'Create active-checkpoint lookup function',
        ACTIVE_CHECKPOINT_FN,
      ),
      rawInvariantOp(
        'function.cashow_check_transaction_checkpoint_lock',
        'Create transaction checkpoint lock function',
        TRANSACTION_CHECKPOINT_LOCK_FN,
      ),
      rawInvariantOp(
        'trigger.Transaction_checkpoint_lock',
        'Create transaction checkpoint lock trigger',
        TRANSACTION_CHECKPOINT_LOCK_TRIGGER,
        'cashow:checkpoint-locks:transactions',
      ),
      rawInvariantOp(
        'function.cashow_check_snapshot_checkpoint_lock',
        'Create snapshot checkpoint lock function',
        SNAPSHOT_CHECKPOINT_LOCK_FN,
      ),
      rawInvariantOp(
        'trigger.BalanceSnapshot_checkpoint_lock',
        'Create snapshot checkpoint lock trigger',
        SNAPSHOT_CHECKPOINT_LOCK_TRIGGER,
        'cashow:checkpoint-locks:snapshots',
      ),
      rawInvariantOp(
        'function.cashow_check_plan_item_links',
        'Create payment-plan item ownership function',
        PLAN_ITEM_LINKS_FN,
      ),
      rawInvariantOp(
        'trigger.PaymentPlanItem_links_check',
        'Create payment-plan item ownership trigger',
        PLAN_ITEM_LINKS_TRIGGER,
        'cashow:plan-item-links',
      ),
      rawInvariantOp(
        'function.cashow_check_transaction_plan_links',
        'Create transaction plan/transfer link function',
        TRANSACTION_PLAN_LINKS_FN,
      ),
      rawInvariantOp(
        'trigger.Transaction_plan_links_check',
        'Create transaction plan/transfer link trigger',
        TRANSACTION_PLAN_LINKS_TRIGGER,
        'cashow:transaction-plan-links',
      ),
      rawInvariantOp(
        'function.cashow_check_checkpoint_guard',
        'Create zero-gap checkpoint guard function',
        CHECKPOINT_GUARD_FN,
      ),
      rawInvariantOp(
        'trigger.ReconciliationCheckpoint_guard',
        'Create zero-gap checkpoint guard trigger',
        CHECKPOINT_GUARD_TRIGGER,
        'cashow:checkpoint-zero-gap',
      ),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
