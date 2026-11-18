import { getPrisma } from "@/lib/prisma";
import { applyApiGuard, jsonOk } from "@/lib/api-utils";
import { getScannerCoverageReport } from "@/lib/scanner/engine";

export async function GET(request: Request) {
  const guard = await applyApiGuard(request, "scanner-statistics");
  if (!guard.allowed) return guard.errorResponse!;

  const prisma = await getPrisma();
  const [coverage, byVerification, byCategory, totalScans, totalHistory] = await Promise.all([
    getScannerCoverageReport(prisma),
    prisma.eventDetection.groupBy({
      by: ["verificationStatus"],
      where: { status: { in: ["ACTIVE", "UPCOMING"] } },
      _count: { _all: true },
    }),
    prisma.eventCategory.findMany({
      include: {
        events: {
          include: {
            detections: {
              where: { status: { in: ["ACTIVE", "UPCOMING"] } },
              select: { id: true },
            },
          },
        },
      },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.serverScan.count(),
    prisma.eventHistory.count(),
  ]);

  const categoryBreakdown = byCategory.map((cat) => ({
    slug: cat.slug,
    name: cat.name,
    activeCount: cat.events.reduce((sum, e) => sum + e.detections.length, 0),
  }));

  return jsonOk(
    {
      coverage,
      byVerification: byVerification.map((v) => ({
        verificationStatus: v.verificationStatus,
        count: v._count._all,
      })),
      categoryBreakdown,
      totalScans,
      totalHistory,
      serverTimeMs: Date.now(),
    },
    200,
    guard.headers
  );
}
