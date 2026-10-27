#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/0fe8759d4f7362e94a6d87e27b1019996c36b7564118a226a1b529c4bff039cc/contract';
import startContract from '../../snapshots/0fe8759d4f7362e94a6d87e27b1019996c36b7564118a226a1b529c4bff039cc/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/98a6daaff18f110dd647a93ca619f208def898e6ed3dfb5286b3150209286d14/contract';
import endContract from '../../snapshots/98a6daaff18f110dd647a93ca619f208def898e6ed3dfb5286b3150209286d14/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'Rule',
        columns: [
          col('actions', 'json', { notNull: true, codecRef: { codecId: 'pg/json@1' } }),
          col('active', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('condition', 'json', { notNull: true, codecRef: { codecId: 'pg/json@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('settings', 'json', { notNull: true, codecRef: { codecId: 'pg/json@1' } }),
          col('trigger', 'json', { notNull: true, codecRef: { codecId: 'pg/json@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('version', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'RuleFiring',
        columns: [
          col('dedupeKey', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('firedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('metricValues', 'json', { notNull: true, codecRef: { codecId: 'pg/json@1' } }),
          col('notificationId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('ruleId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'RuleState',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('lastEvaluatedAt', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('lastFiredAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('ruleId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('state', 'json', { notNull: true, codecRef: { codecId: 'pg/json@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'RuleFiring',
        constraint: 'RuleFiring_userId_dedupeKey_key',
        columns: ['userId', 'dedupeKey'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'RuleState',
        constraint: 'RuleState_userId_ruleId_key',
        columns: ['userId', 'ruleId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Rule',
        index: 'Rule_userId_active_idx_749baf02',
        columns: ['userId', 'active'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Rule',
        index: 'Rule_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'RuleFiring',
        index: 'RuleFiring_ruleId_idx_05e770f7',
        columns: ['ruleId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'RuleFiring',
        index: 'RuleFiring_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'RuleFiring',
        index: 'RuleFiring_userId_ruleId_firedAt_idx_a6541a4d',
        columns: ['userId', 'ruleId', 'firedAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'RuleState',
        index: 'RuleState_ruleId_idx_05e770f7',
        columns: ['ruleId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'RuleState',
        index: 'RuleState_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Rule',
        foreignKey: {
          name: 'Rule_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'RuleFiring',
        foreignKey: {
          name: 'RuleFiring_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'RuleFiring',
        foreignKey: {
          name: 'RuleFiring_ruleId_fkey',
          columns: ['ruleId'],
          references: { schema: 'public', table: 'Rule', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'RuleState',
        foreignKey: {
          name: 'RuleState_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'RuleState',
        foreignKey: {
          name: 'RuleState_ruleId_fkey',
          columns: ['ruleId'],
          references: { schema: 'public', table: 'Rule', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
