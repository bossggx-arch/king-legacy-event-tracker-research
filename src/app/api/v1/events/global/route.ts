import { getPrisma } from "@/lib/prisma";
import { applyApiGuard, jsonOk, parsePagination } from "@/lib/api-utils";
import { normalizeWorldFilterParam } from "@/lib/scanner/world-detector";
import type { EventStatus, Prisma, VerificationStatus } from "@prisma/client";

export async function GET(request: Request) {
  const guard = await applyApiGuard(request, "events-global");
  if (!guard.allowed) return guard.errorResponse!;

  const prisma = await getPrisma();
  const { searchParams } = new URL(request.url);
  const { page, limit, skip } = parsePagination(searchParams, 80, 200);

  const category = searchParams.get("category")?.trim();
  const worldCode = normalizeWorldFilterParam(searchParams.get("world"));
  const status = searchParams.get("status")?.trim().toUpperCase() as EventStatus | undefined;
  const verification = searchParams.get("verification")?.trim().toUpperCase() as VerificationStatus | undefined;
  const sort = searchParams.get("sort")?.trim().toLowerCase() || "ending_soonest";
  const q = searchParams.get("q")?.trim();
  const serverIdQuery = searchParams.get("serverId")?.trim();
  const includeEnded = searchParams.get("includeEnded") === "true";

  const where: Prisma.EventDetectionWhereInput = {};
  if (!includeEnded && !status) {
    where.status = { in: ["ACTIVE", "UPCOMING"] };
  } else if (status && ["ACTIVE", "UPCOMING", "ENDED", "UNKNOWN"].includes(status)) {
    where.status = status;
  }

  if (category && category !== "all") {
    where.event = { category: { slug: category } };
  }
  if (worldCode) {
    where.world = { worldCode };
  }
  if (
    verification &&
    ["VERIFIED", "REPORTED", "ESTIMATED", "UNAVAILABLE", "UNCHECKED"].includes(verification)
  ) {
    where.verificationStatus = verification;
  }
  if (q) {
    where.AND = [
      {
        OR: [
          { event: { name: { contains: q, mode: "insensitive" } } },
          { event: { description: { contains: q, mode: "insensitive" } } },
          { event: { spawnLocation: { contains: q, mode: "insensitive" } } },
          { server: { jobId: { contains: q, mode: "insensitive" } } },
        ],
      },
    ];
  }
  if (serverIdQuery) {
    where.server = {
      OR: [
        { jobId: { contains: serverIdQuery, mode: "insensitive" } },
        { id: { contains: serverIdQuery, mode: "insensitive" } },
      ],
    };
  }

  let orderBy: Prisma.EventDetectionOrderByWithRelationInput[] = [
    { expiresAt: "asc" },
    { detectedAt: "desc" },
  ];
  if (sort === "just_found") {
    orderBy = [{ detectedAt: "desc" }];
  } else if (sort === "most_recent") {
    orderBy = [{ lastUpdated: "desc" }];
  } else if (sort === "most_active") {
    orderBy = [{ server: { playerCount: "desc" } }, { expiresAt: "asc" }];
  }

  const [total, detections] = await Promise.all([
    prisma.eventDetection.count({ where }),
    prisma.eventDetection.findMany({
      where,
      include: {
        event: { include: { category: true } },
        server: true,
        world: true,
        source: true,
      },
      orderBy,
      skip,
      take: limit,
    }),
  ]);

  return jsonOk(
    {
      data: detections,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      serverTimeMs: Date.now(),
    },
    200,
    guard.headers
  );
}
