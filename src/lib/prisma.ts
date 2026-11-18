import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PGlite } from "@electric-sql/pglite";
import { PrismaPGlite } from "pglite-prisma-adapter";
import { ensureDatabaseSeeded } from "./seed";

const globalForPrisma = globalThis as unknown as {
  __klPrismaPromise?: Promise<PrismaClient>;
  __klPglite?: PGlite;
};

async function applyInitMigrationIfNeeded(pg: PGlite) {
  const check = await pg.query<{ reg: string | null }>(`SELECT to_regclass('"Users"') as reg`);
  if (!check.rows[0]?.reg) {
    const migrationPath = path.join(
      process.cwd(),
      "prisma",
      "migrations",
      "20261116000000_init",
      "migration.sql"
    );
    const sql = fs.readFileSync(migrationPath, "utf8");
    await pg.exec(sql);
  }
}

async function initPrismaClient(): Promise<PrismaClient> {
  const useExternal = process.env.USE_EXTERNAL_POSTGRES === "true";

  if (useExternal) {
    const client = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });
    await client.$connect();
    await ensureDatabaseSeeded(client);
    return client;
  }

  // Use ASCII path outside Thai-named directory for PGlite persistence, or in-memory during tests/build
  const isMemoryMode =
    process.env.NODE_ENV === "test" ||
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.PGLITE_MEMORY === "true";

  const dataDir = isMemoryMode
    ? undefined
    : process.env.PGLITE_DATA_DIR || "E:/kinglegacy-pgdata";

  if (dataDir && !fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const pg = dataDir ? new PGlite(dataDir) : new PGlite();
  await pg.waitReady;
  globalForPrisma.__klPglite = pg;

  await applyInitMigrationIfNeeded(pg);

  const adapter = new PrismaPGlite(pg);
  const client = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  if (process.env.NEXT_PHASE !== "phase-production-build") {
    await ensureDatabaseSeeded(client);
  }

  return client;
}

export async function getPrisma(): Promise<PrismaClient> {
  if (!globalForPrisma.__klPrismaPromise) {
    globalForPrisma.__klPrismaPromise = initPrismaClient().catch((err) => {
      globalForPrisma.__klPrismaPromise = undefined;
      throw err;
    });
  }
  return globalForPrisma.__klPrismaPromise;
}
