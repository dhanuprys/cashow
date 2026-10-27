#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/23ecf9852bcc32288db1e9efc1ff9953ed93c31054f3ed19339c30e1c338f78a/contract';
import startContract from '../../snapshots/23ecf9852bcc32288db1e9efc1ff9953ed93c31054f3ed19339c30e1c338f78a/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/5c3b75851cca2c0a633f49f374cf85abfa0fd5ccc6285f6afa41dc115d487a58/contract';
import endContract from '../../snapshots/5c3b75851cca2c0a633f49f374cf85abfa0fd5ccc6285f6afa41dc115d487a58/contract.json' with { type: 'json' };
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
        table: 'AuthChallenge',
        columns: [
          col('challenge', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('consumedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('expiresAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('payload', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('purpose', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('subjectId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'AuthChallenge_purpose_check_117ae226',
            sql`"purpose" IN ('REGISTRATION', 'AUTHENTICATION')`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'Passkey',
        columns: [
          col('backedUp', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('counter', 'int8', {
            notNull: true,
            default: lit('0'),
            codecRef: { codecId: 'pg/int8@1' },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('credentialId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('deviceType', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('lastUsedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('name', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('publicKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('revokedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('transports', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Session',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('expiresAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('ipAddress', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('lastUsedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('revokedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('tokenHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userAgent', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'AuthChallenge',
        constraint: 'AuthChallenge_challenge_key',
        columns: ['challenge'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Passkey',
        constraint: 'Passkey_credentialId_key',
        columns: ['credentialId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Session',
        constraint: 'Session_tokenHash_key',
        columns: ['tokenHash'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AuthChallenge',
        index: 'AuthChallenge_expiresAt_idx_6b6b8c10',
        columns: ['expiresAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Passkey',
        index: 'Passkey_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Session',
        index: 'Session_expiresAt_idx_6b6b8c10',
        columns: ['expiresAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Session',
        index: 'Session_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Passkey',
        foreignKey: {
          name: 'Passkey_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Session',
        foreignKey: {
          name: 'Session_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
