import { loadEnv } from "@cashow/config";
import { buildContextPack } from "@cashow/services";
import { NextResponse } from "next/server";
import { findLedgerSession } from "@/lib/ledger";

export async function POST(request: Request) {
  const session = await findLedgerSession();
  if (session === null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const env = loadEnv();
  if (env.DEEPSEEK_API_KEY === undefined) {
    return NextResponse.json({ error: "AI is not configured." }, { status: 503 });
  }

  const body = (await request.json()) as { message?: string };
  const message = body.message?.trim();
  if (message === undefined || message === "") {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  const ctx = { db: session.db, userId: session.user.id };
  const contextPack = await buildContextPack(ctx);

  const response = await fetch(`${env.DEEPSEEK_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.DEEPSEEK_MODEL,
      messages: [
        {
          role: "system",
          content:
            "Anda adalah asisten keuangan Cashow. Jawab dalam bahasa Indonesia. " +
            "Gunakan hanya angka dari konteks berikut; jangan mengarang data.\n\n" +
            contextPack,
        },
        { role: "user", content: message },
      ],
      stream: false,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    return NextResponse.json({ error: text }, { status: 502 });
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const answer = data.choices?.[0]?.message?.content ?? "";
  return NextResponse.json({ answer });
}
