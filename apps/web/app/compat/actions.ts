"use server";

import { redirect } from "next/navigation";
import { compatTokenMatches } from "@/lib/compat";

/**
 * The Server Action behind the compatibility gate. It runs on the server (Bun
 * in the production image) and proves the action round-trip: a plain HTML form
 * POST reaches this module, the server computes the timestamp, and the browser
 * lands on a redirect carrying the result.
 *
 * The action is re-checked here because a rendered form is not a security
 * boundary (plan §6, server action guidance).
 */
export async function compatEcho(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  if (!compatTokenMatches(token)) redirect("/compat");

  const note = String(formData.get("note") ?? "").slice(0, 200);
  const params = new URLSearchParams({
    token,
    echo: note,
    at: new Date().toISOString(),
  });

  redirect(`/compat?${params.toString()}`);
}
