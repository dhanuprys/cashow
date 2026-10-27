import { nowOf, type UseCaseContext } from "./context";
import { LedgerError, toLedgerError } from "./errors";
import { err, ok, type Result } from "./result";

export interface NotificationSummary {
  id: string;
  title: string;
  body: string;
  severity: string;
  url: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface ChannelEndpointSummary {
  id: string;
  kind: string;
  endpoint: string;
  label: string | null;
  active: boolean;
  createdAt: string;
}

export async function listNotifications(
  ctx: UseCaseContext,
  options: { limit?: number; unreadOnly?: boolean } = {},
): Promise<Result<NotificationSummary[]>> {
  try {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
    let query = ctx.db.orm.public.Notification.where((row) => row.userId.eq(ctx.userId));
    if (options.unreadOnly === true) {
      query = query.where((row) => row.readAt.isNull());
    }
    const rows = await query
      .orderBy((row) => row.createdAt.desc())
      .limit(limit)
      .all();
    return ok(
      rows.map((row) => ({
        id: row.id,
        title: row.title,
        body: row.body,
        severity: row.severity,
        url: row.url,
        readAt: row.readAt === null ? null : String(row.readAt),
        createdAt: String(row.createdAt),
      })),
    );
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function markNotificationRead(ctx: UseCaseContext, id: string): Promise<Result<void>> {
  try {
    await ctx.db.orm.public.Notification.where({ id, userId: ctx.userId }).update({
      readAt: nowOf(ctx).toISOString(),
    });
    return ok(undefined);
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function createNotification(
  ctx: UseCaseContext,
  input: {
    title: string;
    body: string;
    severity?: string;
    url?: string | null;
    dedupeKey?: string | null;
  },
): Promise<Result<NotificationSummary>> {
  try {
    const created = await ctx.db.orm.public.Notification.create({
      userId: ctx.userId,
      title: input.title,
      body: input.body,
      severity: input.severity ?? "INFO",
      url: input.url ?? null,
      dedupeKey: input.dedupeKey ?? null,
    });
    return ok({
      id: created.id,
      title: created.title,
      body: created.body,
      severity: created.severity,
      url: created.url,
      readAt: created.readAt === null ? null : String(created.readAt),
      createdAt: String(created.createdAt),
    });
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function savePushSubscription(
  ctx: UseCaseContext,
  input: {
    endpoint: string;
    p256dh: string;
    auth: string;
    label?: string | null;
  },
): Promise<Result<ChannelEndpointSummary>> {
  try {
    const existing = await ctx.db.orm.public.ChannelEndpoint.where({
      userId: ctx.userId,
      kind: "PUSH",
      endpoint: input.endpoint,
    }).first();

    if (existing !== null) {
      await ctx.db.orm.public.ChannelEndpoint.where({ id: existing.id, userId: ctx.userId }).update(
        {
          p256dh: input.p256dh,
          auth: input.auth,
          active: true,
          failureCount: 0,
        },
      );
      const row = await ctx.db.orm.public.ChannelEndpoint.where({
        id: existing.id,
        userId: ctx.userId,
      }).first();
      if (row === null) throw new LedgerError("INTERNAL", "Endpoint gagal dibaca.");
      return ok(toSummary(row));
    }

    const created = await ctx.db.orm.public.ChannelEndpoint.create({
      userId: ctx.userId,
      kind: "PUSH",
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      label: input.label ?? null,
      active: true,
    });
    return ok(toSummary(created));
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function listChannelEndpoints(
  ctx: UseCaseContext,
): Promise<Result<ChannelEndpointSummary[]>> {
  try {
    const rows = await ctx.db.orm.public.ChannelEndpoint.where({ userId: ctx.userId }).all();
    return ok(rows.map(toSummary));
  } catch (error) {
    return err(toLedgerError(error));
  }
}

function toSummary(row: {
  id: string;
  kind: string;
  endpoint: string;
  label: string | null;
  active: boolean;
  createdAt: unknown;
}): ChannelEndpointSummary {
  return {
    id: row.id,
    kind: row.kind,
    endpoint: row.endpoint,
    label: row.label,
    active: row.active,
    createdAt: String(row.createdAt),
  };
}
