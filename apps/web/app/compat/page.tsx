import { notFound } from "next/navigation";
import { connection } from "next/server";
import { compatTokenMatches } from "@/lib/compat";
import { compatEcho } from "./actions";

type CompatSearchParams = Promise<Record<string, string | string[] | undefined>>;

// A blocking route: the token check must run before the response starts, so a
// disabled probe returns a real 404 rather than a shell plus streamed not-found.
export const instant = false;

/**
 * The Server Action gate. Rendering is request-time on purpose: the token check
 * must run before any HTML is flushed so an unconfigured deployment answers a
 * real 404 instead of a shell with a streamed not-found.
 */
export default async function CompatPage({ searchParams }: { searchParams: CompatSearchParams }) {
  // `connection()` before any output means the route has no static shell at
  // all: the token check decides the response status before a byte is sent.
  await connection();

  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  if (!compatTokenMatches(token)) notFound();

  const echo = typeof params.echo === "string" ? params.echo : "";
  const at = typeof params.at === "string" ? params.at : "";

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10" data-testid="compat-ready">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">Cashow</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Compatibility gate</h1>

      <div className="mt-6 rounded-2xl border border-border bg-card p-6">
        <h2 className="font-semibold">Server Action</h2>
        <dl className="mt-4 grid grid-cols-[6rem_1fr] gap-2 text-sm">
          <dt className="text-muted-foreground">Echo</dt>
          <dd data-testid="compat-echo">{echo === "" ? "—" : echo}</dd>
          <dt className="text-muted-foreground">Server time</dt>
          <dd data-testid="compat-at">{at === "" ? "—" : at}</dd>
        </dl>

        {/* A plain form post: works without JavaScript, which is the point of
            this gate. */}
        <form action={compatEcho} className="mt-6 flex flex-wrap items-end gap-3">
          <input type="hidden" name="token" value={token} />
          <label className="flex-1 text-sm font-medium" htmlFor="compat-note">
            Pesan
            <input
              className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
              id="compat-note"
              name="note"
              defaultValue="ping"
              maxLength={200}
            />
          </label>
          <button
            className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground"
            type="submit"
          >
            Kirim
          </button>
        </form>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-6">
        <h2 className="font-semibold">Streaming</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          <code>GET /api/compat/stream?token=…</code> mengirim NDJSON bertahap dan berhenti saat
          klien membatalkan.
        </p>
      </div>
    </main>
  );
}
