import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { applyApiGuard, jsonError, jsonOk, parseValidatedBody } from "@/lib/api-utils";
import { requireAdmin } from "@/lib/auth";

const updateEventSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().min(5).max(1000).optional(),
  imageUrl: z.string().min(1).optional(),
  spawnLocation: z.string().min(2).max(200).optional(),
  spawnIntervalSec: z.number().int().positive().nullable().optional(),
  activeDurationSec: z.number().int().positive().nullable().optional(),
  rewards: z.string().max(500).nullable().optional(),
  spawnConditions: z.string().max(500).nullable().optional(),
  currentStatus: z.enum(["ACTIVE", "UPCOMING", "ENDED", "UNKNOWN"]).optional(),
  verificationStatus: z.enum(["VERIFIED", "REPORTED", "ESTIMATED", "UNAVAILABLE", "UNCHECKED"]).optional(),
  categorySlug: z.string().optional(),
  worldCode: z.enum(["FIRST_SEA", "SECOND_SEA", "THIRD_SEA", "UNKNOWN"]).optional(),
});

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await applyApiGuard(request, "events-detail");
  if (!guard.allowed) return guard.errorResponse!;

  const { id } = await context.params;
  const prisma = await getPrisma();

  const event = await prisma.event.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    include: {
      category: true,
      world: true,
      detections: {
        include: { server: true, source: true, world: true },
        orderBy: { detectedAt: "desc" },
        take: 25,
      },
      history: {
        orderBy: { detectedAt: "desc" },
        take: 20,
      },
    },
  });

  if (!event) {
    return jsonError("Event not found", 404, undefined, guard.headers);
  }

  return jsonOk({ data: event, serverTimeMs: Date.now() }, 200, guard.headers);
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await applyApiGuard(request, "events-write", 60);
  if (!guard.allowed) return guard.errorResponse!;

  const admin = await requireAdmin(request);
  if (!admin) return jsonError("Admin authentication required", 403, undefined, guard.headers);

  const parsed = await parseValidatedBody(request, updateEventSchema);
  if (!parsed.ok) return parsed.response;

  const { id } = await context.params;
  const prisma = await getPrisma();
  const existing = await prisma.event.findFirst({
    where: { OR: [{ id }, { slug: id }] },
  });
  if (!existing) return jsonError("Event not found", 404, undefined, guard.headers);

  const { categorySlug, worldCode, ...fields } = parsed.data;
  let categoryId = existing.categoryId;
  let worldId = existing.worldId;

  if (categorySlug) {
    const cat = await prisma.eventCategory.findUnique({ where: { slug: categorySlug } });
    if (!cat) return jsonError(`Unknown category slug: ${categorySlug}`, 400);
    categoryId = cat.id;
  }
  if (worldCode) {
    const world = await prisma.serverWorld.findUnique({ where: { worldCode } });
    if (!world) return jsonError(`Unknown world code: ${worldCode}`, 400);
    worldId = world.id;
  }

  const updated = await prisma.event.update({
    where: { id: existing.id },
    data: {
      ...fields,
      categoryId,
      worldId,
    },
    include: { category: true, world: true },
  });

  await prisma.adminLog.create({
    data: {
      adminId: admin.id,
      adminUsername: admin.username,
      action: "UPDATE_EVENT",
      targetType: "Event",
      targetId: updated.id,
      detailsJson: JSON.stringify(parsed.data),
    },
  });

  return jsonOk({ data: updated }, 200, guard.headers);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await applyApiGuard(request, "events-write", 60);
  if (!guard.allowed) return guard.errorResponse!;

  const admin = await requireAdmin(request);
  if (!admin) return jsonError("Admin authentication required", 403, undefined, guard.headers);

  const { id } = await context.params;
  const prisma = await getPrisma();
  const existing = await prisma.event.findFirst({
    where: { OR: [{ id }, { slug: id }] },
  });
  if (!existing) return jsonError("Event not found", 404, undefined, guard.headers);

  await prisma.event.delete({ where: { id: existing.id } });

  await prisma.adminLog.create({
    data: {
      adminId: admin.id,
      adminUsername: admin.username,
      action: "DELETE_EVENT",
      targetType: "Event",
      targetId: existing.id,
      detailsJson: JSON.stringify({ slug: existing.slug, name: existing.name }),
    },
  });

  return jsonOk({ deleted: true, id: existing.id }, 200, guard.headers);
}
