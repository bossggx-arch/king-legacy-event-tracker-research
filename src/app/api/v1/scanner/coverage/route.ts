import { getPrisma } from "@/lib/prisma";
import { applyApiGuard, jsonOk } from "@/lib/api-utils";
import { getScannerCoverageReport } from "@/lib/scanner/engine";

export async function GET(request: Request) {
  const guard = await applyApiGuard(request, "scanner-coverage");
  if (!guard.allowed) return guard.errorResponse!;

  const prisma = await getPrisma();
  const coverage = await getScannerCoverageReport(prisma);

  return jsonOk({ data: coverage, serverTimeMs: Date.now() }, 200, guard.headers);
}
