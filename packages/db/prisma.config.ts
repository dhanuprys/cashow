import { fileURLToPath } from "node:url";
import { definePrismaConfig } from "@prisma/cli-engine";
import { defineConfig as ormConfig } from "@prisma/orm-postgres/config";
import { config as loadDotenv } from "dotenv";

// `packages/db/.env` may override the connection for the CLI; the repo root
// `.env` is the canonical fallback. dotenv never overwrites a value that is
// already set, so the package file wins and real environment variables win
// over both.
loadDotenv({ quiet: true });
loadDotenv({ path: fileURLToPath(new URL("../../.env", import.meta.url)), quiet: true });

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (url === undefined || url === "") {
    throw new Error("DATABASE_URL is not set. Add it to packages/db/.env or the repo root .env.");
  }
  return url;
}

export default definePrismaConfig({
  orm: ormConfig({
    contract: "./src/prisma/contract.prisma",
    db: {
      connection: requireDatabaseUrl(),
    },
  }),
});
