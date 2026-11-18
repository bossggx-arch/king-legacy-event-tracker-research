import { getPrisma } from "@/lib/prisma";
import { applyApiGuard, jsonError, jsonOk, parsePagination } from "@/lib/api-utils";
import { normalizeWorldFilterParam } from "@/lib/scanner/world-detector";

export async function GET(
  request: Request,
  context: { params: Promise<{ world: string }> }
) {
  const guard = await applyApiGuard(request, "servers-world");
  if (!guard.allowed) return guard.errorResponse!;

  const { world } = await context.params;
  const worldCode = normalizeWorldFilterParam(world);
  if (!worldCode) {
    return jsonError(`Unsupported world filter: ${world}`, 400, undefined, guard.headers);
  }

  const prisma = await getPrisma();
  const { searchParams } = new URL(request.url);
  const { page, limit, skip } = parsePagination(searchParams, 50, 200);

  const [total, servers] = await Promise.all([
    prisma.server.count({ where: { world: { worldCode }, serverStatus: { not: "CLOSED" } } }),
    prisma.server.findMany({
      where: { world: { worldCode }, serverStatus: { not: "CLOSED" } },
      include: {
        world: true,
        detections: {
          where: { status: { in: ["ACTIVE", "UPCOMING"] } },
          include: { event: { include: { category: true } }, source: true },
        },
      },
      orderBy: [{ lastChecked: "desc" }, { playerCount: "desc" }],
      skip,
      take: limit,
    }),
  ]);

  return jsonOk(
    {
      worldCode,
      data: servers,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      serverTimeMs: Date.now(),
    },
    200,
    guard.headers
  );
}
