import { getPrisma } from "@/lib/prisma";
import { applyApiGuard, jsonOk, parsePagination } from "@/lib/api-utils";
import { normalizeWorldFilterParam } from "@/lib/scanner/world-detector";
import type { Prisma, ServerStatus } from "@prisma/client";

export async function GET(request: Request) {
  const guard = await applyApiGuard(request, "servers-list");
  if (!guard.allowed) return guard.errorResponse!;

  const prisma = await getPrisma();
  const { searchParams } = new URL(request.url);
  const { page, limit, skip } = parsePagination(searchParams, 50, 200);

  const worldCode = normalizeWorldFilterParam(searchParams.get("world"));
  const filter = searchParams.get("filter")?.trim().toLowerCase();
  const status = searchParams.get("status")?.trim().toUpperCase() as ServerStatus | undefined;
  const q = searchParams.get("q")?.trim();

  const where: Prisma.ServerWhereInput = {};
  if (worldCode) {
    where.world = { worldCode };
  }
  if (status && ["ACTIVE", "FULL", "CLOSED", "UNKNOWN"].includes(status)) {
    where.serverStatus = status;
  } else {
    where.serverStatus = { not: "CLOSED" };
  }

  if (filter === "active_events") {
    where.detections = { some: { status: { in: ["ACTIVE", "UPCOMING"] } } };
  } else if (filter === "no_events") {
    where.detections = { none: { status: { in: ["ACTIVE", "UPCOMING"] } } };
  } else if (filter === "verified_events") {
    where.detections = { some: { status: { in: ["ACTIVE", "UPCOMING"] }, verificationStatus: "VERIFIED" } };
  } else if (filter === "recently_discovered") {
    where.firstDiscovered = { gte: new Date(Date.now() - 60 * 60 * 1000) };
  }

  if (q) {
    where.OR = [
      { jobId: { contains: q, mode: "insensitive" } },
      { placeId: { contains: q, mode: "insensitive" } },
      { world: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  const orderBy: Prisma.ServerOrderByWithRelationInput[] =
    filter === "recently_discovered"
      ? [{ firstDiscovered: "desc" }]
      : [{ lastChecked: "desc" }, { playerCount: "desc" }];

  const [total, servers] = await Promise.all([
    prisma.server.count({ where }),
    prisma.server.findMany({
      where,
      include: {
        world: true,
        detections: {
          where: { status: { in: ["ACTIVE", "UPCOMING"] } },
          include: { event: { include: { category: true } }, source: true },
          orderBy: { expiresAt: "asc" },
        },
        _count: { select: { scans: true, detections: true, history: true } },
      },
      orderBy,
      skip,
      take: limit,
    }),
  ]);

  return jsonOk(
    {
      data: servers,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      serverTimeMs: Date.now(),
    },
    200,
    guard.headers
  );
}
