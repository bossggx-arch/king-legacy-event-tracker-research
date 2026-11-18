import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { applyApiGuard, jsonError, jsonOk, parseValidatedBody } from "@/lib/api-utils";
import { ingestDetectionCandidate } from "@/lib/scanner/providers";
import { requireAdmin, validateApiKeyFromRequest } from "@/lib/auth";

const agentIngestSchema = z.object({
  eventSlug: z.string().min(1),
  serverJobId: z.string().min(6).max(120),
  placeId: z.string().min(4).max(32),
  playerCount: z.number().int().min(0).max(50).default(1),
  durationSeconds: z.number().int().min(30).max(14400).default(900),
  evidenceUrl: z.string().url().optional(),
  evidenceMetadata: z.record(z.unknown()).optional(),
});

export async function POST(request: Request) {
  const guard = await applyApiGuard(request, "scanner-agent-ingest", 60);
  if (!guard.allowed) return guard.errorResponse!;

  const agentSecret = request.headers.get("x-agent-secret");
  const expectedSecret = process.env.AGENT_INGEST_SECRET || "kl-authorized-agent-secret-2026";
  const admin = await requireAdmin(request);
  const apiKey = await validateApiKeyFromRequest(request);

  if (agentSecret !== expectedSecret && !admin && !apiKey) {
    return jsonError("Authorized Monitoring Agent credentials required", 401, undefined, guard.headers);
  }

  const parsed = await parseValidatedBody(request, agentIngestSchema);
  if (!parsed.ok) return parsed.response;

  const prisma = await getPrisma();
  const data = parsed.data;
  const now = new Date();

  try {
    const { detection, created } = await ingestDetectionCandidate(prisma, "AUTHORIZED_AGENT", {
      eventSlug: data.eventSlug,
      serverJobId: data.serverJobId,
      placeId: data.placeId,
      status: "ACTIVE",
      verificationStatus: "VERIFIED",
      startedAt: now,
      expiresAt: new Date(now.getTime() + (data.durationSeconds ?? 900) * 1000),
      playerCountAtDetection: data.playerCount ?? 1,
      confidenceScore: 0.98,
      evidenceUrl: data.evidenceUrl ?? null,
      evidenceMetadata: {
        ingestedBy: apiKey?.name || admin?.username || "AuthorizedAgent",
        ...(data.evidenceMetadata ?? {}),
      },
      isTestData: false,
    });

    return jsonOk({ created, data: detection }, created ? 201 : 200, guard.headers);
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "Ingestion failed",
      400,
      undefined,
      guard.headers
    );
  }
}
