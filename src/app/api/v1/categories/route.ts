import { getPrisma } from "@/lib/prisma";
import { applyApiGuard, jsonOk } from "@/lib/api-utils";

export async function GET(request: Request) {
  const guard = await applyApiGuard(request, "categories-list");
  if (!guard.allowed) return guard.errorResponse!;

  const prisma = await getPrisma();
  const [categories, worlds] = await Promise.all([
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
    prisma.serverWorld.findMany({
      include: {
        _count: {
          select: {
            servers: { where: { serverStatus: { not: "CLOSED" } } },
            eventDetections: { where: { status: { in: ["ACTIVE", "UPCOMING"] } } },
          },
        },
      },
    }),
  ]);

  const categoryData = categories.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description,
    icon: c.icon,
    sortOrder: c.sortOrder,
    eventCount: c.events.length,
    activeDetectionCount: c.events.reduce((acc, e) => acc + e.detections.length, 0),
  }));

  const worldData = worlds
    .filter((w) => w.worldCode !== "UNKNOWN")
    .map((w) => ({
      id: w.id,
      worldCode: w.worldCode,
      name: w.name,
      placeId: w.placeId,
      serverCount: w._count.servers,
      activeDetectionCount: w._count.eventDetections,
    }));

  return jsonOk(
    { categories: categoryData, worlds: worldData, serverTimeMs: Date.now() },
    200,
    guard.headers
  );
}
