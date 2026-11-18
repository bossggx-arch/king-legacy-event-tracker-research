import { getPrisma } from "@/lib/prisma";
import { applyApiGuard, jsonOk } from "@/lib/api-utils";

export async function GET(request: Request) {
  const guard = await applyApiGuard(request, "events-upcoming");
  if (!guard.allowed) return guard.errorResponse!;

  const prisma = await getPrisma();
  const detections = await prisma.eventDetection.findMany({
    where: { status: "UPCOMING" },
    include: {
      event: { include: { category: true } },
      server: true,
      world: true,
      source: true,
    },
    orderBy: { startedAt: "asc" },
    take: 100,
  });

  return jsonOk(
    { data: detections, count: detections.length, serverTimeMs: Date.now() },
    200,
    guard.headers
  );
}
