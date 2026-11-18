import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { applyApiGuard, jsonError, jsonOk, parseValidatedBody } from "@/lib/api-utils";
import { requireAdmin } from "@/lib/auth";

const updateProviderSchema = z.object({
  id: z.string().min(1),
  isEnabled: z.boolean().optional(),
  trustWeight: z.number().min(0).max(1).optional(),
  configJson: z.string().nullable().optional(),
});

export async function GET(request: Request) {
  const guard = await applyApiGuard(request, "admin-providers");
  if (!guard.allowed) return guard.errorResponse!;

  const admin = await requireAdmin(request);
  if (!admin) return jsonError("Admin authentication required", 403, undefined, guard.headers);

  const prisma = await getPrisma();
  const providers = await prisma.detectionSource.findMany({
    orderBy: { trustWeight: "desc" },
  });

  return jsonOk({ data: providers }, 200, guard.headers);
}

export async function PATCH(request: Request) {
  const guard = await applyApiGuard(request, "admin-providers-update", 30);
  if (!guard.allowed) return guard.errorResponse!;

  const admin = await requireAdmin(request);
  if (!admin) return jsonError("Admin authentication required", 403, undefined, guard.headers);

  const parsed = await parseValidatedBody(request, updateProviderSchema);
  if (!parsed.ok) return parsed.response;

  const prisma = await getPrisma();
  const updated = await prisma.detectionSource.update({
    where: { id: parsed.data.id },
    data: {
      isEnabled: parsed.data.isEnabled,
      trustWeight: parsed.data.trustWeight,
      configJson: parsed.data.configJson,
    },
  });

  await prisma.adminLog.create({
    data: {
      adminId: admin.id,
      adminUsername: admin.username,
      action: "UPDATE_PROVIDER",
      targetType: "DetectionSource",
      targetId: updated.id,
      detailsJson: JSON.stringify({ code: updated.code, isEnabled: updated.isEnabled }),
    },
  });

  return jsonOk({ data: updated }, 200, guard.headers);
}
