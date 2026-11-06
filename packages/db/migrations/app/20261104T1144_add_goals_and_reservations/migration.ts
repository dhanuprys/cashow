#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/a41d29d45b1f5c97b61e50add8d4aff110ce41dfadcc58c4eacafb70358da44b/contract';
import endContract from '../../snapshots/a41d29d45b1f5c97b61e50add8d4aff110ce41dfadcc58c4eacafb70358da44b/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/b8a9108761238d484af357efab4532f80476f4171d132fe3271a6ce265bc01e9/contract';
import startContract from '../../snapshots/b8a9108761238d484af357efab4532f80476f4171d132fe3271a6ce265bc01e9/contract.json' with { type: 'json' };
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
        table: 'Goal',
        columns: [
          col('archivedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('color', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('icon', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('ACTIVE'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('targetAmount', 'int8', { notNull: true, codecRef: { codecId: 'pg/int8@1' } }),
          col('targetDate', 'date', { codecRef: { codecId: 'pg/date-string@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'Goal_status_check_a6553ad0',
            sql`"status" IN ('ACTIVE', 'PAUSED', 'COMPLETED')`,
          ),
          checkExpression('goal_target_amount_positive_51e54b7f', sql`"targetAmount" > 0`),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'GoalReservation',
        columns: [
          col('accountId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('amount', 'int8', { notNull: true, codecRef: { codecId: 'pg/int8@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('goalId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('note', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('goal_reservation_amount_positive_ed0d10ac', sql`"amount" > 0`),
        ],
      }),
      this.addColumn({
        schema: 'public',
        table: 'User',
        column: col('googleId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'User',
        constraint: 'User_googleId_key',
        columns: ['googleId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Goal',
        index: 'Goal_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Goal',
        index: 'Goal_userId_status_idx_e4a128ba',
        columns: ['userId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'GoalReservation',
        index: 'GoalReservation_accountId_idx_cbfb3085',
        columns: ['accountId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'GoalReservation',
        index: 'GoalReservation_goalId_idx_8733343e',
        columns: ['goalId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'GoalReservation',
        index: 'GoalReservation_userId_goalId_idx_a0381d00',
        columns: ['userId', 'goalId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'GoalReservation',
        index: 'GoalReservation_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Goal',
        foreignKey: {
          name: 'Goal_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'GoalReservation',
        foreignKey: {
          name: 'GoalReservation_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'GoalReservation',
        foreignKey: {
          name: 'GoalReservation_goalId_fkey',
          columns: ['goalId'],
          references: { schema: 'public', table: 'Goal', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'GoalReservation',
        foreignKey: {
          name: 'GoalReservation_accountId_fkey',
          columns: ['accountId'],
          references: { schema: 'public', table: 'Account', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
