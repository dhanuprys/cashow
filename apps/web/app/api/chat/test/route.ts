import { getAiProviderConfig } from "@cashow/services";
import { generateText } from "ai";
import { z } from "zod";
import { buildLanguageModel } from "@/lib/ai-model";
import { findLedgerSession } from "@/lib/ledger";

const testSchema = z.object({
  id: z.string().trim().min(1, "ID konfigurasi wajib diisi."),
  model: z.string().trim().optional(),
});

export async function POST(request: Request) {
  const session = await findLedgerSession();
  if (session === null) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = testSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Payload tidak valid." },
      { status: 400 },
    );
  }

  const ctx = { db: session.db, userId: session.user.id };
  const configResult = await getAiProviderConfig(ctx, parsed.data.id);
  if (!configResult.ok) {
    return Response.json({ ok: false, error: configResult.error.message }, { status: 400 });
  }

  const config = configResult.value;
  if (!config) {
    return Response.json({ ok: false, error: "Konfigurasi AI tidak ditemukan." }, { status: 404 });
  }

  if (parsed.data.model) {
    config.model = parsed.data.model;
  } else if (!config.model || config.model.trim() === "") {
    if (config.customModels && config.customModels.length > 0 && config.customModels[0]) {
      config.model = config.customModels[0];
    }
  }

  const startedAt = Date.now();
  try {
    const result = await generateText({
      model: buildLanguageModel(config),
      prompt: "Balas dengan satu kata persis: OK",
      maxOutputTokens: 256,
      temperature: 0,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(15_000),
    });

    const elapsed = Date.now() - startedAt;
    const reply = result.text.trim().replace(/\s+/g, " ").slice(0, 80);

    return Response.json({
      ok: true,
      model: config.model,
      provider: config.provider,
      name: config.name,
      latencyMs: elapsed,
      reply: reply || "OK",
    });
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : "Gagal terhubung.";
    return Response.json(
      {
        ok: false,
        model: config.model,
        provider: config.provider,
        name: config.name,
        error: message,
      },
      { status: 422 },
    );
  }
}
