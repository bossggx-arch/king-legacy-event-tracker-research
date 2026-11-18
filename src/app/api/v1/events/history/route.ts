import { getPrisma } from "@/lib/prisma";
import { applyApiGuard, jsonOk, parsePagination } from "@/lib/api-utils";
import { normalizeWorldFilterParam } from "@/lib/scanner/world-detector";
import type { Prisma } from "@prisma/client";

export async function GET(request: Request) {
  const guard = await applyApiGuard(request, "events-history");
  if (!guard.allowed) return guard.errorResponse!;

  const prisma = await getPrisma();
  const { searchParams } = new URL(request.url);
  const { page, limit, skip } = parsePagination(searchParams, 50, 200);
  const worldCode = normalizeWorldFilterParam(searchParams.get("world"));
  const q = searchParams.get("q")?.trim();

  const where: Prisma.EventHistoryWhereInput = {};
  if (worldCode) where.world = { worldCode };
  if (q) {
    where.OR = [
      { eventName: { contains: q, mode: "insensitive" } },
      { serverJobId: { contains: q, mode: "insensitive" } },
      { worldName: { contains: q, mode: "insensitive" } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.eventHistory.count({ where }),
    prisma.eventHistory.findMany({
      where,
      include: { event: true, world: true },
      orderBy: { detectedAt: "desc" },
      skip,
      take: limit,
    }),
  ]);

  return jsonOk(
    {
      data: items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      serverTimeMs: Date.now(),
    },
    200,
    guard.headers
  );
}
