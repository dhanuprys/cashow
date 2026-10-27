#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/72e527792ffb7e01c253d8121731ee28e30890f1ea2d4c597871e07c9a48859b/contract';
import endContract from '../../snapshots/72e527792ffb7e01c253d8121731ee28e30890f1ea2d4c597871e07c9a48859b/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/d7af935b39ceffe99bfd2da9505905a36754c373439fbc53f79ece8edf61f714/contract';
import startContract from '../../snapshots/d7af935b39ceffe99bfd2da9505905a36754c373439fbc53f79ece8edf61f714/contract.json' with { type: 'json' };
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
        table: 'Budget',
        columns: [
          col('active', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('amount', 'int8', { notNull: true, codecRef: { codecId: 'pg/int8@1' } }),
          col('categoryId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('budget_amount_positive_ed0d10ac', sql`"amount" > 0`),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'RecurringTemplate',
        columns: [
          col('accountId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('active', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('amount', 'int8', { notNull: true, codecRef: { codecId: 'pg/int8@1' } }),
          col('categoryId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('counterparty', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('dayOfMonth', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('dayOfWeek', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('destinationAccountId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('frequency', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('lastRunAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('merchant', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('nextRunAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('note', 'text', { codecRef: { codecId: 'pg/text@1' } }),
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
            'RecurringTemplate_frequency_check_5213a287',
            sql`"frequency" IN ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY')`,
          ),
          checkExpression(
            'RecurringTemplate_type_check_fb141b4e',
            sql`"type" IN ('INCOME', 'EXPENSE', 'TRANSFER', 'ADJUSTMENT')`,
          ),
          checkExpression('recurring_amount_positive_ed0d10ac', sql`"amount" > 0`),
          checkExpression(
            'recurring_transfer_accounts_differ_c65f2c57',
            sql`"type" <> 'TRANSFER' OR "destinationAccountId" <> "accountId"`,
          ),
          checkExpression(
            'recurring_transfer_destination_consistency_5fb4dafd',
            sql`("type" = 'TRANSFER') = ("destinationAccountId" IS NOT NULL)`,
          ),
        ],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Budget',
        index: 'Budget_categoryId_idx_15c304f2',
        columns: ['categoryId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Budget',
        index: 'Budget_userId_categoryId_idx_5ac7f7c5',
        columns: ['userId', 'categoryId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Budget',
        index: 'Budget_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'RecurringTemplate',
        index: 'RecurringTemplate_accountId_idx_cbfb3085',
        columns: ['accountId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'RecurringTemplate',
        index: 'RecurringTemplate_categoryId_idx_15c304f2',
        columns: ['categoryId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'RecurringTemplate',
        index: 'RecurringTemplate_destinationAccountId_idx_32927505',
        columns: ['destinationAccountId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'RecurringTemplate',
        index: 'RecurringTemplate_userId_active_nextRunAt_idx_d6581d26',
        columns: ['userId', 'active', 'nextRunAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'RecurringTemplate',
        index: 'RecurringTemplate_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Budget',
        foreignKey: {
          name: 'Budget_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Budget',
        foreignKey: {
          name: 'Budget_categoryId_fkey',
          columns: ['categoryId'],
          references: { schema: 'public', table: 'Category', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'RecurringTemplate',
        foreignKey: {
          name: 'RecurringTemplate_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'RecurringTemplate',
        foreignKey: {
          name: 'RecurringTemplate_accountId_fkey',
          columns: ['accountId'],
          references: { schema: 'public', table: 'Account', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'RecurringTemplate',
        foreignKey: {
          name: 'RecurringTemplate_destinationAccountId_fkey',
          columns: ['destinationAccountId'],
          references: { schema: 'public', table: 'Account', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'RecurringTemplate',
        foreignKey: {
          name: 'RecurringTemplate_categoryId_fkey',
          columns: ['categoryId'],
          references: { schema: 'public', table: 'Category', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
