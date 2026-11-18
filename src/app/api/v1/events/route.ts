import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { applyApiGuard, jsonError, jsonOk, parsePagination, parseValidatedBody } from "@/lib/api-utils";
import { requireAdmin } from "@/lib/auth";
import { normalizeWorldFilterParam } from "@/lib/scanner/world-detector";
import type { EventStatus, EventType, Prisma, VerificationStatus } from "@prisma/client";

const createEventSchema = z.object({
  slug: z.string().min(2).max(120).regex(/^[a-z0-9-]+$/),
  name: z.string().min(2).max(120),
  eventType: z.enum(["BOSS", "SEA_EVENT", "ISLAND_EVENT", "SPECIAL_EVENT", "LIMITED_EVENT", "SHOP_STOCK", "UPDATE_EVENT"]),
  categorySlug: z.string().min(1),
  worldCode: z.enum(["FIRST_SEA", "SECOND_SEA", "THIRD_SEA", "UNKNOWN"]),
  description: z.string().min(5).max(1000),
  imageUrl: z.string().min(1).default("/events/boss-raid.svg"),
  spawnLocation: z.string().min(2).max(200),
  spawnIntervalSec: z.number().int().positive().nullable().optional(),
  activeDurationSec: z.number().int().positive().nullable().optional(),
  rewards: z.string().max(500).optional(),
  spawnConditions: z.string().max(500).optional(),
  currentStatus: z.enum(["ACTIVE", "UPCOMING", "ENDED", "UNKNOWN"]).optional(),
  verificationStatus: z.enum(["VERIFIED", "REPORTED", "ESTIMATED", "UNAVAILABLE", "UNCHECKED"]).optional(),
});

export async function GET(request: Request) {
  const guard = await applyApiGuard(request, "events-list");
  if (!guard.allowed) return guard.errorResponse!;

  const prisma = await getPrisma();
  const { searchParams } = new URL(request.url);
  const { page, limit, skip } = parsePagination(searchParams, 50, 200);

  const category = searchParams.get("category")?.trim();
  const worldParam = normalizeWorldFilterParam(searchParams.get("world"));
  const status = searchParams.get("status")?.trim().toUpperCase() as EventStatus | undefined;
  const eventType = searchParams.get("eventType")?.trim().toUpperCase() as EventType | undefined;
  const q = searchParams.get("q")?.trim();

  const where: Prisma.EventWhereInput = {};
  if (category && category !== "all") {
    where.category = { slug: category };
  }
  if (worldParam) {
    where.world = { worldCode: worldParam };
  }
  if (status && ["ACTIVE", "UPCOMING", "ENDED", "UNKNOWN"].includes(status)) {
    where.currentStatus = status;
  }
  if (eventType && ["BOSS", "SEA_EVENT", "ISLAND_EVENT", "SPECIAL_EVENT", "LIMITED_EVENT", "SHOP_STOCK", "UPDATE_EVENT"].includes(eventType)) {
    where.eventType = eventType;
  }
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { spawnLocation: { contains: q, mode: "insensitive" } },
    ];
  }

  const [total, events] = await Promise.all([
    prisma.event.count({ where }),
    prisma.event.findMany({
      where,
      include: {
        category: true,
        world: true,
        _count: { select: { detections: true } },
      },
      orderBy: [{ currentStatus: "asc" }, { name: "asc" }],
      skip,
      take: limit,
    }),
  ]);

  return jsonOk(
    {
      data: events,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      serverTimeMs: Date.now(),
    },
    200,
    guard.headers
  );
}

export async function POST(request: Request) {
  const guard = await applyApiGuard(request, "events-write", 60);
  if (!guard.allowed) return guard.errorResponse!;

  const admin = await requireAdmin(request);
  if (!admin) {
    return jsonError("Admin authentication required", 403, undefined, guard.headers);
  }

  const parsed = await parseValidatedBody(request, createEventSchema);
  if (!parsed.ok) return parsed.response;

  const prisma = await getPrisma();
  const body = parsed.data;

  const [category, world, existingSlug] = await Promise.all([
    prisma.eventCategory.findUnique({ where: { slug: body.categorySlug } }),
    prisma.serverWorld.findUnique({ where: { worldCode: body.worldCode } }),
    prisma.event.findUnique({ where: { slug: body.slug } }),
  ]);

  if (!category) return jsonError(`Unknown category slug: ${body.categorySlug}`, 400);
  if (!world) return jsonError(`Unknown world code: ${body.worldCode}`, 400);
  if (existingSlug) return jsonError(`Event slug already exists: ${body.slug}`, 409);

  const created = await prisma.event.create({
    data: {
      slug: body.slug,
      name: body.name,
      eventType: body.eventType,
      categoryId: category.id,
      worldId: world.id,
      description: body.description,
      imageUrl: body.imageUrl ?? "/events/boss-raid.svg",
      spawnLocation: body.spawnLocation,
      spawnIntervalSec: body.spawnIntervalSec ?? null,
      activeDurationSec: body.activeDurationSec ?? null,
      rewards: body.rewards ?? null,
      spawnConditions: body.spawnConditions ?? null,
      currentStatus: (body.currentStatus ?? "UNKNOWN") as EventStatus,
      verificationStatus: (body.verificationStatus ?? "VERIFIED") as VerificationStatus,
      detectionSource: "Admin Manual Entry",
      confidenceLevel: 1.0,
    },
    include: { category: true, world: true },
  });

  await prisma.adminLog.create({
    data: {
      adminId: admin.id,
      adminUsername: admin.username,
      action: "CREATE_EVENT",
      targetType: "Event",
      targetId: created.id,
      detailsJson: JSON.stringify({ slug: created.slug, name: created.name }),
    },
  });

  return jsonOk({ data: created }, 201, guard.headers);
}
