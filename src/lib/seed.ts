import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import type { DetectionProviderCode, PrismaClient, WorldCode } from "@prisma/client";
import { KING_LEGACY_CATEGORIES, KING_LEGACY_EVENTS } from "./king-legacy-catalog";
import { KING_LEGACY_PLACES, KING_LEGACY_UNIVERSE_ID } from "./scanner/world-detector";
import { runRobloxServerDiscovery } from "./scanner/roblox-discovery";
import { runProviderPollingCycle } from "./scanner/engine";

const globalForSeed = globalThis as unknown as {
  __klSeededPromise?: Promise<void>;
};

const DEFAULT_DETECTION_SOURCES: Array<{
  code: DetectionProviderCode;
  name: string;
  providerType: string;
  description: string;
  isEnabled: boolean;
  isTestProvider: boolean;
  trustWeight: number;
}> = [
  {
    code: "OFFICIAL_PUBLIC",
    name: "Official Roblox Public API",
    providerType: "OFFICIAL_API",
    description:
      "Polls Roblox Public Server & Universe APIs (games.roblox.com) for live server discovery, player counts, official universe updates, and deterministic 4h stock schedules.",
    isEnabled: true,
    isTestProvider: false,
    trustWeight: 0.95,
  },
  {
    code: "AUTHORIZED_AGENT",
    name: "Authorized Monitoring Agent",
    providerType: "IN_GAME_TELEMETRY",
    description:
      "Receives signed telemetry payloads from authorized in-game monitoring agents tied to verified Roblox Job IDs and Place IDs.",
    isEnabled: true,
    isTestProvider: false,
    trustWeight: 1.0,
  },
  {
    code: "ADMIN_REPORT",
    name: "Admin Verified Report",
    providerType: "MANUAL_VERIFIED",
    description:
      "Events directly reported or approved by platform administrators with evidence verification.",
    isEnabled: true,
    isTestProvider: false,
    trustWeight: 0.95,
  },
  {
    code: "COMMUNITY_REPORT",
    name: "Community Player Reports",
    providerType: "CROWDSOURCED",
    description:
      "Player-submitted event reports linked to specific server Job IDs, verified via corroboration and admin moderation.",
    isEnabled: true,
    isTestProvider: false,
    trustWeight: 0.65,
  },
  {
    code: "EXTERNAL_API",
    name: "External Partner API Adapter",
    providerType: "EXTERNAL_WEBHOOK",
    description:
      "Configurable adapter for authorized third-party King Legacy tracker APIs and Discord bot feeds.",
    isEnabled: false,
    isTestProvider: false,
    trustWeight: 0.75,
  },
  {
    code: "TEST_PROVIDER",
    name: "Test Detection Provider (Labeled)",
    providerType: "TEST_SIMULATION",
    description:
      "Explicitly labeled test/simulation provider attaching estimated/test events onto real discovered Roblox servers for QA and live countdown preview when in-game telemetry agents are not connected.",
    isEnabled: true,
    isTestProvider: true,
    trustWeight: 0.4,
  },
];

export async function seedDatabase(prisma: PrismaClient, options: { skipRemoteDiscovery?: boolean } = {}) {
  // 1. Seed ServerWorlds (First Sea, Second Sea, Third Sea, Unknown)
  for (const place of Object.values(KING_LEGACY_PLACES)) {
    await prisma.serverWorld.upsert({
      where: { worldCode: place.worldCode },
      update: {
        name: place.worldName,
        placeId: place.placeId,
        universeId: KING_LEGACY_UNIVERSE_ID,
        description: place.description,
      },
      create: {
        worldCode: place.worldCode,
        name: place.worldName,
        placeId: place.placeId,
        universeId: KING_LEGACY_UNIVERSE_ID,
        description: place.description,
      },
    });
  }

  await prisma.serverWorld.upsert({
    where: { worldCode: "UNKNOWN" as WorldCode },
    update: {},
    create: {
      worldCode: "UNKNOWN",
      name: "UNKNOWN",
      placeId: "UNKNOWN",
      universeId: KING_LEGACY_UNIVERSE_ID,
      description: "Unverified Place ID — world cannot be confirmed",
    },
  });

  // 2. Seed EventCategories
  const categoryMap = new Map<string, string>();
  for (const cat of KING_LEGACY_CATEGORIES) {
    const saved = await prisma.eventCategory.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        description: cat.description,
        icon: cat.icon,
        sortOrder: cat.sortOrder,
      },
      create: cat,
    });
    categoryMap.set(cat.slug, saved.id);
  }

  // 3. Seed DetectionSources
  for (const src of DEFAULT_DETECTION_SOURCES) {
    await prisma.detectionSource.upsert({
      where: { code: src.code },
      update: {
        name: src.name,
        providerType: src.providerType,
        description: src.description,
        isTestProvider: src.isTestProvider,
        trustWeight: src.trustWeight,
      },
      create: src,
    });
  }

  // 4. Seed Authentic King Legacy Events
  const worlds = await prisma.serverWorld.findMany();
  const worldMap = new Map(worlds.map((w) => [w.worldCode, w.id]));

  for (const evt of KING_LEGACY_EVENTS) {
    const categoryId = categoryMap.get(evt.categorySlug);
    const worldId = worldMap.get(evt.worldCode);
    if (!categoryId || !worldId) continue;

    await prisma.event.upsert({
      where: { slug: evt.slug },
      update: {
        name: evt.name,
        eventType: evt.eventType,
        categoryId,
        worldId,
        description: evt.description,
        imageUrl: evt.imageUrl,
        spawnLocation: evt.spawnLocation,
        spawnIntervalSec: evt.spawnIntervalSec,
        activeDurationSec: evt.activeDurationSec,
        rewards: evt.rewards,
        spawnConditions: evt.spawnConditions,
      },
      create: {
        slug: evt.slug,
        name: evt.name,
        eventType: evt.eventType,
        categoryId,
        worldId,
        description: evt.description,
        imageUrl: evt.imageUrl,
        spawnLocation: evt.spawnLocation,
        spawnIntervalSec: evt.spawnIntervalSec,
        activeDurationSec: evt.activeDurationSec,
        rewards: evt.rewards,
        spawnConditions: evt.spawnConditions,
        currentStatus: "UNKNOWN",
        verificationStatus: "UNCHECKED",
        detectionSource: "UNCONFIGURED",
        confidenceLevel: 0,
      },
    });
  }

  // 5. Seed Default Admin & Hunter Users + API Key
  const existingAdmin = await prisma.user.findUnique({
    where: { email: "admin@kinglegacy.gg" },
  });
  let adminUser = existingAdmin;
  if (!adminUser) {
    const passwordHash = await bcrypt.hash("Admin123!", 10);
    adminUser = await prisma.user.create({
      data: {
        username: "KingAdmin",
        email: "admin@kinglegacy.gg",
        passwordHash,
        role: "ADMIN",
      },
    });
  }

  const existingHunter = await prisma.user.findUnique({
    where: { email: "hunter@kinglegacy.gg" },
  });
  if (!existingHunter) {
    const passwordHash = await bcrypt.hash("Hunter123!", 10);
    await prisma.user.create({
      data: {
        username: "SeaHunter",
        email: "hunter@kinglegacy.gg",
        passwordHash,
        role: "USER",
      },
    });
  }

  // Default public demo API Key for API Documentation testing
  const demoRawKey = "kl_live_demo_key_2026_tracker";
  const demoKeyHash = crypto.createHash("sha256").update(demoRawKey).digest("hex");
  await prisma.apiKey.upsert({
    where: { keyHash: demoKeyHash },
    update: {},
    create: {
      name: "Default Tracker Demo Key",
      keyHash: demoKeyHash,
      keyPrefix: demoRawKey.slice(0, 14),
      userId: adminUser.id,
      scopes: ["read:events", "read:servers", "read:scanner", "write:reports"],
      rateLimitPerMin: 240,
      isActive: true,
    },
  });

  // 6. Run initial live Roblox Public Server discovery + provider cycle if DB has no servers yet
  const serverCount = await prisma.server.count();
  if (serverCount === 0 && !options.skipRemoteDiscovery) {
    try {
      await runRobloxServerDiscovery(prisma, { maxPagesPerSea: 1 });
      await runProviderPollingCycle(prisma);
    } catch (err) {
      console.warn("[Seed] Initial live Roblox discovery skipped or partial:", err);
    }
  }
}

export async function ensureDatabaseSeeded(prisma: PrismaClient) {
  if (!globalForSeed.__klSeededPromise) {
    globalForSeed.__klSeededPromise = (async () => {
      const eventCount = await prisma.event.count();
      if (eventCount === 0) {
        await seedDatabase(prisma, {
          skipRemoteDiscovery: process.env.NODE_ENV === "test",
        });
      }
    })();
  }
  return globalForSeed.__klSeededPromise;
}
