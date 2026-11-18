import { getPrisma } from "@/lib/prisma";
import { applyApiGuard, jsonOk, parsePagination } from "@/lib/api-utils";

export async function GET(request: Request) {
  const guard = await applyApiGuard(request, "scanner-history");
  if (!guard.allowed) return guard.errorResponse!;

  const prisma = await getPrisma();
  const { searchParams } = new URL(request.url);
  const { page, limit, skip } = parsePagination(searchParams, 30, 100);

  const [jobs, recentScans, totalJobs] = await Promise.all([
    prisma.scannerJob.findMany({
      orderBy: { startedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.serverScan.findMany({
      include: {
        server: { select: { jobId: true, placeId: true } },
        world: { select: { worldCode: true, name: true } },
      },
      orderBy: { scannedAt: "desc" },
      take: 40,
    }),
    prisma.scannerJob.count(),
  ]);

  return jsonOk(
    {
      jobs,
      recentScans,
      pagination: { page, limit, total: totalJobs, totalPages: Math.ceil(totalJobs / limit) },
      serverTimeMs: Date.now(),
    },
    200,
    guard.headers
  );
}
