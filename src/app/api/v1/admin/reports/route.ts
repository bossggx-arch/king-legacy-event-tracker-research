import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { applyApiGuard, jsonError, jsonOk, parseValidatedBody } from "@/lib/api-utils";
import { requireAdmin } from "@/lib/auth";
import { publishRealtimeEvent } from "@/lib/realtime/sse-bus";

const moderateReportSchema = z.object({
  reportId: z.string().min(1),
  action: z.enum(["APPROVE", "REJECT"]),
  notes: z.string().max(300).optional(),
});

export async function GET(request: Request) {
  const guard = await applyApiGuard(request, "admin-reports");
  if (!guard.allowed) return guard.errorResponse!;

  const admin = await requireAdmin(request);
  if (!admin) return jsonError("Admin authentication required", 403, undefined, guard.headers);

  const prisma = await getPrisma();
  const reports = await prisma.eventReport.findMany({
    include: {
      event: { include: { category: true } },
      world: true,
      server: true,
      reporter: { select: { id: true, username: true, email: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
  });

  return jsonOk({ data: reports }, 200, guard.headers);
}

export async function PATCH(request: Request) {
  const guard = await applyApiGuard(request, "admin-reports-moderate", 60);
  if (!guard.allowed) return guard.errorResponse!;

  const admin = await requireAdmin(request);
  if (!admin) return jsonError("Admin authentication required", 403, undefined, guard.headers);

  const parsed = await parseValidatedBody(request, moderateReportSchema);
  if (!parsed.ok) return parsed.response;

  const prisma = await getPrisma();
  const { reportId, action, notes } = parsed.data;
  const report = await prisma.eventReport.findUnique({
    where: { id: reportId },
    include: { event: true, world: true },
  });
  if (!report) return jsonError("Report not found", 404, undefined, guard.headers);

  const now = new Date();
  const nextStatus = action === "APPROVE" ? "APPROVED" : "REJECTED";
  const nextVerification = action === "APPROVE" ? "VERIFIED" : "UNAVAILABLE";

  const updatedReport = await prisma.eventReport.update({
    where: { id: reportId },
    data: {
      status: nextStatus,
      verificationAssigned: nextVerification,
      reviewedById: admin.id,
      reviewedAt: now,
      notes: notes ?? report.notes,
    },
  });

  if (report.serverId) {
    if (action === "APPROVE") {
      await prisma.eventDetection.updateMany({
        where: {
          eventId: report.eventId,
          serverId: report.serverId,
          status: { in: ["ACTIVE", "UPCOMING"] },
        },
        data: {
          verificationStatus: "VERIFIED",
          confidenceScore: 0.95,
        },
      });
      await prisma.server.update({
        where: { id: report.serverId },
        data: { scanStatus: "VERIFIED", verificationStatus: "VERIFIED" },
      });
    } else {
      await prisma.eventDetection.updateMany({
        where: {
          eventId: report.eventId,
          serverId: report.serverId,
          verificationStatus: "REPORTED",
        },
        data: {
          status: "ENDED",
          verificationStatus: "UNAVAILABLE",
          endedAt: now,
        },
      });
    }
  }

  await prisma.adminLog.create({
    data: {
      adminId: admin.id,
      adminUsername: admin.username,
      action: `REPORT_${action}`,
      targetType: "EventReport",
      targetId: report.id,
      detailsJson: JSON.stringify({ eventName: report.event.name, serverJobId: report.serverJobId }),
    },
  });

  publishRealtimeEvent("report:reviewed", {
    reportId: report.id,
    action,
    serverJobId: report.serverJobId,
    verificationAssigned: nextVerification,
  });

  return jsonOk({ data: updatedReport }, 200, guard.headers);
}
