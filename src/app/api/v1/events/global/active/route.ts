import { getPrisma } from "@/lib/prisma";
import { applyApiGuard, jsonOk } from "@/lib/api-utils";
import { normalizeWorldFilterParam } from "@/lib/scanner/world-detector";
import type { Prisma } from "@prisma/client";

export async function GET(request: Request) {
  const guard = await applyApiGuard(request, "events-global-active");
  if (!guard.allowed) return guard.errorResponse!;

  const prisma = await getPrisma();
  const { searchParams } = new URL(request.url);
  const worldCode = normalizeWorldFilterParam(searchParams.get("world"));

  const where: Prisma.EventDetectionWhereInput = {
    status: { in: ["ACTIVE", "UPCOMING"] },
  };
  if (worldCode) where.world = { worldCode };

  const detections = await prisma.eventDetection.findMany({
    where,
    include: {
      event: { include: { category: true } },
      server: true,
      world: true,
      source: true,
    },
    orderBy: [{ expiresAt: "asc" }, { detectedAt: "desc" }],
    take: 150,
  });

  return jsonOk(
    { data: detections, count: detections.length, serverTimeMs: Date.now() },
    200,
    guard.headers
  );
}
