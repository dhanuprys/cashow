#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/2d6257fdb9e7b362d34fe2b89d7ddf8bf34206336cbbb05b115c15c270d1bba3/contract';
import startContract from '../../snapshots/2d6257fdb9e7b362d34fe2b89d7ddf8bf34206336cbbb05b115c15c270d1bba3/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/d8372036127f16ba1397e8a5a6245caa6e95634f6c1c7c9e8d3cd4fa09d2a2e2/contract';
import endContract from '../../snapshots/d8372036127f16ba1397e8a5a6245caa6e95634f6c1c7c9e8d3cd4fa09d2a2e2/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  lit,
  primaryKey,
  sql,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'RecurringDraft',
        columns: [
          col('accountId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('amount', 'int8', { notNull: true, codecRef: { codecId: 'pg/int8@1' } }),
          col('categoryId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('confirmedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('counterparty', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('destinationAccountId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('merchant', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('note', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('runAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('skippedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('PENDING'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('templateId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('transactionId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
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
            'RecurringDraft_type_check_fb141b4e',
            sql`"type" IN ('INCOME', 'EXPENSE', 'TRANSFER', 'ADJUSTMENT')`,
          ),
          checkExpression('recurring_draft_amount_positive_ed0d10ac', sql`"amount" > 0`),
          checkExpression(
            'recurring_draft_status_valid_a5f6622c',
            sql`"status" IN ('PENDING', 'CONFIRMED', 'SKIPPED')`,
          ),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'RecurringDraft',
        constraint: 'RecurringDraft_templateId_runAt_key',
        columns: ['templateId', 'runAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'RecurringDraft',
        index: 'RecurringDraft_accountId_idx_cbfb3085',
        columns: ['accountId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'RecurringDraft',
        index: 'RecurringDraft_categoryId_idx_15c304f2',
        columns: ['categoryId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'RecurringDraft',
        index: 'RecurringDraft_destinationAccountId_idx_32927505',
        columns: ['destinationAccountId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'RecurringDraft',
        index: 'RecurringDraft_templateId_idx_19e0d972',
        columns: ['templateId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'RecurringDraft',
        index: 'RecurringDraft_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'RecurringDraft',
        index: 'RecurringDraft_userId_status_runAt_idx_82098bf9',
        columns: ['userId', 'status', 'runAt'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'RecurringDraft',
        foreignKey: {
          name: 'RecurringDraft_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'RecurringDraft',
        foreignKey: {
          name: 'RecurringDraft_templateId_fkey',
          columns: ['templateId'],
          references: { schema: 'public', table: 'RecurringTemplate', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'RecurringDraft',
        foreignKey: {
          name: 'RecurringDraft_accountId_fkey',
          columns: ['accountId'],
          references: { schema: 'public', table: 'Account', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'RecurringDraft',
        foreignKey: {
          name: 'RecurringDraft_destinationAccountId_fkey',
          columns: ['destinationAccountId'],
          references: { schema: 'public', table: 'Account', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'RecurringDraft',
        foreignKey: {
          name: 'RecurringDraft_categoryId_fkey',
          columns: ['categoryId'],
          references: { schema: 'public', table: 'Category', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
