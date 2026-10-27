/**
 * End-to-end passkey ceremony and ledger smoke against a running dev server.
 *
 * Covers first-run setup and default seeding, quick add, an income/expense
 * pair with an allocation, an attachment upload/serve (and its anonymous 401),
 * then add/logout/login/revoke with a virtual authenticator. The script owns
 * the only account in the database: it refuses to run when an owner already
 * exists, and cleans up rows and uploaded bytes in `finally`.
 *
 *   bun run dev                 # in another terminal
 *   bun run test:e2e:auth
 *
 * Override the browser with CHROME_PATH. Requires a Chrome/Chromium binary
 * with CDP support; CI can skip this script.
 */

import { rm } from "node:fs/promises";
import path from "node:path";
import { db } from "@cashow/db";
import { chromium } from "playwright-core";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const CHROME_PATH =
  process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OWNER_NAME = "E2E Owner";
const OWNER_EMAIL = `e2e-${Date.now()}@cashow.test`;

/** A 1×1 transparent PNG: the smallest thing that exercises the image path. */
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

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

    // --- Ledger smoke: defaults, quick add, allocation, attachment --------
    // Setup must leave a usable ledger, not an empty shell.
    const owner = await db.orm.public.User.where({ email: OWNER_EMAIL }).first();
    assert(owner !== null, "Owner row was not created by setup.");
    const seededAccounts = await db.orm.public.Account.where({ userId: owner.id }).all();
    assert(seededAccounts.length > 0, "Setup did not seed a default account.");
    const seededCategories = await db.orm.public.Category.where({ userId: owner.id }).all();
    assert(seededCategories.length > 0, "Setup did not seed default categories.");

    // Quick add: one field and a button, no page navigation.
    await page.getByLabel("Jumlah").fill("12rb");
    await page.getByLabel("Catatan").fill("E2E cepat");
    await page.getByRole("button", { name: "Catat cepat" }).click();
    await page
      .waitForFunction(
        'document.body.innerText.includes("Tercatat ✓") || document.querySelector(\'p[role="alert"]\') !== null',
        null,
        { timeout: 10_000 },
      )
      .catch(() => undefined);
    const quickAddError = await page
      .locator('p[role="alert"]')
      .first()
      .textContent()
      .catch(() => null);
    assert(quickAddError === null, `Quick add failed: ${quickAddError}`);
    await page.getByText("Tercatat ✓").first().waitFor({ timeout: 10_000 });
    await page.reload();
    await page.getByText("E2E cepat").first().waitFor({ timeout: 10_000 });

    // Income Rp500.000 through the full form.
    await page.goto(`${BASE_URL}/app/transactions/new?type=INCOME`);
    await page.locator("#amount").fill("500rb");
    await page.locator("#note").fill("Gaji Oktober");
    await page.getByRole("button", { name: "Simpan transaksi" }).click();
    await page.waitForURL(
      (url) => /^\/app\/transactions\/[^/]+$/.test(url.pathname) && !url.pathname.endsWith("/new"),
      { timeout: 20_000 },
    );
    const incomeUrl = page.url();
    await page
      .getByText(/Rp\s?500\.000/)
      .first()
      .waitFor({ timeout: 10_000 });

    // Expense Rp250.000 allocated to that income.
    await page.goto(`${BASE_URL}/app/transactions/new?type=EXPENSE`);
    await page.locator("#amount").fill("250rb");
    await page.locator("#note").fill("Belanja dapur");
    await page.getByLabel("Alokasi dari Gaji Oktober").fill("250rb");
    await page.getByRole("button", { name: "Simpan transaksi" }).click();
    await page.waitForURL(
      (url) => /^\/app\/transactions\/[^/]+$/.test(url.pathname) && !url.pathname.endsWith("/new"),
      { timeout: 20_000 },
    );
    assert(page.url() !== incomeUrl, "Expense landed on the income detail page.");
    await page
      .getByText(/Rp\s?250\.000/)
      .first()
      .waitFor({ timeout: 10_000 });
    await page
      .getByRole("link", { name: /Gaji Oktober/ })
      .first()
      .waitFor({
        timeout: 10_000,
      });

    // The income now shows the draw against it and Rp250.000 still free.
    await page.goto(incomeUrl);
    await page
      .getByRole("link", { name: /Belanja dapur/ })
      .first()
      .waitFor({
        timeout: 10_000,
      });

    // Attachment upload (a 1×1 PNG) and session-scoped serving.
    await page.goto(`${BASE_URL}/app/transactions`);
    const expenseLink = page.locator('a[href^="/app/transactions/"]').filter({
      hasText: "Belanja dapur",
    });
    await expenseLink.first().click();
    await page.waitForURL(/\/app\/transactions\/[^/]+$/, { timeout: 10_000 });

    await page
      .locator('input[type="file"]')
      .setInputFiles({ name: "struk.png", mimeType: "image/png", buffer: PNG_1X1 });
    const preview = page.locator('img[src^="/api/attachments/"]').first();
    await preview.waitFor({ timeout: 20_000 });
    const attachmentSrc = await preview.getAttribute("src");
    assert(attachmentSrc !== null, "Attachment preview has no source.");
    const served = await page.request.get(`${BASE_URL}${attachmentSrc}`);
    assert(served.status() === 200, `Attachment GET returned ${served.status()}.`);
    assert(
      (served.headers()["content-type"] ?? "").startsWith("image/png"),
      "Attachment was not served as image/png.",
    );
    assert(
      (await served.body()).byteLength === PNG_1X1.byteLength,
      "Served attachment does not match the uploaded bytes.",
    );

    // An unauthenticated request must not read the attachment.
    const anonymous = await fetch(`${BASE_URL}${attachmentSrc}`);
    assert(anonymous.status === 401, `Anonymous attachment read returned ${anonymous.status}.`);

    // --- Passkeys live on /app/settings ----------------------------------
    await page.goto(`${BASE_URL}/app/settings`);

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
    await page.goto(`${BASE_URL}/app/settings`);
    await page.getByRole("button", { name: "Cabut" }).first().waitFor({ timeout: 10_000 });
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
          steps: [
            "setup",
            "defaults",
            "quick-add",
            "income-500k",
            "expense-250k-allocation",
            "attachment-upload-serve",
            "add-passkey",
            "logout",
            "login",
            "revoke",
            "last-passkey-guard",
          ],
          authenticatorId,
          secondAuthenticatorId,
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close().catch(() => undefined);
    // Delete attachment bytes before the cascade drops their rows: find the
    // owner first, collect keys, then remove the user (which cascades the
    // ledger) and the files.
    const owner = await db.orm.public.User.where({ email: OWNER_EMAIL }).first();
    const attachments =
      owner === null ? [] : await db.orm.public.Attachment.where({ userId: owner.id }).all();
    await db.orm.public.User.where({ email: OWNER_EMAIL }).delete();
    await db.orm.public.AuthChallenge.where((challenge) => challenge.id.neq("")).deleteAll();

    const roots = [
      process.env.STORAGE_DIR === undefined ? null : path.resolve(process.env.STORAGE_DIR),
      path.resolve("apps/web/data/uploads"),
      path.resolve("data/uploads"),
    ].filter((root): root is string => root !== null);
    for (const attachment of attachments) {
      for (const root of roots) {
        await rm(path.join(root, attachment.storageKey), { force: true });
      }
    }
  }
}

await main();
await db.close();
