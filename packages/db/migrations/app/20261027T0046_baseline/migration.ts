#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/23ecf9852bcc32288db1e9efc1ff9953ed93c31054f3ed19339c30e1c338f78a/contract';
import endContract from '../../snapshots/23ecf9852bcc32288db1e9efc1ff9953ed93c31054f3ed19339c30e1c338f78a/contract.json' with { type: 'json' };
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

// --- Cross-row invariants ---------------------------------------------------
// Plan rule 5: "allocation sums never exceed either side". A CHECK cannot read
// other rows, so the invariant is installed as trigger functions over the
// Allocation and Transaction tables.
const CHECK_ALLOCATION_SUM_FN = `
CREATE OR REPLACE FUNCTION "public"."cashow_assert_allocation_sum"(tx_id text)
RETURNS void
LANGUAGE plpgsql
AS $fn$
DECLARE
  tx_amount bigint;
  allocated bigint;
BEGIN
  IF tx_id IS NULL THEN
    RETURN;
  END IF;

  SELECT "amount" INTO tx_amount FROM "public"."Transaction" WHERE "id" = tx_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM("amount"), 0) INTO allocated
  FROM "public"."Allocation"
  WHERE "expenseId" = tx_id OR "incomeId" = tx_id;

  IF allocated > tx_amount THEN
    RAISE EXCEPTION
      'allocation sum % exceeds transaction % amount %', allocated, tx_id, tx_amount
      USING ERRCODE = 'check_violation';
  END IF;
END;
$fn$;
`;

const ALLOCATION_TRIGGER_FN = `
CREATE OR REPLACE FUNCTION "public"."cashow_check_allocation_sums"()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    PERFORM "public"."cashow_assert_allocation_sum"(OLD."expenseId");
    PERFORM "public"."cashow_assert_allocation_sum"(OLD."incomeId");
  END IF;
  IF TG_OP <> 'DELETE' THEN
    PERFORM "public"."cashow_assert_allocation_sum"(NEW."expenseId");
    PERFORM "public"."cashow_assert_allocation_sum"(NEW."incomeId");
  END IF;
  RETURN NULL;
END;
$fn$;
`;

const ALLOCATION_TRIGGER = `
CREATE TRIGGER "Allocation_sums_check"
AFTER INSERT OR UPDATE OR DELETE ON "public"."Allocation"
FOR EACH ROW EXECUTE FUNCTION "public"."cashow_check_allocation_sums"();
`;

const TRANSACTION_TRIGGER_FN = `
CREATE OR REPLACE FUNCTION "public"."cashow_check_transaction_allocation_sums"()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
BEGIN
  IF NEW."amount" IS DISTINCT FROM OLD."amount" THEN
    PERFORM "public"."cashow_assert_allocation_sum"(NEW."id");
  END IF;
  RETURN NULL;
END;
$fn$;
`;

const TRANSACTION_TRIGGER = `
CREATE TRIGGER "Transaction_allocation_sums_check"
AFTER UPDATE OF "amount" ON "public"."Transaction"
FOR EACH ROW EXECUTE FUNCTION "public"."cashow_check_transaction_allocation_sums"();
`;

function rawTriggerOp(
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

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'Account',
        columns: [
          col('archivedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('currency', 'text', {
            notNull: true,
            default: lit('IDR'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('openingBalance', 'int8', {
            notNull: true,
            default: lit('0'),
            codecRef: { codecId: 'pg/int8@1' },
          }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'Account_type_check_7982007e',
            sql`"type" IN ('BANK', 'EWALLET', 'CASH', 'INVESTMENT')`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'Allocation',
        columns: [
          col('amount', 'int8', { notNull: true, codecRef: { codecId: 'pg/int8@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('expenseId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('incomeId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('amount_positive_ed0d10ac', sql`"amount" > 0`),
          checkExpression('distinct_transactions_861e6d54', sql`"expenseId" <> "incomeId"`),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'AuditLog',
        columns: [
          col('action', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('actorId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('after', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('before', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('entityId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('entityType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'BalanceSnapshot',
        columns: [
          col('accountId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('amount', 'int8', { notNull: true, codecRef: { codecId: 'pg/int8@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('deletedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('note', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('recordedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Category',
        columns: [
          col('archivedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('color', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('icon', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('kind', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('parentId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('Category_kind_check_0551b592', sql`"kind" IN ('INCOME', 'EXPENSE')`),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'OutboxEvent',
        columns: [
          col('aggregateId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('aggregateType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('attempts', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('eventType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('lastError', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('payload', 'json', { notNull: true, codecRef: { codecId: 'pg/json@1' } }),
          col('publishedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('PENDING'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'OutboxEvent_status_check_900a3b11',
            sql`"status" IN ('PENDING', 'PROCESSED', 'FAILED')`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'ReconciliationCheckpoint',
        columns: [
          col('accountId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('snapshotId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('unlockedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('verifiedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Transaction',
        columns: [
          col('accountId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('amount', 'int8', { notNull: true, codecRef: { codecId: 'pg/int8@1' } }),
          col('categoryId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('clientRequestId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('counterparty', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('deletedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('destinationAccountId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('merchant', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('note', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('occurredAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('occurredOn', 'date', { notNull: true, codecRef: { codecId: 'pg/date-string@1' } }),
          col('source', 'text', {
            notNull: true,
            default: lit('MANUAL'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'Transaction_source_check_73329fde',
            sql`"source" IN ('MANUAL', 'QUICK_ADD', 'AI_DRAFT', 'TELEGRAM', 'STATEMENT_IMPORT', 'RECURRING', 'SHARE_TARGET')`,
          ),
          checkExpression(
            'Transaction_type_check_fb141b4e',
            sql`"type" IN ('INCOME', 'EXPENSE', 'TRANSFER', 'ADJUSTMENT')`,
          ),
          checkExpression('amount_positive_ed0d10ac', sql`"amount" > 0`),
          checkExpression(
            'transfer_accounts_differ_c65f2c57',
            sql`"type" <> 'TRANSFER' OR "destinationAccountId" <> "accountId"`,
          ),
          checkExpression(
            'transfer_destination_consistency_5fb4dafd',
            sql`("type" = 'TRANSFER') = ("destinationAccountId" IS NOT NULL)`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'User',
        columns: [
          col('budgetMonthStartDay', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('currency', 'text', {
            notNull: true,
            default: lit('IDR'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('email', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('timezone', 'text', {
            notNull: true,
            default: lit('Asia/Jakarta'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('weekStartsOn', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Allocation',
        constraint: 'Allocation_expenseId_incomeId_key',
        columns: ['expenseId', 'incomeId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'BalanceSnapshot',
        constraint: 'BalanceSnapshot_accountId_recordedAt_key',
        columns: ['accountId', 'recordedAt'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Category',
        constraint: 'Category_userId_kind_name_key',
        columns: ['userId', 'kind', 'name'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Transaction',
        constraint: 'Transaction_userId_clientRequestId_key',
        columns: ['userId', 'clientRequestId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'User',
        constraint: 'User_email_key',
        columns: ['email'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Account',
        index: 'Account_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Account',
        index: 'Account_userId_type_idx_59b0b5ce',
        columns: ['userId', 'type'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Allocation',
        index: 'Allocation_expenseId_idx_69d413fa',
        columns: ['expenseId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Allocation',
        index: 'Allocation_incomeId_idx_cf1ede6b',
        columns: ['incomeId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Allocation',
        index: 'Allocation_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AuditLog',
        index: 'AuditLog_createdAt_idx_9575dbd7',
        columns: ['createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AuditLog',
        index: 'AuditLog_userId_entityType_entityId_idx_62d2ae1f',
        columns: ['userId', 'entityType', 'entityId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'BalanceSnapshot',
        index: 'BalanceSnapshot_accountId_idx_cbfb3085',
        columns: ['accountId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'BalanceSnapshot',
        index: 'BalanceSnapshot_userId_accountId_recordedAt_idx_84e04ff9',
        columns: ['userId', 'accountId', 'recordedAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Category',
        index: 'Category_parentId_idx_6a68f597',
        columns: ['parentId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Category',
        index: 'Category_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'OutboxEvent',
        index: 'OutboxEvent_status_createdAt_idx_58610442',
        columns: ['status', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'OutboxEvent',
        index: 'OutboxEvent_userId_aggregateType_aggregateId_idx_d47f4ca2',
        columns: ['userId', 'aggregateType', 'aggregateId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ReconciliationCheckpoint',
        index: 'ReconciliationCheckpoint_accountId_idx_cbfb3085',
        columns: ['accountId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ReconciliationCheckpoint',
        index: 'ReconciliationCheckpoint_accountId_verifiedAt_idx_b454d1d4',
        columns: ['accountId', 'verifiedAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ReconciliationCheckpoint',
        index: 'ReconciliationCheckpoint_userId_accountId_idx_1325e8cb',
        columns: ['userId', 'accountId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Transaction',
        index: 'Transaction_accountId_idx_cbfb3085',
        columns: ['accountId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Transaction',
        index: 'Transaction_categoryId_idx_15c304f2',
        columns: ['categoryId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Transaction',
        index: 'Transaction_destinationAccountId_idx_32927505',
        columns: ['destinationAccountId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Transaction',
        index: 'Transaction_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Transaction',
        index: 'Transaction_userId_occurredAt_idx_9003f3bb',
        columns: ['userId', 'occurredAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Transaction',
        index: 'Transaction_userId_occurredOn_idx_af0393f7',
        columns: ['userId', 'occurredOn'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Account',
        foreignKey: {
          name: 'Account_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Allocation',
        foreignKey: {
          name: 'Allocation_expenseId_fkey',
          columns: ['expenseId'],
          references: { schema: 'public', table: 'Transaction', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Allocation',
        foreignKey: {
          name: 'Allocation_incomeId_fkey',
          columns: ['incomeId'],
          references: { schema: 'public', table: 'Transaction', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'BalanceSnapshot',
        foreignKey: {
          name: 'BalanceSnapshot_accountId_fkey',
          columns: ['accountId'],
          references: { schema: 'public', table: 'Account', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Category',
        foreignKey: {
          name: 'Category_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Category',
        foreignKey: {
          name: 'Category_parentId_fkey',
          columns: ['parentId'],
          references: { schema: 'public', table: 'Category', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ReconciliationCheckpoint',
        foreignKey: {
          name: 'ReconciliationCheckpoint_accountId_fkey',
          columns: ['accountId'],
          references: { schema: 'public', table: 'Account', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Transaction',
        foreignKey: {
          name: 'Transaction_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Transaction',
        foreignKey: {
          name: 'Transaction_accountId_fkey',
          columns: ['accountId'],
          references: { schema: 'public', table: 'Account', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Transaction',
        foreignKey: {
          name: 'Transaction_destinationAccountId_fkey',
          columns: ['destinationAccountId'],
          references: { schema: 'public', table: 'Account', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Transaction',
        foreignKey: {
          name: 'Transaction_categoryId_fkey',
          columns: ['categoryId'],
          references: { schema: 'public', table: 'Category', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      rawTriggerOp(
        'function.cashow_assert_allocation_sum',
        'Create function cashow_assert_allocation_sum',
        CHECK_ALLOCATION_SUM_FN,
      ),
      rawTriggerOp(
        'function.cashow_check_allocation_sums',
        'Create allocation trigger function',
        ALLOCATION_TRIGGER_FN,
      ),
      rawTriggerOp(
        'trigger.Allocation_sums_check',
        'Create allocation sums trigger',
        ALLOCATION_TRIGGER,
        'cashow:allocation-sums:allocations',
      ),
      rawTriggerOp(
        'function.cashow_check_transaction_allocation_sums',
        'Create transaction trigger function',
        TRANSACTION_TRIGGER_FN,
      ),
      rawTriggerOp(
        'trigger.Transaction_allocation_sums_check',
        'Create transaction allocation sums trigger',
        TRANSACTION_TRIGGER,
        'cashow:allocation-sums:transactions',
      ),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
