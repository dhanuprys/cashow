import { describe, expect, it } from "bun:test";
import { checkPassword, hashPassword } from "./session";

describe("Password Hashing & Verification (scrypt)", () => {
  it("hashes password with scrypt and verifies correctly", async () => {
    const raw = "SuperSecret123!";
    const hash = await hashPassword(raw);

    expect(hash).toStartWith("scrypt$");
    expect(await checkPassword(raw, hash)).toBe(true);
    expect(await checkPassword("WrongPassword", hash)).toBe(false);
  });

  it("fails verification on corrupted or invalid hash strings", async () => {
    expect(await checkPassword("test", "")).toBe(false);
    expect(await checkPassword("test", "invalid-format")).toBe(false);
    expect(await checkPassword("test", "bcrypt$invalid")).toBe(false);
    expect(await checkPassword("test", null)).toBe(false);
    expect(await checkPassword("test", undefined)).toBe(false);
  });
});
