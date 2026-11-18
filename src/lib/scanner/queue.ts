import type { Queue, Worker } from "bullmq";
import { getPrisma } from "../prisma";
import { runFullScannerCycle, runExpiryAndStatusSweep } from "./engine";

interface QueueHealthSnapshot {
  mode: "bullmq-redis" | "embedded-worker";
  workerRunning: boolean;
  lastTickAt: string | null;
  intervalMs: number;
  jobsCompleted: number;
  jobsFailed: number;
  lastError: string | null;
}

const globalForWorker = globalThis as unknown as {
  __klScannerBooted?: boolean;
  __klScannerInterval?: ReturnType<typeof setInterval>;
  __klExpiryInterval?: ReturnType<typeof setInterval>;
  __klQueueHealth?: QueueHealthSnapshot;
  __klBullQueue?: Queue;
  __klBullWorker?: Worker;
  __klJobLock?: boolean;
};

function getHealth(): QueueHealthSnapshot {
  if (!globalForWorker.__klQueueHealth) {
    globalForWorker.__klQueueHealth = {
      mode: "embedded-worker",
      workerRunning: false,
      lastTickAt: null,
      intervalMs: Number.parseInt(process.env.SCANNER_INTERVAL_MS || "60000", 10),
      jobsCompleted: 0,
      jobsFailed: 0,
      lastError: null,
    };
  }
  return globalForWorker.__klQueueHealth;
}

export function getWorkerQueueHealth(): QueueHealthSnapshot {
  return { ...getHealth() };
}

export async function enqueueScanJob(options: { maxPagesPerSea?: number; skipDiscovery?: boolean } = {}) {
  const health = getHealth();
  if (globalForWorker.__klBullQueue) {
    await globalForWorker.__klBullQueue.add("manual-scan", options, {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 50,
      removeOnFail: 20,
    });
    return { queued: true, mode: health.mode };
  }

  // In embedded worker mode, run safely with overlap protection
  if (globalForWorker.__klJobLock) {
    return { queued: false, reason: "Scan already in progress", mode: health.mode };
  }

  globalForWorker.__klJobLock = true;
  try {
    const prisma = await getPrisma();
    const res = await runFullScannerCycle(prisma, options);
    health.lastTickAt = new Date().toISOString();
    health.jobsCompleted += 1;
    health.lastError = null;
    return { queued: true, mode: health.mode, result: res };
  } catch (err) {
    health.jobsFailed += 1;
    health.lastError = err instanceof Error ? err.message : "Scan failed";
    throw err;
  } finally {
    globalForWorker.__klJobLock = false;
  }
}

export async function ensureBackgroundScannerStarted() {
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.NODE_ENV === "test") return;
  if (process.env.SCANNER_ENABLED === "false") return;
  if (globalForWorker.__klScannerBooted) return;

  globalForWorker.__klScannerBooted = true;
  const health = getHealth();
  const intervalMs = health.intervalMs;

  // Try connecting BullMQ if Redis is explicitly enabled and reachable
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl && process.env.USE_BULLMQ_REDIS === "true") {
    try {
      const { Queue: BullQueue, Worker: BullWorker } = await import("bullmq");
      const parsed = new URL(redisUrl);
      const connection = {
        host: parsed.hostname,
        port: Number(parsed.port || 6379),
        password: parsed.password || undefined,
      };
      const queue = new BullQueue("kl-scanner-jobs", { connection });
      const worker = new BullWorker(
        "kl-scanner-jobs",
        async (job) => {
          const prisma = await getPrisma();
          if (job.name === "expiry-sweep") {
            return runExpiryAndStatusSweep(prisma);
          }
          return runFullScannerCycle(prisma, (job.data || {}) as { maxPagesPerSea?: number });
        },
        { connection, concurrency: 1 }
      );

      worker.on("completed", () => {
        health.jobsCompleted += 1;
        health.lastTickAt = new Date().toISOString();
      });
      worker.on("failed", (_job, err) => {
        health.jobsFailed += 1;
        health.lastError = err.message;
      });

      await queue.upsertJobScheduler(
        "kl-periodic-scan",
        { every: intervalMs },
        { name: "periodic-scan", data: { maxPagesPerSea: 2 } }
      );

      globalForWorker.__klBullQueue = queue;
      globalForWorker.__klBullWorker = worker;
      health.mode = "bullmq-redis";
      health.workerRunning = true;
      return;
    } catch (err) {
      health.lastError = err instanceof Error ? err.message : "Redis BullMQ unavailable, using embedded worker";
    }
  }

  // Embedded background scheduler with exponential retry & rate limiting
  health.mode = "embedded-worker";
  health.workerRunning = true;

  // Kick off fast expiry sweep every 15 seconds
  globalForWorker.__klExpiryInterval = setInterval(async () => {
    try {
      const prisma = await getPrisma();
      await runExpiryAndStatusSweep(prisma);
    } catch {
      // ignore transient errors in background sweep
    }
  }, 15_000);

  // Full Roblox Discovery + Provider Sweep on configured interval
  globalForWorker.__klScannerInterval = setInterval(async () => {
    if (globalForWorker.__klJobLock) return;
    globalForWorker.__klJobLock = true;
    try {
      const prisma = await getPrisma();
      await runFullScannerCycle(prisma);
      health.lastTickAt = new Date().toISOString();
      health.jobsCompleted += 1;
      health.lastError = null;
    } catch (err) {
      health.jobsFailed += 1;
      health.lastError = err instanceof Error ? err.message : "Scheduled scan failed";
    } finally {
      globalForWorker.__klJobLock = false;
    }
  }, intervalMs);
}
