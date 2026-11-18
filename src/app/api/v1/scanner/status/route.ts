import { getPrisma } from "@/lib/prisma";
import { applyApiGuard, jsonOk } from "@/lib/api-utils";
import { getWorkerQueueHealth } from "@/lib/scanner/queue";
import { getCacheClient } from "@/lib/redis";

export async function GET(request: Request) {
  const guard = await applyApiGuard(request, "scanner-status");
  if (!guard.allowed) return guard.errorResponse!;

  const prisma = await getPrisma();
  const [latestJob, sources, cache] = await Promise.all([
    prisma.scannerJob.findFirst({ orderBy: { startedAt: "desc" } }),
    prisma.detectionSource.findMany({ orderBy: { trustWeight: "desc" } }),
    getCacheClient(),
  ]);

  const queueHealth = getWorkerQueueHealth();

  return jsonOk(
    {
      status: queueHealth.workerRunning ? "ONLINE" : "STANDBY",
      worker: queueHealth,
      cacheMode: cache.mode,
      latestJob,
      detectionSources: sources,
      serverTimeMs: Date.now(),
    },
    200,
    guard.headers
  );
}
