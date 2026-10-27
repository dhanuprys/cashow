import { connection } from "next/server";
import { compatNotFound, compatRequestToken, compatTokenMatches } from "@/lib/compat";

/**
 * Streaming compatibility gate (plan §6). Emits NDJSON chunks with a deliberate
 * pause so the client can observe incremental delivery, and stops as soon as
 * the request is aborted — the pattern the AI chat route will rely on.
 *
 * `?op=stats` reports whether the server observed a cancellation, which the
 * smoke script needs to prove the abort travelled past the proxy.
 */

const TOTAL_CHUNKS = 5;
const CHUNK_DELAY_MS = 150;

type StreamStats = { started: number; completed: number; cancelled: number };

// Single-instance self-hosting keeps this in memory; behind more than one web
// replica the probe would need a shared counter, but the probe is CI-only.
const stats: StreamStats = { started: 0, completed: 0, cancelled: 0 };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(request: Request) {
  await connection();

  if (!compatTokenMatches(compatRequestToken(request))) return compatNotFound();

  if (new URL(request.url).searchParams.get("op") === "stats") {
    return Response.json(stats, { headers: { "Cache-Control": "no-store" } });
  }

  stats.started += 1;
  const startedAt = Date.now();
  const encoder = new TextEncoder();
  let cancelled = false;

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (let index = 0; index < TOTAL_CHUNKS; index += 1) {
        if (cancelled || request.signal.aborted) break;

        const chunk = JSON.stringify({
          chunk: index + 1,
          total: TOTAL_CHUNKS,
          elapsedMs: Date.now() - startedAt,
        });
        controller.enqueue(encoder.encode(`${chunk}\n`));

        if (index < TOTAL_CHUNKS - 1) await sleep(CHUNK_DELAY_MS);
      }

      if (cancelled || request.signal.aborted) {
        stats.cancelled += 1;
        return;
      }

      stats.completed += 1;
      controller.close();
    },
    cancel() {
      // The reader went away (tab closed, client abort). Stop the producer.
      cancelled = true;
    },
  });

  return new Response(body, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/x-ndjson; charset=utf-8",
      // Caddy buffers by default; tell it not to.
      "X-Accel-Buffering": "no",
    },
  });
}
