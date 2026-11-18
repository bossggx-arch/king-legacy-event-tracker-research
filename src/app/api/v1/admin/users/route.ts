import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { applyApiGuard, jsonError, jsonOk, parseValidatedBody } from "@/lib/api-utils";
import { requireAdmin, sanitizeUser } from "@/lib/auth";

const updateUserSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["USER", "MODERATOR", "ADMIN"]),
});

export async function GET(request: Request) {
  const guard = await applyApiGuard(request, "admin-users");
  if (!guard.allowed) return guard.errorResponse!;

  const admin = await requireAdmin(request);
  if (!admin) return jsonError("Admin authentication required", 403, undefined, guard.headers);

  const prisma = await getPrisma();
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return jsonOk({ data: users.map(sanitizeUser) }, 200, guard.headers);
}

export async function PATCH(request: Request) {
  const guard = await applyApiGuard(request, "admin-users-update", 30);
  if (!guard.allowed) return guard.errorResponse!;

  const admin = await requireAdmin(request);
  if (!admin) return jsonError("Admin authentication required", 403, undefined, guard.headers);

  const parsed = await parseValidatedBody(request, updateUserSchema);
  if (!parsed.ok) return parsed.response;

  const prisma = await getPrisma();
  const updated = await prisma.user.update({
    where: { id: parsed.data.userId },
    data: { role: parsed.data.role },
  });

  await prisma.adminLog.create({
    data: {
      adminId: admin.id,
      adminUsername: admin.username,
      action: "UPDATE_USER_ROLE",
      targetType: "User",
      targetId: updated.id,
      detailsJson: JSON.stringify({ username: updated.username, role: updated.role }),
    },
  });

  return jsonOk({ data: sanitizeUser(updated) }, 200, guard.headers);
}
