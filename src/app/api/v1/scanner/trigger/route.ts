import { applyApiGuard, jsonError, jsonOk } from "@/lib/api-utils";
import { enqueueScanJob } from "@/lib/scanner/queue";

export async function POST(request: Request) {
  const guard = await applyApiGuard(request, "scanner-trigger", 10);
  if (!guard.allowed) return guard.errorResponse!;

  try {
    const body = await request.json().catch(() => ({}));
    const maxPagesPerSea =
      typeof body?.maxPagesPerSea === "number"
        ? Math.min(3, Math.max(1, body.maxPagesPerSea))
        : 2;

    const result = await enqueueScanJob({ maxPagesPerSea });
    return jsonOk({ ok: true, ...result, serverTimeMs: Date.now() }, 200, guard.headers);
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "Failed to trigger scan",
      500,
      undefined,
      guard.headers
    );
  }
}
