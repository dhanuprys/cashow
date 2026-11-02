#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/34c824378cb5210717c798e1dd5efc6f4bfcf2e9e0dc3dda41ca44f79cb5d326/contract';
import startContract from '../../snapshots/34c824378cb5210717c798e1dd5efc6f4bfcf2e9e0dc3dda41ca44f79cb5d326/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/affc841717f5b357f53875d5b0e20c0b4f75f7cb26f0d867d2ac32174b007872/contract';
import endContract from '../../snapshots/affc841717f5b357f53875d5b0e20c0b4f75f7cb26f0d867d2ac32174b007872/contract.json' with { type: 'json' };
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
        table: 'AiProviderConfig',
        columns: [
          col('apiKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('baseUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('customModels', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('isDefault', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('model', 'text', {
            notNull: true,
            default: lit(''),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('provider', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('totalInputTokens', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('totalOutputTokens', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('totalTokens', 'int4', {
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
          checkExpression(
            'AiProviderConfig_provider_check_b98c7195',
            sql`"provider" IN ('GOOGLE', 'DEEPSEEK', 'OPENAI', 'OPENAI_COMPATIBLE')`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'AiUsageLog',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('inputTokens', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('modelId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('outputTokens', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('providerConfigId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('threadId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('totalTokens', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'ChatMessage',
        column: col('parts', 'json', { codecRef: { codecId: 'pg/json@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'ChatThread',
        column: col('isFavorite', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'ChatThread',
        column: col('modelId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'User',
        column: col('avatar', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'User',
        column: col('bio', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'User',
        column: col('password', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'User',
        column: col('username', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'User',
        constraint: 'User_username_key',
        columns: ['username'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AiProviderConfig',
        index: 'AiProviderConfig_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AiUsageLog',
        index: 'AiUsageLog_providerConfigId_createdAt_idx_3815409c',
        columns: ['providerConfigId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AiUsageLog',
        index: 'AiUsageLog_providerConfigId_idx_562d7615',
        columns: ['providerConfigId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AiUsageLog',
        index: 'AiUsageLog_userId_createdAt_idx_f726f04a',
        columns: ['userId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AiUsageLog',
        index: 'AiUsageLog_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ChatThread',
        index: 'ChatThread_userId_isFavorite_updatedAt_idx_b93a1070',
        columns: ['userId', 'isFavorite', 'updatedAt'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'AiProviderConfig',
        foreignKey: {
          name: 'AiProviderConfig_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'AiUsageLog',
        foreignKey: {
          name: 'AiUsageLog_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'AiUsageLog',
        foreignKey: {
          name: 'AiUsageLog_providerConfigId_fkey',
          columns: ['providerConfigId'],
          references: { schema: 'public', table: 'AiProviderConfig', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
