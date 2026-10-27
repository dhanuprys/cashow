import { connection } from "next/server";
import { getAuthConfig } from "@/lib/auth/config";
import { json } from "@/lib/auth/http";
import { getSessionUser } from "@/lib/auth/session";
import { hasAnyUser } from "@/lib/auth/setup";

/**
 * Boot state for the client: whether the one-time owner setup is still open,
 * and whether this browser already has a valid session.
 */
export async function GET() {
  await connection();

  const setupRequired = !(await hasAnyUser());
  const user = setupRequired ? null : await getSessionUser();

  return json({
    setupRequired,
    setupTokenRequired: getAuthConfig().setupTokenRequired,
    authenticated: user !== null,
    user:
      user === null
        ? null
        : { id: user.id, name: user.name, email: user.email, timezone: user.timezone },
  });
}
