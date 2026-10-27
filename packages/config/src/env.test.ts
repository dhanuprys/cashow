import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadEnv } from "./env";

const DATABASE_URL = "postgresql://user:pass@localhost:5432/cashow";

describe("loadEnv", () => {
  test("applies defaults and treats empty values as unset", () => {
    const env = loadEnv({
      DATABASE_URL,
      NODE_ENV: "",
      AUTH_SECRET: "",
      DEEPSEEK_API_KEY: "",
    });

    expect(env.NODE_ENV).toBe("development");
    expect(env.WEB_ORIGIN).toBe("http://localhost:3000");
    expect(env.AUTH_SECRET).toBeUndefined();
    expect(env.DEEPSEEK_API_KEY).toBeUndefined();
  });

  test("requires DATABASE_URL", () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL/);
  });

  test("defaults BACKUP_DIR and accepts an override", () => {
    expect(loadEnv({ DATABASE_URL }).BACKUP_DIR).toBe("/backups");
    expect(loadEnv({ DATABASE_URL, BACKUP_DIR: "./backups" }).BACKUP_DIR).toBe("./backups");
  });

  test("reads a <NAME>_FILE secret and trims it", () => {
    const dir = mkdtempSync(join(tmpdir(), "cashow-env-"));
    const file = join(dir, "database_url");
    writeFileSync(file, `${DATABASE_URL}\n`);

    try {
      expect(loadEnv({ DATABASE_URL_FILE: file }).DATABASE_URL).toBe(DATABASE_URL);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("an explicit value wins over the file", () => {
    const dir = mkdtempSync(join(tmpdir(), "cashow-env-"));
    const file = join(dir, "database_url");
    writeFileSync(file, "postgresql://file:file@localhost:5432/other");

    try {
      const env = loadEnv({ DATABASE_URL, DATABASE_URL_FILE: file });
      expect(env.DATABASE_URL).toBe(DATABASE_URL);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("reports the file path when it cannot be read", () => {
    expect(() => loadEnv({ DATABASE_URL_FILE: "/nonexistent/cashow" })).toThrow(
      /DATABASE_URL_FILE/,
    );
  });
});
