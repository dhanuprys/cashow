import { assertSameOrigin, json } from "@/lib/auth/http";
import { revokeCurrentSession } from "@/lib/auth/session";

export async function POST(request: Request) {
  const originError = assertSameOrigin(request);
  if (originError !== null) return originError;

  await revokeCurrentSession();
  return json({ ok: true });
}
