import type { PrismaClient, ServerStatus } from "@prisma/client";
import {
  KING_LEGACY_PLACES,
  KING_LEGACY_UNIVERSE_ID,
  buildRobloxJoinUrl,
  detectWorldFromPlaceId,
} from "./world-detector";
import { publishRealtimeEvent } from "../realtime/sse-bus";
import { recordNetworkDateHeader } from "../time-sync";

export interface RobloxServerRaw {
  id: string;
  maxPlayers: number;
  playing: number;
  fps?: number;
  ping?: number;
}

export interface RobloxUniverseRaw {
  id: number;
  name: string;
  playing: number;
  visits: number;
  updated: string;
  maxPlayers: number;
}

export interface DiscoveryRunResult {
  serversDiscovered: number;
  serversUpdated: number;
  serversClosed: number;
  totalFetchedFromApi: number;
  rateLimitedCount: number;
  universeInfo: RobloxUniverseRaw | null;
  errors: string[];
  durationMs: number;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, retries = 2): Promise<Response> {
  let attempt = 0;
  let lastError: unknown;
  while (attempt <= retries) {
    try {
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "KingLegacyGlobalTracker/1.0",
        },
        cache: "no-store",
      });
      recordNetworkDateHeader(res.headers.get("date"));
      if (res.status === 429 && attempt < retries) {
        const waitMs = 1200 * (attempt + 1);
        await sleep(waitMs);
        attempt += 1;
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await sleep(600 * (attempt + 1));
      }
      attempt += 1;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Roblox API fetch failed");
}

export async function fetchRobloxUniverseStats(): Promise<RobloxUniverseRaw | null> {
  try {
    const res = await fetchWithRetry(
      `https://games.roblox.com/v1/games?universeIds=${KING_LEGACY_UNIVERSE_ID}`,
      1
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: RobloxUniverseRaw[] };
    return json.data?.[0] ?? null;
  } catch {
    return null;
  }
}

export async function fetchPublicServersForPlace(
  placeId: string,
  maxPages = 2
): Promise<{
  servers: RobloxServerRaw[];
  rateLimited: boolean;
  error?: string;
}> {
  const collected: RobloxServerRaw[] = [];
  const seenIds = new Set<string>();
  let cursor: string | null = null;
  let page = 0;
  let rateLimited = false;

  while (page < maxPages) {
    const url = new URL(`https://games.roblox.com/v1/games/${placeId}/servers/Public`);
    url.searchParams.set("sortOrder", "Desc");
    url.searchParams.set("limit", "100");
    if (cursor) url.searchParams.set("cursor", cursor);

    try {
      const res = await fetchWithRetry(url.toString(), 2);
      if (res.status === 429) {
        rateLimited = true;
        break;
      }
      if (!res.ok) {
        return {
          servers: collected,
          rateLimited,
          error: `Roblox API returned HTTP ${res.status} for place ${placeId}`,
        };
      }

      const body = (await res.json()) as {
        nextPageCursor?: string | null;
        data?: RobloxServerRaw[];
      };

      for (const srv of body.data ?? []) {
        if (srv.id && !seenIds.has(srv.id)) {
          seenIds.add(srv.id);
          collected.push(srv);
        }
      }

      if (!body.nextPageCursor) break;
      cursor = body.nextPageCursor;
      page += 1;

      // Respectful rate limiting between paginated requests
      if (page < maxPages) {
        await sleep(350);
      }
    } catch (err) {
      return {
        servers: collected,
        rateLimited,
        error: err instanceof Error ? err.message : `Failed fetching place ${placeId}`,
      };
    }
  }

  return { servers: collected, rateLimited };
}

export async function runRobloxServerDiscovery(
  prisma: PrismaClient,
  options: { maxPagesPerSea?: number; staleThresholdMinutes?: number } = {}
): Promise<DiscoveryRunResult> {
  const startedAt = Date.now();
  const maxPages =
    options.maxPagesPerSea ??
    Number.parseInt(process.env.ROBLOX_API_MAX_PAGES_PER_SEA || "2", 10);
  const staleThresholdMinutes = options.staleThresholdMinutes ?? 20;

  let serversDiscovered = 0;
  let serversUpdated = 0;
  let serversClosed = 0;
  let totalFetchedFromApi = 0;
  let rateLimitedCount = 0;
  const errors: string[] = [];

  const universeInfo = await fetchRobloxUniverseStats();
  const worlds = await prisma.serverWorld.findMany();
  const worldByCode = new Map(worlds.map((w) => [w.worldCode, w]));

  const placeIds = Object.keys(KING_LEGACY_PLACES);
  const seenJobIdsThisRun = new Set<string>();

  for (const placeId of placeIds) {
    const worldMeta = detectWorldFromPlaceId(placeId);
    const worldRow = worldByCode.get(worldMeta.worldCode);
    if (!worldRow) continue;

    const result = await fetchPublicServersForPlace(placeId, maxPages);
    if (result.rateLimited) rateLimitedCount += 1;
    if (result.error) errors.push(result.error);

    totalFetchedFromApi += result.servers.length;

    const existingForPlace = await prisma.server.findMany({
      where: { placeId },
      select: { id: true, jobId: true, serverStatus: true, playerCount: true },
    });
    const existingMap = new Map(existingForPlace.map((s) => [s.jobId, s]));

    const now = new Date();
    for (const raw of result.servers) {
      if (seenJobIdsThisRun.has(raw.id)) continue;
      seenJobIdsThisRun.add(raw.id);

      const maxPlayers = Math.max(1, raw.maxPlayers || 12);
      const playerCount = Math.max(0, raw.playing ?? 0);
      const serverStatus: ServerStatus = playerCount >= maxPlayers ? "FULL" : "ACTIVE";
      const joinUrl = buildRobloxJoinUrl(placeId, raw.id);
      const existing = existingMap.get(raw.id);

      if (!existing) {
        const created = await prisma.server.create({
          data: {
            jobId: raw.id,
            placeId,
            worldId: worldRow.id,
            playerCount,
            maxPlayers,
            fps: raw.fps ?? null,
            ping: raw.ping ?? null,
            serverStatus,
            scanStatus: "UNSCANNED",
            verificationStatus: "UNCHECKED",
            joinUrl,
            firstDiscovered: now,
            lastChecked: now,
          },
        });
        await prisma.serverScan.create({
          data: {
            serverId: created.id,
            worldId: worldRow.id,
            scanType: "DISCOVERY",
            status: "SUCCESS",
            playerCount,
            fps: raw.fps ?? null,
            ping: raw.ping ?? null,
            eventsFoundCount: 0,
            durationMs: 0,
            source: "ROBLOX_PUBLIC_API",
          },
        });
        serversDiscovered += 1;
        publishRealtimeEvent("server:discovered", {
          serverId: created.id,
          jobId: created.jobId,
          placeId,
          worldCode: worldRow.worldCode,
          worldName: worldRow.name,
          playerCount,
          maxPlayers,
          serverStatus,
        });
      } else {
        await prisma.server.update({
          where: { id: existing.id },
          data: {
            playerCount,
            maxPlayers,
            fps: raw.fps ?? null,
            ping: raw.ping ?? null,
            serverStatus,
            joinUrl,
            lastChecked: now,
          },
        });
        serversUpdated += 1;
        if (existing.playerCount !== playerCount || existing.serverStatus !== serverStatus) {
          publishRealtimeEvent("server:updated", {
            serverId: existing.id,
            jobId: existing.jobId,
            placeId,
            worldCode: worldRow.worldCode,
            playerCount,
            maxPlayers,
            serverStatus,
          });
        }
      }
    }

    // Polite pause between Seas
    await sleep(300);
  }

  // Mark servers not refreshed in staleThresholdMinutes as CLOSED if API succeeded cleanly
  if (totalFetchedFromApi > 0) {
    const staleCutoff = new Date(Date.now() - staleThresholdMinutes * 60 * 1000);
    const staleServers = await prisma.server.findMany({
      where: {
        serverStatus: { in: ["ACTIVE", "FULL"] },
        lastChecked: { lt: staleCutoff },
      },
      select: { id: true, jobId: true, worldId: true },
    });

    if (staleServers.length > 0) {
      await prisma.server.updateMany({
        where: { id: { in: staleServers.map((s) => s.id) } },
        data: { serverStatus: "CLOSED" },
      });
      serversClosed = staleServers.length;
      for (const closedSrv of staleServers.slice(0, 15)) {
        publishRealtimeEvent("server:closed", {
          serverId: closedSrv.id,
          jobId: closedSrv.jobId,
        });
      }
    }
  }

  return {
    serversDiscovered,
    serversUpdated,
    serversClosed,
    totalFetchedFromApi,
    rateLimitedCount,
    universeInfo,
    errors,
    durationMs: Date.now() - startedAt,
  };
}
