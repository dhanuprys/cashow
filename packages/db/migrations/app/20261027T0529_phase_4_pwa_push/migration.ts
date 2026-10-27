#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/0fe8759d4f7362e94a6d87e27b1019996c36b7564118a226a1b529c4bff039cc/contract';
import endContract from '../../snapshots/0fe8759d4f7362e94a6d87e27b1019996c36b7564118a226a1b529c4bff039cc/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/72e527792ffb7e01c253d8121731ee28e30890f1ea2d4c597871e07c9a48859b/contract';
import startContract from '../../snapshots/72e527792ffb7e01c253d8121731ee28e30890f1ea2d4c597871e07c9a48859b/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'ChannelEndpoint',
        columns: [
          col('active', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('auth', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('endpoint', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('failureCount', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('kind', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('label', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('lastUsedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('p256dh', 'text', { codecRef: { codecId: 'pg/text@1' } }),
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
        table: 'Notification',
        columns: [
          col('body', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('dedupeKey', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('readAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('severity', 'text', {
            notNull: true,
            default: lit('INFO'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('snoozedUntil', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('url', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'NotificationDelivery',
        columns: [
          col('attempts', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('channel', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('channelEndpointId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('deliveredAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('lastError', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('notificationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('PENDING'),
            codecRef: { codecId: 'pg/text@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Notification',
        constraint: 'Notification_userId_dedupeKey_key',
        columns: ['userId', 'dedupeKey'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ChannelEndpoint',
        index: 'ChannelEndpoint_userId_active_idx_749baf02',
        columns: ['userId', 'active'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ChannelEndpoint',
        index: 'ChannelEndpoint_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ChannelEndpoint',
        index: 'ChannelEndpoint_userId_kind_idx_ed3360ff',
        columns: ['userId', 'kind'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Notification',
        index: 'Notification_userId_createdAt_idx_f726f04a',
        columns: ['userId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Notification',
        index: 'Notification_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'NotificationDelivery',
        index: 'NotificationDelivery_channelEndpointId_idx_a7d98e2f',
        columns: ['channelEndpointId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'NotificationDelivery',
        index: 'NotificationDelivery_notificationId_idx_adfe2654',
        columns: ['notificationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'NotificationDelivery',
        index: 'NotificationDelivery_status_createdAt_idx_58610442',
        columns: ['status', 'createdAt'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ChannelEndpoint',
        foreignKey: {
          name: 'ChannelEndpoint_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Notification',
        foreignKey: {
          name: 'Notification_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'NotificationDelivery',
        foreignKey: {
          name: 'NotificationDelivery_notificationId_fkey',
          columns: ['notificationId'],
          references: { schema: 'public', table: 'Notification', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'NotificationDelivery',
        foreignKey: {
          name: 'NotificationDelivery_channelEndpointId_fkey',
          columns: ['channelEndpointId'],
          references: { schema: 'public', table: 'ChannelEndpoint', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
