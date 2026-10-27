import { type Database, nowOf, type UseCaseContext } from "./context";
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

/** Hide a notification until `minutes` from now without marking it read. */
export async function snoozeNotification(
  ctx: UseCaseContext,
  id: string,
  minutes: number,
): Promise<Result<void>> {
  try {
    const clamped = Math.min(Math.max(Math.round(minutes), 1), 60 * 24 * 30);
    const until = new Date(nowOf(ctx).getTime() + clamped * 60_000);
    await ctx.db.orm.public.Notification.where({ id, userId: ctx.userId }).update({
      snoozedUntil: until.toISOString(),
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
    // Fan out one delivery row per active PUSH endpoint. The in-app inbox is
    // the source of truth; delivery rows are best-effort routes.
    const endpoints = await ctx.db.orm.public.ChannelEndpoint.where({
      userId: ctx.userId,
      kind: "PUSH",
      active: true,
    }).all();
    for (const endpoint of endpoints) {
      await ctx.db.orm.public.NotificationDelivery.create({
        notificationId: created.id,
        channelEndpointId: endpoint.id,
        channel: "PUSH",
        status: "PENDING",
      });
    }
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

/** Remove a push subscription the browser has revoked (HTTP 404/410). */
export async function deactivateChannelEndpoint(
  ctx: UseCaseContext,
  id: string,
): Promise<Result<void>> {
  try {
    await ctx.db.orm.public.ChannelEndpoint.where({ id, userId: ctx.userId }).update({
      active: false,
    });
    return ok(undefined);
  } catch (error) {
    return err(toLedgerError(error));
  }
}

/** A push send result the consumer can act on. */
export interface PushSendResult {
  ok: boolean;
  /** True when the endpoint is gone and must be pruned. */
  gone?: boolean;
  error?: string;
}

/** The payload a web push carries to the service worker. */
export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/** Injected by the caller so this package never depends on `web-push`. */
export type PushSender = (
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: PushPayload,
) => Promise<PushSendResult>;

export interface DeliveryOutcome {
  sent: number;
  failed: number;
  pruned: number;
}

const DELIVERY_MAX_ATTEMPTS = 3;
const DELIVERY_BATCH = 25;

/**
 * Deliver queued push notifications (plan §5, Phase 4).
 *
 * Every notification gets one `NotificationDelivery` row per active PUSH
 * endpoint when it is created; this consumer claims due PENDING rows, sends
 * them through the injected `send`, and records the outcome. Endpoints that
 * answer 404/410 are deactivated so they are not retried forever. The in-app
 * inbox stays the source of truth: a failed delivery never hides the
 * notification.
 */
export async function deliverPendingNotifications(
  db: Database,
  send: PushSender,
): Promise<Result<DeliveryOutcome>> {
  const outcome: DeliveryOutcome = { sent: 0, failed: 0, pruned: 0 };
  try {
    const claimed = await claimDeliveries(db);
    if (!claimed.ok) return claimed;

    for (const delivery of claimed.value) {
      const endpoint = await db.orm.public.ChannelEndpoint.where({
        id: delivery.channelEndpointId,
      }).first();
      if (endpoint === null) {
        await db.orm.public.NotificationDelivery.where({ id: delivery.id }).update({
          status: "SKIPPED",
          lastError: "Endpoint sudah dihapus.",
        });
        continue;
      }

      const notification = await db.orm.public.Notification.where({
        id: delivery.notificationId,
      }).first();
      if (notification === null) {
        await db.orm.public.NotificationDelivery.where({ id: delivery.id }).update({
          status: "SKIPPED",
          lastError: "Notifikasi sudah dihapus.",
        });
        continue;
      }

      const result = await send(
        {
          endpoint: endpoint.endpoint,
          keys: {
            p256dh: endpoint.p256dh ?? "",
            auth: endpoint.auth ?? "",
          },
        },
        {
          title: notification.title,
          body: notification.body,
          url: notification.url ?? undefined,
          tag: delivery.notificationId,
        },
      );

      if (result.ok) {
        outcome.sent += 1;
        await db.orm.public.NotificationDelivery.where({ id: delivery.id }).update({
          status: "SENT",
          attempts: delivery.attempts + 1,
          deliveredAt: new Date().toISOString(),
          lastError: null,
        });
        await db.orm.public.ChannelEndpoint.where({ id: endpoint.id }).update({
          lastUsedAt: new Date().toISOString(),
          failureCount: 0,
        });
        continue;
      }

      if (result.gone === true) {
        outcome.pruned += 1;
        await db.orm.public.ChannelEndpoint.where({ id: endpoint.id }).update({ active: false });
        await db.orm.public.NotificationDelivery.where({ id: delivery.id }).update({
          status: "SKIPPED",
          attempts: delivery.attempts + 1,
          lastError: "Langganan push kedaluwarsa.",
        });
        continue;
      }

      outcome.failed += 1;
      const attempts = delivery.attempts + 1;
      await db.orm.public.NotificationDelivery.where({ id: delivery.id }).update({
        status: attempts >= DELIVERY_MAX_ATTEMPTS ? "FAILED" : "PENDING",
        attempts,
        lastError: (result.error ?? "Pengiriman push gagal.").slice(0, 1000),
      });
      await db.orm.public.ChannelEndpoint.where({ id: endpoint.id }).update({
        failureCount: endpoint.failureCount + 1,
      });
    }

    return ok(outcome);
  } catch (error) {
    return err(toLedgerError(error));
  }
}

interface ClaimedDelivery {
  id: string;
  notificationId: string;
  channelEndpointId: string;
  attempts: number;
}

async function claimDeliveries(db: Database): Promise<Result<ClaimedDelivery[]>> {
  try {
    const claimed = await db.transaction(async (tx) => {
      const plan = tx.raw.sql`
        SELECT d."id" AS id,
               d."notificationId" AS "notificationId",
               d."channelEndpointId" AS "channelEndpointId",
               d."attempts"::int AS attempts
        FROM "public"."NotificationDelivery" d
        JOIN "public"."ChannelEndpoint" e ON e."id" = d."channelEndpointId"
        WHERE d."status" = 'PENDING'
          AND d."attempts" < ${DELIVERY_MAX_ATTEMPTS}
          AND e."active" = true
          AND e."kind" = 'PUSH'
        ORDER BY d."createdAt" ASC
        LIMIT ${DELIVERY_BATCH}::int
        FOR UPDATE OF d SKIP LOCKED
      `
        .returnsRow({
          id: "pg/text@1",
          notificationId: "pg/text@1",
          channelEndpointId: "pg/text@1",
          attempts: "pg/int4@1",
        })
        .build();

      const rows = await tx.query(plan);
      if (rows.length === 0) return rows;

      const idsJson = JSON.stringify(rows.map((row) => row.id));
      const updatePlan = tx.raw.sql`
        UPDATE "public"."NotificationDelivery" d
        SET "status" = 'SENDING'
        WHERE d."id" IN (SELECT value FROM jsonb_array_elements_text(${idsJson}::jsonb))
      `
        .affectedCount()
        .build();
      await tx.execute(updatePlan);

      return rows;
    });

    return ok(claimed);
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
