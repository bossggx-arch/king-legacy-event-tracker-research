import type {
  DetectionProviderCode,
  EventStatus,
  PrismaClient,
  VerificationStatus,
} from "@prisma/client";
import { detectWorldFromPlaceId, buildRobloxJoinUrl } from "./world-detector";
import { fetchRobloxUniverseStats } from "./roblox-discovery";
import { publishRealtimeEvent } from "../realtime/sse-bus";
import { dispatchNotification } from "../notifications";
import { getCalibratedServerNowMs } from "../time-sync";

export interface DetectionCandidate {
  eventSlug: string;
  serverJobId: string;
  placeId: string;
  status: EventStatus;
  verificationStatus: VerificationStatus;
  startedAt: Date;
  expiresAt: Date | null;
  playerCountAtDetection: number;
  confidenceScore: number;
  evidenceUrl?: string | null;
  evidenceMetadata?: Record<string, unknown>;
  isTestData?: boolean;
}

export interface ProviderPollContext {
  prisma: PrismaClient;
  sourceId: string;
}

export interface IEventDetectionProvider {
  code: DetectionProviderCode;
  name: string;
  isTestProvider: boolean;
  poll(ctx: ProviderPollContext): Promise<DetectionCandidate[]>;
}

/**
 * 1. Official Public Data Source Provider
 * Uses Roblox official public API (games.roblox.com) for verified universe updates
 * and deterministic global schedules (Black Market Stock 4h timer).
 */
export const OfficialPublicDataSourceProvider: IEventDetectionProvider = {
  code: "OFFICIAL_PUBLIC",
  name: "Official Roblox Public API",
  isTestProvider: false,
  async poll({ prisma }) {
    const candidates: DetectionCandidate[] = [];
    const universe = await fetchRobloxUniverseStats();
    const firstSeaServer = await prisma.server.findFirst({
      where: { placeId: "4520749081", serverStatus: { in: ["ACTIVE", "FULL"] } },
      orderBy: { playerCount: "desc" },
    });

    if (!firstSeaServer) return candidates;

    const nowMs = getCalibratedServerNowMs();
    const now = new Date(nowMs);
    // Deterministic 4-hour global Black Market Fruit Stock rotation window
    const cycleMs = 4 * 60 * 60 * 1000;
    const cycleStartMs = Math.floor(nowMs / cycleMs) * cycleMs;
    const cycleEndMs = cycleStartMs + cycleMs;

    const existingStock = await prisma.eventDetection.findFirst({
      where: { event: { slug: "black-market-fruit-stock" }, status: "ACTIVE" },
      include: { server: true },
      orderBy: { detectedAt: "desc" },
    });
    const stockServer = existingStock?.server ?? firstSeaServer;

    candidates.push({
      eventSlug: "black-market-fruit-stock",
      serverJobId: stockServer.jobId,
      placeId: stockServer.placeId,
      status: "ACTIVE",
      verificationStatus: "ESTIMATED",
      startedAt: new Date(cycleStartMs),
      expiresAt: new Date(cycleEndMs),
      playerCountAtDetection: stockServer.playerCount,
      confidenceScore: 0.78,
      evidenceUrl: `https://www.roblox.com/games/4520749081/King-Legacy`,
      evidenceMetadata: {
        provider: "OFFICIAL_PUBLIC",
        universeId: "1451439645",
        universePlaying: universe?.playing ?? null,
        scheduleType: "4h-deterministic-rotation",
      },
      isTestData: false,
    });

    if (universe) {
      const existingUpdate = await prisma.eventDetection.findFirst({
        where: { event: { slug: "king-legacy-universe-update" }, status: "ACTIVE" },
        include: { server: true },
        orderBy: { detectedAt: "desc" },
      });
      const updateServer = existingUpdate?.server ?? firstSeaServer;

      candidates.push({
        eventSlug: "king-legacy-universe-update",
        serverJobId: updateServer.jobId,
        placeId: updateServer.placeId,
        status: "ACTIVE",
        verificationStatus: "VERIFIED",
        startedAt: new Date(universe.updated),
        expiresAt: existingUpdate?.expiresAt ?? new Date(nowMs + 60 * 60 * 1000),
        playerCountAtDetection: updateServer.playerCount,
        confidenceScore: 1.0,
        evidenceUrl: `https://games.roblox.com/v1/games?universeIds=1451439645`,
        evidenceMetadata: {
          provider: "OFFICIAL_PUBLIC",
          universeId: universe.id,
          universeName: universe.name,
          liveConcurrentPlayers: universe.playing,
          visits: universe.visits,
          lastUniverseUpdated: universe.updated,
        },
        isTestData: false,
      });
    }

    return candidates;
  },
};

/**
 * 2. External API Integration Provider
 * Adapter that reads an optional JSON feed URL configured in DetectionSources.configJson.
 */
export const ExternalApiIntegrationProvider: IEventDetectionProvider = {
  code: "EXTERNAL_API",
  name: "External API Partner Feed",
  isTestProvider: false,
  async poll({ prisma, sourceId }) {
    const source = await prisma.detectionSource.findUnique({ where: { id: sourceId } });
    if (!source?.configJson) return [];
    try {
      const cfg = JSON.parse(source.configJson) as { feedUrl?: string; apiKey?: string };
      if (!cfg.feedUrl) return [];
      const res = await fetch(cfg.feedUrl, {
        headers: cfg.apiKey ? { "X-API-Key": cfg.apiKey } : undefined,
        cache: "no-store",
      });
      if (!res.ok) return [];
      const items = (await res.json()) as Array<{
        eventSlug: string;
        serverJobId: string;
        placeId: string;
        expiresAt?: string;
        playerCount?: number;
        evidenceUrl?: string;
      }>;
      return (Array.isArray(items) ? items : []).map((item) => ({
        eventSlug: item.eventSlug,
        serverJobId: item.serverJobId,
        placeId: String(item.placeId),
        status: "ACTIVE",
        verificationStatus: "REPORTED",
        startedAt: new Date(),
        expiresAt: item.expiresAt ? new Date(item.expiresAt) : new Date(Date.now() + 15 * 60 * 1000),
        playerCountAtDetection: item.playerCount ?? 0,
        confidenceScore: 0.72,
        evidenceUrl: item.evidenceUrl ?? cfg.feedUrl,
        evidenceMetadata: { provider: "EXTERNAL_API", feedUrl: cfg.feedUrl },
        isTestData: false,
      }));
    } catch {
      return [];
    }
  },
};

/**
 * 3. Test / Simulation Provider (Explicitly Labeled)
 * Attaches clearly labeled test/estimated detections onto REAL discovered Roblox servers
 * when enabled, so dashboards, countdowns, and QA flows operate end-to-end without
 * falsely claiming unauthorized live in-game telemetry.
 */
export const TestSimulationProvider: IEventDetectionProvider = {
  code: "TEST_PROVIDER",
  name: "Test Detection Provider (Labeled Simulation)",
  isTestProvider: true,
  async poll({ prisma }) {
    const activeCount = await prisma.eventDetection.count({
      where: { status: { in: ["ACTIVE", "UPCOMING"] }, isTestData: true },
    });
    // Only top up if fewer than 12 active/upcoming labeled test detections exist
    if (activeCount >= 12) return [];

    const servers = await prisma.server.findMany({
      where: { serverStatus: { in: ["ACTIVE", "FULL"] } },
      include: { world: true },
      orderBy: { lastChecked: "desc" },
      take: 30,
    });
    if (servers.length === 0) return [];

    const events = await prisma.event.findMany({
      include: { world: true },
    });

    const candidates: DetectionCandidate[] = [];
    const now = getCalibratedServerNowMs();

    let idx = 0;
    for (const evt of events) {
      if (evt.eventType === "UPDATE_EVENT" || evt.eventType === "SHOP_STOCK") continue;
      const matchingServer =
        servers.find((s) => s.worldId === evt.worldId && !candidates.some((c) => c.serverJobId === s.jobId && c.eventSlug === evt.slug)) ||
        servers.find((s) => s.worldId === evt.worldId);

      if (!matchingServer) continue;

      const isUpcoming = idx % 7 === 6;
      const durSec = evt.activeDurationSec ?? 900;
      const elapsedSec = isUpcoming ? 0 : Math.min(Math.floor(durSec * 0.4), (idx % 5) * 90 + 30);
      const startOffsetMs = isUpcoming ? 3 * 60 * 1000 : -elapsedSec * 1000;
      const startedAt = new Date(now + startOffsetMs);
      const expiresAt = new Date(startedAt.getTime() + durSec * 1000);

      candidates.push({
        eventSlug: evt.slug,
        serverJobId: matchingServer.jobId,
        placeId: matchingServer.placeId,
        status: isUpcoming ? "UPCOMING" : "ACTIVE",
        verificationStatus: "ESTIMATED",
        startedAt,
        expiresAt,
        playerCountAtDetection: matchingServer.playerCount,
        confidenceScore: 0.45,
        evidenceMetadata: {
          provider: "TEST_PROVIDER",
          note: "Explicitly labeled test/simulation detection attached to a real discovered Roblox server",
        },
        isTestData: true,
      });

      idx += 1;
      if (candidates.length >= 16) break;
    }

    return candidates;
  },
};

export const REGISTERED_PROVIDERS: IEventDetectionProvider[] = [
  OfficialPublicDataSourceProvider,
  ExternalApiIntegrationProvider,
  TestSimulationProvider,
];

/**
 * Ingests and deduplicates a detection candidate into PostgreSQL, updates server/event status,
 * archives into EventHistory, dispatches notifications, and broadcasts via SSE.
 */
export async function ingestDetectionCandidate(
  prisma: PrismaClient,
  sourceCode: DetectionProviderCode,
  candidate: DetectionCandidate
) {
  const worldDetected = detectWorldFromPlaceId(candidate.placeId);
  const world = await prisma.serverWorld.findFirst({
    where: { worldCode: worldDetected.worldCode },
  });
  if (!world) {
    throw new Error(`Unsupported Place ID / World: ${candidate.placeId}`);
  }

  const event = await prisma.event.findUnique({
    where: { slug: candidate.eventSlug },
    include: { category: true },
  });
  if (!event) {
    throw new Error(`Unknown King Legacy event slug: ${candidate.eventSlug}`);
  }

  const source = await prisma.detectionSource.findUnique({
    where: { code: sourceCode },
  });
  if (!source) {
    throw new Error(`DetectionSource not registered: ${sourceCode}`);
  }

  // Ensure server record exists and binds to Job ID + Place ID
  let server = await prisma.server.findUnique({
    where: { jobId: candidate.serverJobId },
  });

  if (!server) {
    server = await prisma.server.create({
      data: {
        jobId: candidate.serverJobId,
        placeId: candidate.placeId,
        worldId: world.id,
        playerCount: candidate.playerCountAtDetection,
        maxPlayers: 12,
        serverStatus: candidate.playerCountAtDetection >= 12 ? "FULL" : "ACTIVE",
        scanStatus: candidate.verificationStatus === "VERIFIED" ? "VERIFIED" : "SCANNED",
        verificationStatus: candidate.verificationStatus,
        joinUrl: buildRobloxJoinUrl(candidate.placeId, candidate.serverJobId),
      },
    });
  } else {
    const nextScanStatus =
      candidate.verificationStatus === "VERIFIED"
        ? "VERIFIED"
        : server.scanStatus === "UNSCANNED"
        ? "SCANNED"
        : server.scanStatus;

    server = await prisma.server.update({
      where: { id: server.id },
      data: {
        scanStatus: nextScanStatus,
        verificationStatus:
          server.verificationStatus === "VERIFIED"
            ? "VERIFIED"
            : candidate.verificationStatus,
        lastChecked: new Date(),
      },
    });
  }

  // Deduplication: check if active/upcoming detection already exists for same event + server
  const existingActive = await prisma.eventDetection.findFirst({
    where: {
      eventId: event.id,
      serverId: server.id,
      status: { in: ["ACTIVE", "UPCOMING"] },
    },
    orderBy: { detectedAt: "desc" },
  });

  if (existingActive) {
    const shouldUpgrade =
      existingActive.verificationStatus !== "VERIFIED" &&
      candidate.verificationStatus === "VERIFIED";

    const updated = await prisma.eventDetection.update({
      where: { id: existingActive.id },
      data: {
        status: candidate.status,
        verificationStatus: shouldUpgrade
          ? "VERIFIED"
          : existingActive.verificationStatus,
        expiresAt:
          !existingActive.expiresAt || shouldUpgrade
            ? candidate.expiresAt ?? existingActive.expiresAt
            : existingActive.expiresAt,
        playerCountAtDetection: candidate.playerCountAtDetection,
        confidenceScore: Math.max(existingActive.confidenceScore, candidate.confidenceScore),
        evidenceMetadata: candidate.evidenceMetadata
          ? JSON.stringify(candidate.evidenceMetadata)
          : existingActive.evidenceMetadata,
      },
    });

    publishRealtimeEvent("event:updated", {
      detectionId: updated.id,
      eventId: event.id,
      eventName: event.name,
      serverJobId: server.jobId,
      worldCode: world.worldCode,
      status: updated.status,
      verificationStatus: updated.verificationStatus,
      expiresAt: updated.expiresAt?.toISOString() ?? null,
    });

    return { detection: updated, created: false };
  }

  const now = new Date();
  const detection = await prisma.eventDetection.create({
    data: {
      eventId: event.id,
      serverId: server.id,
      worldId: world.id,
      sourceId: source.id,
      status: candidate.status,
      verificationStatus: candidate.verificationStatus,
      detectedAt: now,
      startedAt: candidate.startedAt,
      expiresAt: candidate.expiresAt,
      playerCountAtDetection: candidate.playerCountAtDetection,
      confidenceScore: candidate.confidenceScore,
      evidenceUrl: candidate.evidenceUrl ?? null,
      evidenceMetadata: candidate.evidenceMetadata
        ? JSON.stringify(candidate.evidenceMetadata)
        : null,
      isDuplicate: false,
      isTestData: Boolean(candidate.isTestData || source.isTestProvider),
    },
  });

  await prisma.detectionSource.update({
    where: { id: source.id },
    data: {
      totalDetections: { increment: 1 },
      lastPolledAt: now,
    },
  });

  await prisma.event.update({
    where: { id: event.id },
    data: {
      lastSeen: now,
      detectionTime: now,
      currentStatus: candidate.status,
      verificationStatus:
        event.verificationStatus === "VERIFIED" ? "VERIFIED" : candidate.verificationStatus,
      detectionSource: source.name,
      confidenceLevel: Math.max(event.confidenceLevel, candidate.confidenceScore),
      nextEstimatedSpawn: event.spawnIntervalSec
        ? new Date(now.getTime() + event.spawnIntervalSec * 1000)
        : event.nextEstimatedSpawn,
    },
  });

  await prisma.eventHistory.create({
    data: {
      eventId: event.id,
      serverId: server.id,
      worldId: world.id,
      serverJobId: server.jobId,
      eventName: event.name,
      eventCategory: event.category.name,
      worldName: world.name,
      status: candidate.status,
      verificationStatus: candidate.verificationStatus,
      detectionSource: source.name,
      playerCount: candidate.playerCountAtDetection,
      detectedAt: now,
      archivalNotes: candidate.isTestData ? "TEST_PROVIDER labeled detection" : undefined,
    },
  });

  publishRealtimeEvent("event:detected", {
    detectionId: detection.id,
    eventId: event.id,
    eventName: event.name,
    categorySlug: event.category.slug,
    serverId: server.id,
    serverJobId: server.jobId,
    worldCode: world.worldCode,
    worldName: world.name,
    status: detection.status,
    verificationStatus: detection.verificationStatus,
    expiresAt: detection.expiresAt?.toISOString() ?? null,
    isTestData: detection.isTestData,
  });

  if (!detection.isTestData) {
    const notifType =
      event.eventType === "BOSS"
        ? "BOSS_SPAWN"
        : event.eventType === "SEA_EVENT"
        ? "SEA_EVENT"
        : candidate.status === "UPCOMING"
        ? "UPCOMING_EVENT"
        : "NEW_EVENT";

    await dispatchNotification({
      title: `${event.name} detected in ${world.name}`,
      message: `Server ${server.jobId.slice(0, 8)}... (${candidate.playerCountAtDetection}/${server.maxPlayers} players) • Status: ${candidate.verificationStatus}`,
      notificationType: notifType,
      worldCode: world.worldCode,
      categorySlug: event.category.slug,
      eventId: event.id,
      serverId: server.id,
      detectionId: detection.id,
    });
  }

  return { detection, created: true };
}
