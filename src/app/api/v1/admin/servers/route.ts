import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { applyApiGuard, jsonError, jsonOk, parseValidatedBody } from "@/lib/api-utils";
import { requireAdmin } from "@/lib/auth";

const serverManageSchema = z.object({
  serverId: z.string().min(1),
  serverStatus: z.enum(["ACTIVE", "FULL", "CLOSED", "UNKNOWN"]).optional(),
  scanStatus: z.enum(["SCANNED", "UNSCANNED", "VERIFIED", "FAILED"]).optional(),
  verificationStatus: z.enum(["VERIFIED", "REPORTED", "ESTIMATED", "UNAVAILABLE", "UNCHECKED"]).optional(),
});

export async function PATCH(request: Request) {
  const guard = await applyApiGuard(request, "admin-servers-patch", 30);
  if (!guard.allowed) return guard.errorResponse!;

  const admin = await requireAdmin(request);
  if (!admin) return jsonError("Admin authentication required", 403, undefined, guard.headers);

  const parsed = await parseValidatedBody(request, serverManageSchema);
  if (!parsed.ok) return parsed.response;

  const prisma = await getPrisma();
  const updated = await prisma.server.update({
    where: { id: parsed.data.serverId },
    data: {
      serverStatus: parsed.data.serverStatus,
      scanStatus: parsed.data.scanStatus,
      verificationStatus: parsed.data.verificationStatus,
    },
    include: { world: true },
  });

  await prisma.adminLog.create({
    data: {
      adminId: admin.id,
      adminUsername: admin.username,
      action: "UPDATE_SERVER",
      targetType: "Server",
      targetId: updated.id,
      detailsJson: JSON.stringify(parsed.data),
    },
  });

  return jsonOk({ data: updated }, 200, guard.headers);
}

export async function DELETE(request: Request) {
  const guard = await applyApiGuard(request, "admin-servers-delete", 30);
  if (!guard.allowed) return guard.errorResponse!;

  const admin = await requireAdmin(request);
  if (!admin) return jsonError("Admin authentication required", 403, undefined, guard.headers);

  const { searchParams } = new URL(request.url);
  const serverId = searchParams.get("id");
  if (!serverId) return jsonError("Server id required", 400);

  const prisma = await getPrisma();
  await prisma.server.delete({ where: { id: serverId } });

  await prisma.adminLog.create({
    data: {
      adminId: admin.id,
      adminUsername: admin.username,
      action: "DELETE_SERVER",
      targetType: "Server",
      targetId: serverId,
    },
  });

  return jsonOk({ deleted: true, id: serverId }, 200, guard.headers);
}
