#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/5c3b75851cca2c0a633f49f374cf85abfa0fd5ccc6285f6afa41dc115d487a58/contract';
import startContract from '../../snapshots/5c3b75851cca2c0a633f49f374cf85abfa0fd5ccc6285f6afa41dc115d487a58/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/bcbc0ebb82b058d57e4dadab5fa0619cee244c8cfded7b4e35e6660fa0e9c34b/contract';
import endContract from '../../snapshots/bcbc0ebb82b058d57e4dadab5fa0619cee244c8cfded7b4e35e6660fa0e9c34b/contract.json' with { type: 'json' };
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
// Cross-row invariants (plan §2, rule 5)
// ---------------------------------------------------------------------------
//
// The baseline installed allocation-sum triggers. This migration tightens them
// for Phase 1:
//   - soft-deleted transactions void their allocations, so sums only count
//     allocations whose two transactions are both live;
//   - an allocation must join an EXPENSE to an INCOME of the same user;
//   - an account/category on a transaction must belong to the same user, and a
//     category's kind must match the transaction type.

const ASSERT_ALLOCATION_SUM_FN = `
CREATE OR REPLACE FUNCTION "public"."cashow_assert_allocation_sum"(tx_id text)
RETURNS void
LANGUAGE plpgsql
AS $fn$
DECLARE
  tx_amount bigint;
  tx_deleted timestamptz;
  allocated bigint;
BEGIN
  IF tx_id IS NULL THEN
    RETURN;
  END IF;

  SELECT "amount", "deletedAt" INTO tx_amount, tx_deleted
  FROM "public"."Transaction" WHERE "id" = tx_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- A deleted transaction's allocations are void, so nothing can exceed it.
  IF tx_deleted IS NOT NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(a."amount"), 0) INTO allocated
  FROM "public"."Allocation" a
  JOIN "public"."Transaction" e ON e."id" = a."expenseId"
  JOIN "public"."Transaction" i ON i."id" = a."incomeId"
  WHERE (a."expenseId" = tx_id OR a."incomeId" = tx_id)
    AND e."deletedAt" IS NULL
    AND i."deletedAt" IS NULL;

  IF allocated > tx_amount THEN
    RAISE EXCEPTION
      'allocation sum % exceeds transaction % amount %', allocated, tx_id, tx_amount
      USING ERRCODE = 'check_violation';
  END IF;
END;
$fn$;
`;

const ASSERT_ALLOCATION_LINKS_FN = `
CREATE OR REPLACE FUNCTION "public"."cashow_check_allocation_links"()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
DECLARE
  expense_type text;
  expense_user text;
  expense_deleted timestamptz;
  income_type text;
  income_user text;
  income_deleted timestamptz;
BEGIN
  SELECT "type", "userId", "deletedAt"
    INTO expense_type, expense_user, expense_deleted
  FROM "public"."Transaction" WHERE "id" = NEW."expenseId";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'allocation expense % does not exist', NEW."expenseId"
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  SELECT "type", "userId", "deletedAt"
    INTO income_type, income_user, income_deleted
  FROM "public"."Transaction" WHERE "id" = NEW."incomeId";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'allocation income % does not exist', NEW."incomeId"
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF expense_type <> 'EXPENSE' THEN
    RAISE EXCEPTION 'allocation expense % is a %', NEW."expenseId", expense_type
      USING ERRCODE = 'check_violation';
  END IF;
  IF income_type <> 'INCOME' THEN
    RAISE EXCEPTION 'allocation income % is a %', NEW."incomeId", income_type
      USING ERRCODE = 'check_violation';
  END IF;
  IF expense_user <> income_user OR expense_user <> NEW."userId" THEN
    RAISE EXCEPTION 'allocation crosses users'
      USING ERRCODE = 'check_violation';
  END IF;
  IF expense_deleted IS NOT NULL OR income_deleted IS NOT NULL THEN
    RAISE EXCEPTION 'allocation references a soft-deleted transaction'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$fn$;
`;

const ALLOCATION_LINKS_TRIGGER = `
CREATE TRIGGER "Allocation_links_check"
BEFORE INSERT OR UPDATE OF "expenseId", "incomeId", "userId" ON "public"."Allocation"
FOR EACH ROW EXECUTE FUNCTION "public"."cashow_check_allocation_links"();
`;

const TRANSACTION_SUMS_FN = `
CREATE OR REPLACE FUNCTION "public"."cashow_check_transaction_allocation_sums"()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
BEGIN
  -- Re-check on an amount edit and when a soft-deleted row is restored: the
  -- allocations survived the delete and must still fit the amount.
  IF NEW."amount" IS DISTINCT FROM OLD."amount"
     OR (OLD."deletedAt" IS NOT NULL AND NEW."deletedAt" IS NULL) THEN
    PERFORM "public"."cashow_assert_allocation_sum"(NEW."id");
  END IF;
  RETURN NULL;
END;
$fn$;
`;

const TRANSACTION_SUMS_TRIGGER = `
DROP TRIGGER IF EXISTS "Transaction_allocation_sums_check" ON "public"."Transaction";
CREATE TRIGGER "Transaction_allocation_sums_check"
AFTER UPDATE OF "amount", "deletedAt" ON "public"."Transaction"
FOR EACH ROW EXECUTE FUNCTION "public"."cashow_check_transaction_allocation_sums"();
`;

const TRANSACTION_LINKS_FN = `
CREATE OR REPLACE FUNCTION "public"."cashow_check_transaction_links"()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
DECLARE
  account_user text;
  destination_user text;
  category_kind text;
  category_user text;
BEGIN
  SELECT "userId" INTO account_user FROM "public"."Account" WHERE "id" = NEW."accountId";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'transaction account % does not exist', NEW."accountId"
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF account_user <> NEW."userId" THEN
    RAISE EXCEPTION 'transaction account belongs to another user'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW."destinationAccountId" IS NOT NULL THEN
    SELECT "userId" INTO destination_user
    FROM "public"."Account" WHERE "id" = NEW."destinationAccountId";
    IF NOT FOUND THEN
      RAISE EXCEPTION 'destination account % does not exist', NEW."destinationAccountId"
        USING ERRCODE = 'foreign_key_violation';
    END IF;
    IF destination_user <> NEW."userId" THEN
      RAISE EXCEPTION 'destination account belongs to another user'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF NEW."categoryId" IS NOT NULL THEN
    SELECT "kind", "userId" INTO category_kind, category_user
    FROM "public"."Category" WHERE "id" = NEW."categoryId";
    IF NOT FOUND THEN
      RAISE EXCEPTION 'category % does not exist', NEW."categoryId"
        USING ERRCODE = 'foreign_key_violation';
    END IF;
    IF category_user <> NEW."userId" THEN
      RAISE EXCEPTION 'category belongs to another user'
        USING ERRCODE = 'check_violation';
    END IF;
    IF category_kind <> NEW."type" THEN
      RAISE EXCEPTION 'category kind % does not match transaction type %',
        category_kind, NEW."type"
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$fn$;
`;

const TRANSACTION_LINKS_TRIGGER = `
CREATE TRIGGER "Transaction_links_check"
BEFORE INSERT OR UPDATE OF "accountId", "destinationAccountId", "categoryId", "type", "userId"
ON "public"."Transaction"
FOR EACH ROW EXECUTE FUNCTION "public"."cashow_check_transaction_links"();
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
      this.createTable({
        schema: 'public',
        table: 'Attachment',
        columns: [
          col('byteSize', 'int8', { notNull: true, codecRef: { codecId: 'pg/int8@1' } }),
          col('contentHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('deletedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('fileName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('kind', 'text', {
            notNull: true,
            default: lit('PROOF'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('mimeType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('storageKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('transactionId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'Attachment_kind_check_dbbf4211',
            sql`"kind" IN ('PROOF', 'INVOICE', 'CONTRACT', 'RECEIPT')`,
          ),
          checkExpression('byte_size_positive_1e79ac18', sql`"byteSize" > 0`),
        ],
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'Transaction',
        constraint: 'category_only_for_cashflow_53b9b050',
        expression: sql`"type" IN ('INCOME', 'EXPENSE') OR "categoryId" IS NULL`,
      }),
      this.createIndex({
        schema: 'public',
        table: 'Attachment',
        index: 'Attachment_storageKey_idx_8c086641',
        columns: ['storageKey'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Attachment',
        index: 'Attachment_transactionId_idx_d3180832',
        columns: ['transactionId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Attachment',
        index: 'Attachment_userId_contentHash_idx_0c2869d7',
        columns: ['userId', 'contentHash'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Attachment',
        index: 'Attachment_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Attachment',
        index: 'Attachment_userId_transactionId_idx_97becd7c',
        columns: ['userId', 'transactionId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Transaction',
        index: 'Transaction_live_recent_idx_cf2432fd',
        columns: ['userId', 'occurredAt'],
        extras: { where: sql`"deletedAt" IS NULL` },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Attachment',
        foreignKey: {
          name: 'Attachment_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Attachment',
        foreignKey: {
          name: 'Attachment_transactionId_fkey',
          columns: ['transactionId'],
          references: { schema: 'public', table: 'Transaction', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      rawInvariantOp(
        'function.cashow_assert_allocation_sum',
        'Tighten allocation sums for soft-deleted transactions',
        ASSERT_ALLOCATION_SUM_FN,
        'cashow:allocation-sums:soft-delete',
      ),
      rawInvariantOp(
        'function.cashow_check_allocation_links',
        'Create allocation link validation function',
        ASSERT_ALLOCATION_LINKS_FN,
      ),
      rawInvariantOp(
        'trigger.Allocation_links_check',
        'Create allocation link trigger',
        ALLOCATION_LINKS_TRIGGER,
        'cashow:allocation-links',
      ),
      rawInvariantOp(
        'function.cashow_check_transaction_allocation_sums',
        'Re-check allocation sums on restore',
        TRANSACTION_SUMS_FN,
        'cashow:allocation-sums:restore',
      ),
      rawInvariantOp(
        'trigger.Transaction_allocation_sums_check',
        'Recreate transaction allocation sums trigger',
        TRANSACTION_SUMS_TRIGGER,
        'cashow:allocation-sums:transactions',
      ),
      rawInvariantOp(
        'function.cashow_check_transaction_links',
        'Create transaction link validation function',
        TRANSACTION_LINKS_FN,
      ),
      rawInvariantOp(
        'trigger.Transaction_links_check',
        'Create transaction link trigger',
        TRANSACTION_LINKS_TRIGGER,
        'cashow:transaction-links',
      ),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
