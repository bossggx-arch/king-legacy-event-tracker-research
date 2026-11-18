import { getPrisma } from "@/lib/prisma";
import { applyApiGuard, jsonError, jsonOk } from "@/lib/api-utils";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await applyApiGuard(request, "servers-events");
  if (!guard.allowed) return guard.errorResponse!;

  const { id } = await context.params;
  const prisma = await getPrisma();

  const server = await prisma.server.findFirst({
    where: { OR: [{ id }, { jobId: id }] },
    include: { world: true },
  });

  if (!server) {
    return jsonError("Server not found", 404, undefined, guard.headers);
  }

  const detections = await prisma.eventDetection.findMany({
    where: { serverId: server.id },
    include: {
      event: { include: { category: true } },
      source: true,
      world: true,
    },
    orderBy: { detectedAt: "desc" },
  });

  return jsonOk(
    { server, data: detections, count: detections.length, serverTimeMs: Date.now() },
    200,
    guard.headers
  );
}
