import { timingSafeEqual } from "node:crypto";
import { getDb } from "@/lib/db";
import { getAuthConfig } from "./config";

/** The first-run gate: `/setup` stays open only while no user exists. */
export async function hasAnyUser(): Promise<boolean> {
  const db = await getDb();
  const rows = await db.orm.public.User.select("id").limit(1).all();
  return rows.length > 0;
}

/**
 * Compare the optional `SETUP_TOKEN`. Length is compared first because
 * `timingSafeEqual` requires equal-length buffers; the token is a one-time
 * bootstrap secret, not a long-lived password.
 */
export function setupTokenMatches(provided: string | undefined): boolean {
  const { setupToken } = getAuthConfig();
  if (setupToken === undefined) return true;
  if (provided === undefined) return false;
  if (provided.length !== setupToken.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(setupToken));
}
