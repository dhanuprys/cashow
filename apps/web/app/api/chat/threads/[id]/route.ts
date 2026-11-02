import { deleteChatThread, getChatThread, updateChatThread } from "@cashow/services";
import { findLedgerSession } from "@/lib/ledger";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await findLedgerSession();
  if (session === null) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await context.params;
  const ctx = { db: session.db, userId: session.user.id };
  const result = await getChatThread(ctx, id);

  if (!result.ok) {
    return new Response(result.error.message, { status: 500 });
  }

  if (result.value === null) {
    return new Response("Thread not found", { status: 404 });
  }

  return Response.json(result.value, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await findLedgerSession();
  if (session === null) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await context.params;
  const ctx = { db: session.db, userId: session.user.id };
  const body = (await request.json().catch(() => ({}))) as {
    title?: string;
    isFavorite?: boolean;
    modelId?: string;
  };

  const result = await updateChatThread(ctx, id, {
    title: body.title,
    isFavorite: body.isFavorite,
    modelId: body.modelId,
  });

  if (!result.ok) {
    return new Response(result.error.message, { status: 400 });
  }

  return Response.json({ thread: result.value });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await findLedgerSession();
  if (session === null) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await context.params;
  const ctx = { db: session.db, userId: session.user.id };
  const result = await deleteChatThread(ctx, id);

  if (!result.ok) {
    return new Response(result.error.message, { status: 400 });
  }

  return Response.json({ success: true });
}
