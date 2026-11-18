import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { applyApiGuard, jsonError, jsonOk, parseValidatedBody } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth";
import { detectWorldFromPlaceId } from "@/lib/scanner/world-detector";
import { ingestDetectionCandidate } from "@/lib/scanner/providers";
import { publishRealtimeEvent } from "@/lib/realtime/sse-bus";

const reportSchema = z.object({
  eventIdOrSlug: z.string().min(1),
  serverJobId: z.string().min(6).max(120),
  placeId: z.string().min(4).max(32),
  playerCount: z.number().int().min(0).max(50).optional(),
  durationMinutes: z.number().int().min(1).max(240).optional(),
  notes: z.string().max(500).optional(),
  evidenceUrl: z.string().url().optional().or(z.literal("")),
  reporterName: z.string().min(2).max(60).optional(),
});

export async function GET(request: Request) {
  const guard = await applyApiGuard(request, "events-reports-list");
  if (!guard.allowed) return guard.errorResponse!;

  const prisma = await getPrisma();
  const reports = await prisma.eventReport.findMany({
    include: {
      event: { include: { category: true } },
      world: true,
      server: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return jsonOk({ data: reports, serverTimeMs: Date.now() }, 200, guard.headers);
}

export async function POST(request: Request) {
  const guard = await applyApiGuard(request, "events-report-submit", 20);
  if (!guard.allowed) return guard.errorResponse!;

  const parsed = await parseValidatedBody(request, reportSchema);
  if (!parsed.ok) return parsed.response;

  const prisma = await getPrisma();
  const user = await getCurrentUser(request);
  const body = parsed.data;

  const worldInfo = detectWorldFromPlaceId(body.placeId);
  const world = await prisma.serverWorld.findUnique({
    where: { worldCode: worldInfo.worldCode },
  });
  if (!world) return jsonError("Unable to resolve World from Place ID", 400);

  const event = await prisma.event.findFirst({
    where: { OR: [{ id: body.eventIdOrSlug }, { slug: body.eventIdOrSlug }] },
  });
  if (!event) return jsonError("Unknown King Legacy event", 404);

  const existingServer = await prisma.server.findUnique({
    where: { jobId: body.serverJobId },
  });

  const isAdmin = user?.role === "ADMIN";
  const sourceCode = isAdmin ? "ADMIN_REPORT" : "COMMUNITY_REPORT";
  const verificationAssigned = isAdmin ? "VERIFIED" : "REPORTED";

  // Check if multiple community reports corroborate the same event + server
  const priorReportsCount = await prisma.eventReport.count({
    where: {
      eventId: event.id,
      serverJobId: body.serverJobId,
      createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) },
    },
  });

  const durationSec = body.durationMinutes
    ? body.durationMinutes * 60
    : event.activeDurationSec ?? 900;

  const { detection } = await ingestDetectionCandidate(prisma, sourceCode, {
    eventSlug: event.slug,
    serverJobId: body.serverJobId,
    placeId: body.placeId,
    status: "ACTIVE",
    verificationStatus: verificationAssigned,
    startedAt: new Date(),
    expiresAt: new Date(Date.now() + durationSec * 1000),
    playerCountAtDetection: body.playerCount ?? existingServer?.playerCount ?? 0,
    confidenceScore: isAdmin ? 0.95 : Math.min(0.85, 0.65 + priorReportsCount * 0.1),
    evidenceUrl: body.evidenceUrl || null,
    evidenceMetadata: {
      reporter: user?.username ?? body.reporterName ?? "CommunityReporter",
      notes: body.notes ?? null,
      corroborations: priorReportsCount + 1,
    },
    isTestData: false,
  });

  const report = await prisma.eventReport.create({
    data: {
      eventId: event.id,
      serverId: detection.serverId,
      serverJobId: body.serverJobId,
      worldId: world.id,
      reporterId: user?.id ?? null,
      reporterName: user?.username ?? body.reporterName ?? "CommunityHunter",
      status: isAdmin ? "APPROVED" : "PENDING",
      verificationAssigned,
      notes: body.notes ?? null,
      evidenceUrl: body.evidenceUrl || null,
      playerCount: body.playerCount ?? existingServer?.playerCount ?? null,
      reviewedById: isAdmin ? user.id : null,
      reviewedAt: isAdmin ? new Date() : null,
    },
    include: { event: true, world: true },
  });

  publishRealtimeEvent("report:created", {
    reportId: report.id,
    eventName: event.name,
    serverJobId: body.serverJobId,
    worldCode: world.worldCode,
    status: report.status,
    verificationAssigned,
  });

  return jsonOk({ data: report, detection }, 201, guard.headers);
}
