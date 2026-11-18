import { getPrisma } from "../lib/prisma";
import { runFullScannerCycle, runExpiryAndStatusSweep } from "../lib/scanner/engine";
import { ensureBackgroundScannerStarted } from "../lib/scanner/queue";

async function main() {
  console.log("[KingLegacyWorker] Starting background scanner worker...");
  const prisma = await getPrisma();
  await ensureBackgroundScannerStarted();

  // Keep running periodic sweeps if BullMQ wasn't attached separately
  if (process.env.USE_BULLMQ_REDIS !== "true") {
    const intervalMs = Number.parseInt(process.env.SCANNER_INTERVAL_MS || "60000", 10);
    await runFullScannerCycle(prisma);
    setInterval(async () => {
      try {
        await runExpiryAndStatusSweep(prisma);
        await runFullScannerCycle(prisma);
      } catch (err) {
        console.error("[KingLegacyWorker] Cycle error:", err);
      }
    }, intervalMs);
  }
}

main().catch((err) => {
  console.error("[KingLegacyWorker] Fatal startup error:", err);
  process.exit(1);
});
