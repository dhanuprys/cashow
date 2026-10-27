/**
 * Phase 0 framework compatibility gates (plan §6, "Next.js on Bun").
 *
 * Runs entirely over HTTP, so the same script works against `bun run dev`, the
 * production image, or the Compose stack behind Caddy:
 *
 *   COMPAT_TOKEN=… bun run smoke:compat
 *   SMOKE_BASE_URL=https://cashow.example.com COMPAT_TOKEN=… bun run smoke:compat
 *
 * It proves:
 *   1. a Server Action executes from a plain HTML form POST (no JavaScript),
 *   2. a streamed route delivers chunks incrementally,
 *   3. cancelling the reader is observed on the server (abort propagation),
 *   4. a full stream completes,
 *   5. the probes are invisible without the token.
 *
 * The token is required on both sides; without it the app answers 404. Run it
 * against a disposable deployment, not the instance you keep your money in.
 */

const BASE_URL = process.env.SMOKE_BASE_URL ?? process.env.E2E_BASE_URL ?? "http://localhost:3000";
const TOKEN = process.env.COMPAT_TOKEN ?? "";

const TOTAL_CHUNKS = 5;
const CHUNK_DELAY_MS = 150;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readChunk(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> {
  const { value, done } = await reader.read();
  if (done) throw new Error("Stream ended before the first chunk arrived.");
  return new TextDecoder().decode(value);
}

async function streamStats(): Promise<{ started: number; completed: number; cancelled: number }> {
  const response = await fetch(`${BASE_URL}/api/compat/stream?op=stats`, {
    headers: { "x-cashow-compat-token": TOKEN },
    cache: "no-store",
  });
  assert(response.ok, `Stats endpoint failed with ${response.status}.`);
  return (await response.json()) as { started: number; completed: number; cancelled: number };
}

async function checkServerAction(): Promise<{ serverTime: string; latencyMs: number }> {
  const pageUrl = new URL("/compat", BASE_URL);
  pageUrl.searchParams.set("token", TOKEN);

  const page = await fetch(pageUrl, { cache: "no-store" });
  assert(page.status === 200, `Compat page returned ${page.status}.`);
  const html = await page.text();
  assert(html.includes('data-testid="compat-ready"'), "Compat page did not render its body.");

  // Next renders a no-JS form post as `<form method="POST">` plus a hidden
  // `$ACTION_ID_…` input; replaying it is exactly what a browser without
  // JavaScript does.
  const actionId = /name="(\$ACTION_ID_[^"]+)"/.exec(html)?.[1];
  assert(actionId !== undefined, "No Server Action id found in the rendered form.");

  const note = `smoke-${Date.now()}`;
  const form = new FormData();
  form.set(actionId, "");
  form.set("token", TOKEN);
  form.set("note", note);

  const startedAt = performance.now();
  const action = await fetch(pageUrl, {
    method: "POST",
    body: form,
    headers: { Origin: new URL(BASE_URL).origin },
    redirect: "follow",
    cache: "no-store",
  });
  const latencyMs = Math.round(performance.now() - startedAt);

  assert(action.ok, `Server Action POST returned ${action.status}.`);
  const after = await action.text();
  assert(after.includes(note), "The Server Action did not echo the submitted note.");

  const serverTime = /data-testid="compat-at">([^<]+)</.exec(after)?.[1] ?? "";
  assert(
    serverTime !== "" && serverTime !== "—",
    "The Server Action produced no server timestamp.",
  );

  const parsed = Date.parse(serverTime);
  assert(Number.isFinite(parsed), `Server timestamp is not a date: ${serverTime}`);
  assert(
    Math.abs(Date.now() - parsed) < 2 * 60 * 1000,
    `Server timestamp is not recent: ${serverTime}`,
  );

  return { serverTime, latencyMs };
}

async function checkStreaming(): Promise<{
  firstChunkMs: number;
  fullRunMs: number;
  serverSawCancel: boolean;
}> {
  const streamUrl = new URL("/api/compat/stream", BASE_URL);
  streamUrl.searchParams.set("token", TOKEN);

  const before = await streamStats();

  // --- Incremental delivery, then cancel after the first chunk ------------
  const startedAt = performance.now();
  const response = await fetch(streamUrl, { cache: "no-store" });
  assert(response.status === 200, `Stream route returned ${response.status}.`);
  assert(
    response.headers.get("content-type")?.includes("application/x-ndjson") === true,
    "Stream route did not send NDJSON.",
  );
  assert(response.body !== null, "Stream route returned no body.");

  const reader = response.body.getReader() as ReadableStreamDefaultReader<Uint8Array>;
  const firstChunkMs = Math.round(performance.now() - startedAt);
  const first = JSON.parse((await readChunk(reader)).trim()) as { chunk: number; total: number };
  assert(first.chunk === 1 && first.total === TOTAL_CHUNKS, "Unexpected first chunk.");
  assert(
    firstChunkMs < CHUNK_DELAY_MS * 2,
    `First chunk took ${firstChunkMs} ms; the route is buffering instead of streaming.`,
  );

  await reader.cancel("compat smoke: deliberate cancel");
  await sleep(CHUNK_DELAY_MS * 3);

  const afterCancel = await streamStats();
  const serverSawCancel = afterCancel.cancelled > before.cancelled;

  // --- A full run completes and is paced ---------------------------------
  const fullStartedAt = performance.now();
  const full = await fetch(streamUrl, { cache: "no-store" });
  assert(full.status === 200, `Second stream returned ${full.status}.`);
  const lines = (await full.text()).trim().split("\n");
  const fullRunMs = Math.round(performance.now() - fullStartedAt);

  assert(lines.length === TOTAL_CHUNKS, `Expected ${TOTAL_CHUNKS} chunks, got ${lines.length}.`);
  const last = JSON.parse(lines.at(-1) ?? "{}") as { chunk: number };
  assert(last.chunk === TOTAL_CHUNKS, "Final chunk is out of order.");
  assert(
    fullRunMs >= CHUNK_DELAY_MS * (TOTAL_CHUNKS - 1),
    `Full stream finished in ${fullRunMs} ms; the pacing delay did not apply.`,
  );

  return { firstChunkMs, fullRunMs, serverSawCancel };
}

async function checkHiddenWithoutToken(): Promise<void> {
  const page = await fetch(`${BASE_URL}/compat`, { cache: "no-store" });
  assert(page.status === 404, `Compat page should be 404 without a token, got ${page.status}.`);

  const stream = await fetch(`${BASE_URL}/api/compat/stream`, { cache: "no-store" });
  assert(
    stream.status === 404,
    `Stream route should be 404 without a token, got ${stream.status}.`,
  );
}

async function main(): Promise<void> {
  assert(
    TOKEN !== "",
    "COMPAT_TOKEN is required. Set it in the environment that starts the web server, then re-run.",
  );

  await checkHiddenWithoutToken();
  const action = await checkServerAction();
  const streaming = await checkStreaming();

  assert(
    streaming.serverSawCancel,
    "The server did not record the reader cancellation; abort did not propagate.",
  );

  console.log(
    JSON.stringify(
      {
        level: "info",
        msg: "framework compatibility gates ok",
        baseUrl: BASE_URL,
        gates: {
          serverAction: {
            passed: true,
            serverTime: action.serverTime,
            latencyMs: action.latencyMs,
          },
          streaming: {
            passed: true,
            firstChunkMs: streaming.firstChunkMs,
            fullRunMs: streaming.fullRunMs,
          },
          abort: { passed: true, serverObservedCancel: streaming.serverSawCancel },
          tokenGate: { passed: true, hiddenWithoutToken: true },
        },
      },
      null,
      2,
    ),
  );
}

await main();

export {};
