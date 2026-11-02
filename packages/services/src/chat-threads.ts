import {
  type ChatMessageCreateInput,
  type ChatThreadCreateInput,
  type ChatThreadUpdateInput,
  chatMessageCreateSchema,
  chatThreadCreateSchema,
  chatThreadUpdateSchema,
  firstIssue,
} from "@cashow/domain";
import type { UseCaseContext } from "./context";
import { LedgerError, toLedgerError } from "./errors";
import { jsonSafe } from "./json";
import { err, ok, type Result } from "./result";

export interface ChatThreadSummary {
  id: string;
  title: string | null;
  isFavorite: boolean;
  modelId: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessageSnippet: string | null;
}

export interface ChatMessageDetail {
  id: string;
  threadId: string;
  role: "user" | "assistant" | "system";
  content: string;
  parts: unknown;
  toolCalls: unknown;
  toolResults: unknown;
  createdAt: string;
}

export interface ChatThreadWithMessages {
  thread: ChatThreadSummary;
  messages: ChatMessageDetail[];
}

function truncateTitle(text: string, maxLen = 45): string {
  const cleaned = text.trim().replace(/\s+/g, " ");
  if (cleaned.length <= maxLen) return cleaned;
  return `${cleaned.slice(0, maxLen).trim()}...`;
}

export async function listChatThreads(ctx: UseCaseContext): Promise<Result<ChatThreadSummary[]>> {
  try {
    const plan = ctx.db.raw.sql`
      SELECT t.id AS id,
             COALESCE(t.title, ${""}) AS title,
             t."isFavorite" AS "isFavorite",
             COALESCE(t."modelId", ${""}) AS "modelId",
             t."createdAt"::text AS "createdAt",
             t."updatedAt"::text AS "updatedAt",
             (SELECT count(*) FROM "public"."ChatMessage" m WHERE m."threadId" = t.id)::bigint AS "messageCount",
             COALESCE((SELECT m2.content FROM "public"."ChatMessage" m2 WHERE m2."threadId" = t.id ORDER BY m2."createdAt" DESC LIMIT 1), ${""}) AS "lastMessageSnippet"
      FROM "public"."ChatThread" t
      WHERE t."userId" = ${ctx.userId}
      ORDER BY t."isFavorite" DESC, t."updatedAt" DESC
    `
      .returnsRow({
        id: "pg/text@1",
        title: "pg/text@1",
        isFavorite: "pg/bool@1",
        modelId: "pg/text@1",
        createdAt: "pg/text@1",
        updatedAt: "pg/text@1",
        messageCount: "pg/int8@1",
        lastMessageSnippet: "pg/text@1",
      })
      .build();

    const rows = await ctx.db.query(plan);

    const items: ChatThreadSummary[] = rows.map((r) => ({
      id: r.id,
      title: r.title.length > 0 ? r.title : null,
      isFavorite: r.isFavorite,
      modelId: r.modelId.length > 0 ? r.modelId : null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      messageCount: Number(r.messageCount),
      lastMessageSnippet: r.lastMessageSnippet.length > 0 ? r.lastMessageSnippet : null,
    }));

    return ok(items);
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function getChatThread(
  ctx: UseCaseContext,
  threadId: string,
): Promise<Result<ChatThreadWithMessages | null>> {
  try {
    const thread = await ctx.db.orm.public.ChatThread.where({
      id: threadId,
      userId: ctx.userId,
    }).first();

    if (!thread) return ok(null);

    const messageRows = await ctx.db.orm.public.ChatMessage.where({
      threadId,
      userId: ctx.userId,
    })
      .orderBy((m) => m.createdAt.asc())
      .all();

    const messages: ChatMessageDetail[] = messageRows.map((m) => ({
      id: m.id,
      threadId: m.threadId,
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
      parts: m.parts,
      toolCalls: m.toolCalls,
      toolResults: m.toolResults,
      createdAt: String(m.createdAt),
    }));

    return ok({
      thread: {
        id: thread.id,
        title: thread.title,
        isFavorite: thread.isFavorite,
        modelId: thread.modelId,
        createdAt: String(thread.createdAt),
        updatedAt: String(thread.updatedAt),
        messageCount: messages.length,
        lastMessageSnippet: messages[messages.length - 1]?.content ?? null,
      },
      messages,
    });
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function createChatThread(
  ctx: UseCaseContext,
  input: ChatThreadCreateInput = {},
): Promise<Result<ChatThreadSummary>> {
  const parsed = chatThreadCreateSchema.safeParse(input);
  if (!parsed.success) {
    return err(new LedgerError("VALIDATION", firstIssue(parsed.error)));
  }

  const data = parsed.data;

  try {
    const created = await ctx.db.orm.public.ChatThread.create({
      userId: ctx.userId,
      title: data.title ?? null,
      modelId: data.modelId ?? null,
      isFavorite: data.isFavorite ?? false,
    });

    return ok({
      id: created.id,
      title: created.title,
      isFavorite: created.isFavorite,
      modelId: created.modelId,
      createdAt: String(created.createdAt),
      updatedAt: String(created.updatedAt),
      messageCount: 0,
      lastMessageSnippet: null,
    });
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function updateChatThread(
  ctx: UseCaseContext,
  threadId: string,
  input: ChatThreadUpdateInput,
): Promise<Result<ChatThreadSummary>> {
  const parsed = chatThreadUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return err(new LedgerError("VALIDATION", firstIssue(parsed.error)));
  }

  const patch = parsed.data;

  try {
    const existing = await ctx.db.orm.public.ChatThread.where({
      id: threadId,
      userId: ctx.userId,
    }).first();

    if (!existing) {
      return err(new LedgerError("NOT_FOUND", "Sesi percakapan tidak ditemukan."));
    }

    const updated = await ctx.db.orm.public.ChatThread.where({
      id: threadId,
      userId: ctx.userId,
    }).update({
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.isFavorite !== undefined ? { isFavorite: patch.isFavorite } : {}),
      ...(patch.modelId !== undefined ? { modelId: patch.modelId } : {}),
    });

    if (!updated) {
      return err(new LedgerError("NOT_FOUND", "Sesi percakapan tidak ditemukan."));
    }

    const [countResult, lastMsg] = await Promise.all([
      ctx.db.orm.public.ChatMessage.where({
        threadId,
        userId: ctx.userId,
      }).count(),
      ctx.db.orm.public.ChatMessage.where({
        threadId,
        userId: ctx.userId,
      })
        .orderBy((m) => m.createdAt.desc())
        .first(),
    ]);

    return ok({
      id: updated.id,
      title: updated.title,
      isFavorite: updated.isFavorite,
      modelId: updated.modelId,
      createdAt: String(updated.createdAt),
      updatedAt: String(updated.updatedAt),
      messageCount: Number(countResult ?? 0),
      lastMessageSnippet: lastMsg?.content ?? null,
    });
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function deleteChatThread(
  ctx: UseCaseContext,
  threadId: string,
): Promise<Result<void>> {
  try {
    const existing = await ctx.db.orm.public.ChatThread.where({
      id: threadId,
      userId: ctx.userId,
    }).first();

    if (!existing) {
      return err(new LedgerError("NOT_FOUND", "Sesi percakapan tidak ditemukan."));
    }

    await ctx.db.orm.public.ChatThread.where({
      id: threadId,
      userId: ctx.userId,
    }).delete();

    return ok(undefined);
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export interface SaveChatMessageOptions {
  /**
   * A tool-approval resume continues the previous assistant turn over a second
   * request. Update that stored row instead of appending a stale duplicate.
   */
  replaceLastAssistant?: boolean;
}

/** True when the persisted parts still hold an unanswered approval request. */
function hasPendingApproval(parts: unknown): boolean {
  if (!Array.isArray(parts)) return false;
  return parts.some((part) => {
    if (typeof part !== "object" || part === null) return false;
    return (part as { state?: unknown }).state === "approval-requested";
  });
}

export async function saveChatMessage(
  ctx: UseCaseContext,
  threadId: string,
  input: ChatMessageCreateInput,
  options: SaveChatMessageOptions = {},
): Promise<Result<ChatMessageDetail>> {
  const parsed = chatMessageCreateSchema.safeParse(input);
  if (!parsed.success) {
    return err(new LedgerError("VALIDATION", firstIssue(parsed.error)));
  }

  const data = parsed.data;
  const partsJson = data.parts !== undefined ? jsonSafe(data.parts) : null;
  const toolCallsJson = data.toolCalls !== undefined ? jsonSafe(data.toolCalls) : null;
  const toolResultsJson = data.toolResults !== undefined ? jsonSafe(data.toolResults) : null;

  try {
    let createdMessage: ChatMessageDetail | null = null;

    await ctx.db.transaction(async (tx) => {
      const thread = await tx.orm.public.ChatThread.where({
        id: threadId,
        userId: ctx.userId,
      }).first();

      if (!thread) {
        throw new LedgerError("NOT_FOUND", "Sesi percakapan tidak ditemukan.");
      }

      if (options.replaceLastAssistant) {
        const lastAssistant = await tx.orm.public.ChatMessage.where({
          userId: ctx.userId,
          threadId,
          role: "assistant",
        })
          .orderBy((m) => m.createdAt.desc())
          .first();

        if (lastAssistant !== null && hasPendingApproval(lastAssistant.parts)) {
          const updated = await tx.orm.public.ChatMessage.where({
            id: lastAssistant.id,
            userId: ctx.userId,
          }).update({
            content: data.content,
            parts: partsJson,
            toolCalls: toolCallsJson,
            toolResults: toolResultsJson,
          });

          if (updated !== null) {
            createdMessage = {
              id: updated.id,
              threadId: updated.threadId,
              role: updated.role as "user" | "assistant" | "system",
              content: updated.content,
              parts: updated.parts,
              toolCalls: updated.toolCalls,
              toolResults: updated.toolResults,
              createdAt: String(updated.createdAt),
            };
            return;
          }
        }
      }

      const msg = await tx.orm.public.ChatMessage.create({
        userId: ctx.userId,
        threadId,
        role: data.role,
        content: data.content,
        parts: partsJson,
        toolCalls: toolCallsJson,
        toolResults: toolResultsJson,
      });

      // If thread has no title and this is a user message, auto-title it
      if ((!thread.title || thread.title.trim() === "") && data.role === "user") {
        await tx.orm.public.ChatThread.where({ id: threadId, userId: ctx.userId }).update({
          title: truncateTitle(data.content),
        });
      }

      createdMessage = {
        id: msg.id,
        threadId: msg.threadId,
        role: msg.role as "user" | "assistant" | "system",
        content: msg.content,
        parts: msg.parts,
        toolCalls: msg.toolCalls,
        toolResults: msg.toolResults,
        createdAt: String(msg.createdAt),
      };
    });

    if (!createdMessage) {
      return err(new LedgerError("INTERNAL", "Gagal menyimpan pesan percakapan."));
    }

    return ok(createdMessage);
  } catch (error) {
    return err(toLedgerError(error));
  }
}
