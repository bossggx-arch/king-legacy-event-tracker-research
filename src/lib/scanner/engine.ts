import type { PrismaClient } from "@prisma/client";
import { runRobloxServerDiscovery } from "./roblox-discovery";
import {
  REGISTERED_PROVIDERS,
  ingestDetectionCandidate,
} from "./providers";
import { publishRealtimeEvent } from "../realtime/sse-bus";
import { dispatchNotification } from "../notifications";

export interface CoverageReport {
  totalDiscoveredServers: number;
  activeServers: number;
  fullServers: number;
  closedServers: number;
  scannedServers: number;
  verifiedServers: number;
  unscannedServers: number;
  serversWithEvents: number;
  totalActiveEvents: number;
  totalUpcomingEvents: number;
  firstSeaServers: number;
  secondSeaServers: number;
  thirdSeaServers: number;
  coveragePercent: number;
  allServersScanned: boolean;
  lastScanTime: string | null;
  currentScanStatus: string;
  transparencyNotice: string;
}

export async function runExpiryAndStatusSweep(prisma: PrismaClient) {
  const now = new Date();

  // 1. Transition UPCOMING -> ACTIVE when startedAt <= now
  const toActivate = await prisma.eventDetection.findMany({
    where: {
      status: "UPCOMING",
      startedAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    include: { event: { include: { category: true } }, server: true, world: true },
  });

  for (const det of toActivate) {
    await prisma.eventDetection.update({
      where: { id: det.id },
      data: { status: "ACTIVE" },
    });
    publishRealtimeEvent("event:updated", {
      detectionId: det.id,
      eventId: det.eventId,
      eventName: det.event.name,
      serverJobId: det.server.jobId,
      worldCode: det.world.worldCode,
      status: "ACTIVE",
      verificationStatus: det.verificationStatus,
      expiresAt: det.expiresAt?.toISOString() ?? null,
    });
  }

  // 2. Transition ACTIVE / UPCOMING -> ENDED when expiresAt <= now
  const expired = await prisma.eventDetection.findMany({
    where: {
      status: { in: ["ACTIVE", "UPCOMING"] },
      expiresAt: { lte: now },
    },
    include: { event: true, server: true, world: true },
  });

  if (expired.length > 0) {
    await prisma.eventDetection.updateMany({
      where: { id: { in: expired.map((d) => d.id) } },
      data: { status: "ENDED", endedAt: now },
    });

    for (const det of expired) {
      await prisma.eventHistory.updateMany({
        where: {
          eventId: det.eventId,
          serverJobId: det.server.jobId,
          endedAt: null,
        },
        data: { status: "ENDED", endedAt: now },
      });

      publishRealtimeEvent("event:expired", {
        detectionId: det.id,
        eventId: det.eventId,
        eventName: det.event.name,
        serverJobId: det.server.jobId,
        worldCode: det.world.worldCode,
        status: "ENDED",
      });
    }
  }

  // 3. Emit ending-soon notification for active real detections expiring within 2 minutes
  const soonWindow = new Date(now.getTime() + 2 * 60 * 1000);
  const endingSoon = await prisma.eventDetection.findMany({
    where: {
      status: "ACTIVE",
      isTestData: false,
      expiresAt: { gt: now, lte: soonWindow },
    },
    include: { event: { include: { category: true } }, server: true, world: true },
    take: 5,
  });

  for (const det of endingSoon) {
    const recentAlert = await prisma.notification.findFirst({
      where: {
        detectionId: det.id,
        notificationType: "ENDING_SOON",
      },
    });
    if (!recentAlert) {
      await dispatchNotification({
        title: `${det.event.name} ending soon in ${det.world.name}`,
        message: `Server ${det.server.jobId.slice(0, 8)}... despawns in under 2 minutes.`,
        notificationType: "ENDING_SOON",
        worldCode: det.world.worldCode,
        categorySlug: det.event.category.slug,
        eventId: det.eventId,
        serverId: det.serverId,
        detectionId: det.id,
      });
    }
  }

  return { activated: toActivate.length, expired: expired.length };
}

export async function runProviderPollingCycle(
  prisma: PrismaClient,
  options: { includeTestProvider?: boolean } = {}
) {
  let processed = 0;
  const enabledSources = await prisma.detectionSource.findMany({
    where: { isEnabled: true },
  });

  for (const source of enabledSources) {
    if (source.isTestProvider && options.includeTestProvider === false) {
      continue;
    }
    const adapter = REGISTERED_PROVIDERS.find((p) => p.code === source.code);
    if (!adapter) continue;

    try {
      const candidates = await adapter.poll({ prisma, sourceId: source.id });
      for (const candidate of candidates) {
        await ingestDetectionCandidate(prisma, source.code, candidate);
        processed += 1;
      }
      await prisma.detectionSource.update({
        where: { id: source.id },
        data: { lastPolledAt: new Date() },
      });
    } catch (err) {
      console.error(`[Scanner] Provider ${source.code} failed:`, err);
    }
  }

  return { detectionsProcessed: processed };
}

export async function runFullScannerCycle(
  prisma: PrismaClient,
  options: { maxPagesPerSea?: number; skipDiscovery?: boolean } = {}
) {
  const job = await prisma.scannerJob.create({
    data: {
      jobName: "Global Discovery & Detection Sweep",
      jobType: "ROBLOX_DISCOVERY",
      status: "RUNNING",
    },
  });

  publishRealtimeEvent("scanner:status", {
    jobId: job.id,
    status: "RUNNING",
    startedAt: job.startedAt.toISOString(),
  });

  const startedMs = Date.now();

  try {
    const discovery = options.skipDiscovery
      ? {
          serversDiscovered: 0,
          serversUpdated: 0,
          serversClosed: 0,
          totalFetchedFromApi: 0,
          rateLimitedCount: 0,
          universeInfo: null,
          errors: [] as string[],
          durationMs: 0,
        }
      : await runRobloxServerDiscovery(prisma, {
          maxPagesPerSea: options.maxPagesPerSea,
        });

    const expiry = await runExpiryAndStatusSweep(prisma);
    const polling = await runProviderPollingCycle(prisma);

    const finished = await prisma.scannerJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        serversDiscovered: discovery.serversDiscovered,
        serversUpdated: discovery.serversUpdated,
        serversClosed: discovery.serversClosed,
        detectionsProcessed: polling.detectionsProcessed,
        durationMs: Date.now() - startedMs,
        errorLog: discovery.errors.length > 0 ? discovery.errors.join("; ") : null,
        finishedAt: new Date(),
      },
    });

    publishRealtimeEvent("scanner:status", {
      jobId: finished.id,
      status: finished.status,
      serversDiscovered: finished.serversDiscovered,
      serversUpdated: finished.serversUpdated,
      detectionsProcessed: finished.detectionsProcessed,
      durationMs: finished.durationMs,
      finishedAt: finished.finishedAt?.toISOString() ?? null,
    });

    return {
      job: finished,
      discovery,
      expiry,
      polling,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown scanner error";
    await prisma.scannerJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        durationMs: Date.now() - startedMs,
        errorLog: msg,
        finishedAt: new Date(),
      },
    });
    publishRealtimeEvent("scanner:status", {
      jobId: job.id,
      status: "FAILED",
      errorLog: msg,
    });
    throw err;
  }
}

export async function getScannerCoverageReport(prisma: PrismaClient): Promise<CoverageReport> {
  const [
    totalDiscoveredServers,
    activeServers,
    fullServers,
    closedServers,
    scannedServers,
    verifiedServers,
    unscannedServers,
    totalActiveEvents,
    totalUpcomingEvents,
    firstSeaServers,
    secondSeaServers,
    thirdSeaServers,
    serversWithEventsRows,
    latestJob,
  ] = await Promise.all([
    prisma.server.count(),
    prisma.server.count({ where: { serverStatus: "ACTIVE" } }),
    prisma.server.count({ where: { serverStatus: "FULL" } }),
    prisma.server.count({ where: { serverStatus: "CLOSED" } }),
    prisma.server.count({ where: { scanStatus: { in: ["SCANNED", "VERIFIED"] } } }),
    prisma.server.count({ where: { scanStatus: "VERIFIED" } }),
    prisma.server.count({ where: { scanStatus: "UNSCANNED" } }),
    prisma.eventDetection.count({ where: { status: "ACTIVE" } }),
    prisma.eventDetection.count({ where: { status: "UPCOMING" } }),
    prisma.server.count({ where: { world: { worldCode: "FIRST_SEA" }, serverStatus: { not: "CLOSED" } } }),
    prisma.server.count({ where: { world: { worldCode: "SECOND_SEA" }, serverStatus: { not: "CLOSED" } } }),
    prisma.server.count({ where: { world: { worldCode: "THIRD_SEA" }, serverStatus: { not: "CLOSED" } } }),
    prisma.eventDetection.findMany({
      where: { status: { in: ["ACTIVE", "UPCOMING"] } },
      select: { serverId: true },
      distinct: ["serverId"],
    }),
    prisma.scannerJob.findFirst({ orderBy: { startedAt: "desc" } }),
  ]);

  const liveServersCount = activeServers + fullServers;
  const coveragePercent =
    totalDiscoveredServers > 0
      ? Number(((scannedServers / totalDiscoveredServers) * 100).toFixed(1))
      : 0;
  const allServersScanned =
    totalDiscoveredServers > 0 && unscannedServers === 0 && verifiedServers === totalDiscoveredServers;

  return {
    totalDiscoveredServers,
    activeServers: liveServersCount,
    fullServers,
    closedServers,
    scannedServers,
    verifiedServers,
    unscannedServers,
    serversWithEvents: serversWithEventsRows.length,
    totalActiveEvents,
    totalUpcomingEvents,
    firstSeaServers,
    secondSeaServers,
    thirdSeaServers,
    coveragePercent,
    allServersScanned,
    lastScanTime: latestJob?.finishedAt?.toISOString() ?? latestJob?.startedAt.toISOString() ?? null,
    currentScanStatus: latestJob?.status ?? "IDLE",
    transparencyNotice: allServersScanned
      ? "All discovered servers have verified telemetry coverage."
      : `Public Server Discovery via Roblox API covers ${totalDiscoveredServers} public servers (${unscannedServers} pending in-game telemetry). In-game event verification requires Authorized Monitoring Agents, Community Reports, Admin Reports, or Official Public Data.`,
  };
}
