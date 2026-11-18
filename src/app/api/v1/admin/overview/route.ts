import { getPrisma } from "@/lib/prisma";
import { applyApiGuard, jsonError, jsonOk } from "@/lib/api-utils";
import { requireAdmin } from "@/lib/auth";
import { getWorkerQueueHealth } from "@/lib/scanner/queue";
import { getCacheClient } from "@/lib/redis";

export async function GET(request: Request) {
  const guard = await applyApiGuard(request, "admin-overview");
  if (!guard.allowed) return guard.errorResponse!;

  const admin = await requireAdmin(request);
  if (!admin) return jsonError("Admin authentication required", 403, undefined, guard.headers);

  const prisma = await getPrisma();
  const [
    totalUsers,
    totalServers,
    totalEvents,
    activeEvents,
    verifiedEvents,
    pendingReports,
    totalReports,
    recentJobs,
    recentLogs,
    failedJobsCount,
    cache,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.server.count(),
    prisma.event.count(),
    prisma.eventDetection.count({ where: { status: "ACTIVE" } }),
    prisma.eventDetection.count({ where: { status: "ACTIVE", verificationStatus: "VERIFIED" } }),
    prisma.eventReport.count({ where: { status: "PENDING" } }),
    prisma.eventReport.count(),
    prisma.scannerJob.findMany({ orderBy: { startedAt: "desc" }, take: 15 }),
    prisma.adminLog.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.scannerJob.count({ where: { status: "FAILED" } }),
    getCacheClient(),
  ]);

  const worker = getWorkerQueueHealth();

  return jsonOk(
    {
      metrics: {
        totalUsers,
        totalServers,
        totalEvents,
        activeEvents,
        verifiedEvents,
        pendingReports,
        totalReports,
        systemErrors: failedJobsCount + (worker.lastError ? 1 : 0),
      },
      health: {
        apiStatus: "HEALTHY",
        databaseStatus: "CONNECTED",
        cacheStatus: cache.mode === "redis" ? "REDIS_CONNECTED" : "EMBEDDED_CACHE",
        scannerStatus: worker.workerRunning ? "RUNNING" : "IDLE",
        backgroundJobsStatus: worker.mode,
        lastError: worker.lastError,
      },
      recentJobs,
      recentLogs,
      serverTimeMs: Date.now(),
    },
    200,
    guard.headers
  );
}
