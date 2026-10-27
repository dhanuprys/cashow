/**
 * End-to-end passkey ceremony against a running dev server.
 *
 * Uses Chrome's WebAuthn virtual authenticator, so no physical passkey or
 * manual click is needed. The script owns the only account in the database:
 * it refuses to run when an owner already exists, and cleans up in `finally`.
 *
 *   bun run dev                 # in another terminal
 *   bun run test:e2e:auth
 *
 * Override the browser with CHROME_PATH. Requires a Chrome/Chromium binary
 * with CDP support; CI can skip this script.
 */

import { db } from "@cashow/db";
import { chromium } from "playwright-core";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const CHROME_PATH =
  process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OWNER_NAME = "E2E Owner";
const OWNER_EMAIL = `e2e-${Date.now()}@cashow.test`;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main(): Promise<void> {
  const status = (await fetch(`${BASE_URL}/api/auth/status`).then((r) => r.json())) as {
    setupRequired: boolean;
  };
  assert(
    status.setupRequired,
    "The database already has an owner. Run this script against a fresh database.",
  );

  const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable");

  const virtualAuthenticatorOptions = {
    protocol: "ctap2",
    ctap2Version: "ctap2_1",
    transport: "internal",
    hasResidentKey: true,
    hasUserVerification: true,
    isUserVerified: true,
    automaticPresenceSimulation: true,
  } as const;

  const { authenticatorId } = (await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: virtualAuthenticatorOptions,
  })) as { authenticatorId: string };

  try {
    // --- First-run setup: create owner + passkey -------------------------
    await page.goto(`${BASE_URL}/setup`);
    await page.locator("#setup-name").fill(OWNER_NAME);
    await page.locator("#setup-email").fill(OWNER_EMAIL);
    await page.getByRole("button", { name: "Buat passkey pemilik" }).click();
    await page.waitForURL("**/app", { timeout: 20_000 });
    await page.getByRole("heading", { name: `Halo, ${OWNER_NAME}.` }).waitFor({
      timeout: 10_000,
    });

    const cookies = await context.cookies();
    const session = cookies.find((cookie) => cookie.name === "cashow_session");
    assert(session !== undefined, "Session cookie was not set after setup.");
    assert(session.httpOnly, "Session cookie must be HttpOnly.");
    assert(session.sameSite === "Lax", `Unexpected SameSite: ${session.sameSite}`);

    // --- Add a second passkey to the same account -------------------------
    // A passkey lives on one authenticator, so simulate a second device by
    // swapping the virtual authenticator before the ceremony.
    await cdp.send("WebAuthn.removeVirtualAuthenticator", { authenticatorId });
    const { authenticatorId: secondAuthenticatorId } = (await cdp.send(
      "WebAuthn.addVirtualAuthenticator",
      { options: virtualAuthenticatorOptions },
    )) as { authenticatorId: string };

    await page.getByRole("button", { name: "Tambah passkey" }).click();
    await page.waitForFunction("document.querySelectorAll('section li').length === 2", null, {
      timeout: 20_000,
    });

    // --- Logout, then sign in with a discoverable passkey -----------------
    await page.getByRole("button", { name: "Keluar" }).click();
    await page.waitForURL("**/login", { timeout: 10_000 });
    await page.getByRole("button", { name: "Masuk dengan passkey" }).click();
    await page.waitForURL("**/app", { timeout: 20_000 });
    await page.getByRole("heading", { name: `Halo, ${OWNER_NAME}.` }).waitFor({
      timeout: 10_000,
    });

    // --- Revoke one passkey, keep the last one ----------------------------
    page.on("dialog", (dialog) => void dialog.accept());
    await page.getByRole("button", { name: "Cabut" }).first().click();
    await page.waitForFunction("document.querySelectorAll('section li').length === 1", null, {
      timeout: 20_000,
    });

    // The last active passkey must be protected from revocation.
    const listResponse = await page.request.get(`${BASE_URL}/api/auth/passkeys`);
    assert(listResponse.ok(), "Passkey list endpoint failed.");
    const list = (await listResponse.json()) as { passkeys: { id: string }[] };
    assert(list.passkeys.length === 1, "Exactly one passkey should remain.");
    const lastPasskeyId = list.passkeys[0]?.id;
    assert(lastPasskeyId !== undefined, "Remaining passkey has no id.");

    const revokeResponse = await page.request.delete(
      `${BASE_URL}/api/auth/passkeys/${lastPasskeyId}`,
    );
    assert(
      revokeResponse.status() === 409,
      `Revoking the last passkey must be refused, got ${revokeResponse.status()}.`,
    );

    console.log(
      JSON.stringify(
        {
          level: "info",
          msg: "passkey e2e ok",
          steps: ["setup", "add", "logout", "login", "revoke", "last-passkey-guard"],
          authenticatorId,
          secondAuthenticatorId,
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close().catch(() => undefined);
    // Cascades remove passkeys and sessions; challenges have no FK.
    await db.orm.public.User.where({ email: OWNER_EMAIL }).delete();
    await db.orm.public.AuthChallenge.where((challenge) => challenge.id.neq("")).deleteAll();
  }
}

await main();
await db.close();
