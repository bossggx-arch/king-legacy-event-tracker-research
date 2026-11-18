import { getPrisma } from "@/lib/prisma";
import { applyApiGuard, jsonError, jsonOk } from "@/lib/api-utils";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await applyApiGuard(request, "servers-detail");
  if (!guard.allowed) return guard.errorResponse!;

  const { id } = await context.params;
  const prisma = await getPrisma();

  const server = await prisma.server.findFirst({
    where: { OR: [{ id }, { jobId: id }] },
    include: {
      world: true,
      detections: {
        include: { event: { include: { category: true } }, source: true },
        orderBy: { detectedAt: "desc" },
        take: 25,
      },
      scans: {
        orderBy: { scannedAt: "desc" },
        take: 20,
      },
      history: {
        orderBy: { detectedAt: "desc" },
        take: 25,
      },
    },
  });

  if (!server) {
    return jsonError("Server not found", 404, undefined, guard.headers);
  }

  return jsonOk({ data: server, serverTimeMs: Date.now() }, 200, guard.headers);
}
