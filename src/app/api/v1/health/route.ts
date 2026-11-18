import { getPrisma } from "@/lib/prisma";
import { jsonOk } from "@/lib/api-utils";
import { getCacheClient } from "@/lib/redis";
import { getWorkerQueueHealth } from "@/lib/scanner/queue";

export async function GET() {
  const started = Date.now();
  let dbStatus = "DOWN";
  let counts = { servers: 0, events: 0, activeDetections: 0 };

  try {
    const prisma = await getPrisma();
    const [servers, events, activeDetections] = await Promise.all([
      prisma.server.count(),
      prisma.event.count(),
      prisma.eventDetection.count({ where: { status: { in: ["ACTIVE", "UPCOMING"] } } }),
    ]);
    dbStatus = "CONNECTED";
    counts = { servers, events, activeDetections };
  } catch (err) {
    return jsonOk(
      {
        status: "DEGRADED",
        database: "ERROR",
        error: err instanceof Error ? err.message : "Database error",
        serverTimeMs: Date.now(),
      },
      503
    );
  }

  const cache = await getCacheClient();
  const worker = getWorkerQueueHealth();

  return jsonOk({
    status: "OK",
    api: "HEALTHY",
    database: dbStatus,
    databaseEngine: process.env.USE_EXTERNAL_POSTGRES === "true" ? "postgresql" : "postgresql-pglite",
    cache: cache.mode,
    worker,
    counts,
    latencyMs: Date.now() - started,
    serverTimeMs: Date.now(),
  });
}
