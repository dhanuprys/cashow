import { createChatThread, listChatThreads } from "@cashow/services";
import { findLedgerSession } from "@/lib/ledger";

export async function GET() {
  const session = await findLedgerSession();
  if (session === null) {
    return new Response("Unauthorized", { status: 401 });
  }

  const ctx = { db: session.db, userId: session.user.id };
  const result = await listChatThreads(ctx);
  if (!result.ok) {
    return new Response(result.error.message, { status: 500 });
  }

  return Response.json({ threads: result.value }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const session = await findLedgerSession();
  if (session === null) {
    return new Response("Unauthorized", { status: 401 });
  }

  const ctx = { db: session.db, userId: session.user.id };
  const body = (await request.json().catch(() => ({}))) as {
    title?: string;
    modelId?: string;
    isFavorite?: boolean;
  };

  const result = await createChatThread(ctx, {
    title: body.title,
    modelId: body.modelId,
    isFavorite: body.isFavorite,
  });

  if (!result.ok) {
    return new Response(result.error.message, { status: 400 });
  }

  return Response.json({ thread: result.value }, { status: 201 });
}
