import { beforeAll, describe, expect, it } from "vitest";
import {
  buildRobloxJoinUrl,
  detectWorldFromPlaceId,
  normalizeWorldFilterParam,
} from "../src/lib/scanner/world-detector";
import { KING_LEGACY_EVENTS } from "../src/lib/king-legacy-catalog";
import { getPrisma } from "../src/lib/prisma";
import { ingestDetectionCandidate } from "../src/lib/scanner/providers";
import { getScannerCoverageReport, runExpiryAndStatusSweep } from "../src/lib/scanner/engine";
import { GET as getHealth } from "../src/app/api/v1/health/route";
import { GET as getCategories } from "../src/app/api/v1/categories/route";
import { GET as getEvents, POST as createEvent } from "../src/app/api/v1/events/route";
import { DELETE as deleteEvent } from "../src/app/api/v1/events/[id]/route";
import { GET as getGlobalEvents } from "../src/app/api/v1/events/global/route";
import { POST as submitReport } from "../src/app/api/v1/events/report/route";
import { GET as getCoverage } from "../src/app/api/v1/scanner/coverage/route";
import { GET as getServers } from "../src/app/api/v1/servers/route";
import { GET as getServersByWorld } from "../src/app/api/v1/servers/world/[world]/route";
import { POST as agentIngest } from "../src/app/api/v1/scanner/agent-ingest/route";
import { POST as loginHandler } from "../src/app/api/v1/auth/login/route";
import { PATCH as moderateReport } from "../src/app/api/v1/admin/reports/route";
import { GET as getServerTime } from "../src/app/api/v1/time/route";
import { formatTimeHms, resolveLiveDetectionState } from "../src/lib/client-time";

describe("King Legacy World Detection & Authentic Catalog", () => {
  it("maps official King Legacy Place IDs deterministically and rejects unknown places", () => {
    expect(detectWorldFromPlaceId("4520749081")).toMatchObject({
      worldCode: "FIRST_SEA",
      worldName: "First Sea",
      verifiedByPlaceId: true,
    });
    expect(detectWorldFromPlaceId("6381829480")).toMatchObject({
      worldCode: "SECOND_SEA",
      worldName: "Second Sea",
      verifiedByPlaceId: true,
    });
    expect(detectWorldFromPlaceId("15759515082")).toMatchObject({
      worldCode: "THIRD_SEA",
      worldName: "Third Sea",
      verifiedByPlaceId: true,
    });
    expect(detectWorldFromPlaceId("999999999")).toMatchObject({
      worldCode: "UNKNOWN",
      worldName: "UNKNOWN",
      verifiedByPlaceId: false,
    });
    expect(detectWorldFromPlaceId(null).worldCode).toBe("UNKNOWN");
  });

  it("normalizes world query aliases accurately", () => {
    expect(normalizeWorldFilterParam("1")).toBe("FIRST_SEA");
    expect(normalizeWorldFilterParam("sea-2")).toBe("SECOND_SEA");
    expect(normalizeWorldFilterParam("third_sea")).toBe("THIRD_SEA");
    expect(normalizeWorldFilterParam("all")).toBeNull();
  });

  it("contains only authentic King Legacy events and zero Blox Fruits events", () => {
    const names = KING_LEGACY_EVENTS.map((e) => e.name.toLowerCase());
    expect(names).toContain("sea king");
    expect(names).toContain("hydra");
    expect(names).toContain("ghost ship");
    expect(names).toContain("depth king");
    expect(names).toContain("expert swordsman");
    expect(names).not.toContain("full moon");
    expect(names).not.toContain("mirage island");
    expect(names).not.toContain("rip_indra");
    expect(names).not.toContain("dough king");
  });

  it("accurately resolves live UPCOMING -> ACTIVE -> ENDED transitions and Asia/Bangkok UTC+7 formatting", async () => {
    const base = Date.parse("2026-11-16T14:00:00.000Z"); // 21:00:00 Asia/Bangkok
    const startedAt = new Date(base + 120_000).toISOString();
    const expiresAt = new Date(base + 1020_000).toISOString();

    const beforeStart = resolveLiveDetectionState(
      { status: "UPCOMING", startedAt, expiresAt },
      base
    );
    expect(beforeStart.effectiveStatus).toBe("UPCOMING");
    expect(beforeStart.countdownLabel).toBe("IN 02:00");

    // Once serverNowMs passes startedAt, UPCOMING transitions seamlessly to ACTIVE
    const afterStart = resolveLiveDetectionState(
      { status: "UPCOMING", startedAt, expiresAt },
      base + 120_000
    );
    expect(afterStart.effectiveStatus).toBe("ACTIVE");
    expect(afterStart.countdownLabel).toBe("15:00");

    // Once serverNowMs passes expiresAt, ACTIVE transitions to ENDED
    const afterExpire = resolveLiveDetectionState(
      { status: "ACTIVE", startedAt, expiresAt },
      base + 1025_000
    );
    expect(afterExpire.effectiveStatus).toBe("ENDED");
    expect(afterExpire.countdownLabel).toBe("ENDED");

    expect(formatTimeHms("2026-11-16T14:00:00.000Z")).toBe("21:00:00");
    const timeRes = await getServerTime();
    expect(timeRes.status).toBe(200);
    const timeJson = await timeRes.json();
    expect(timeJson.timezone).toBe("Asia/Bangkok");
  });
});

describe("PostgreSQL + Detection Engine + REST API v1 Integration", () => {
  let adminCookieHeader = "";

  beforeAll(async () => {
    process.env.PGLITE_MEMORY = "true";
    const prisma = await getPrisma();
    const secondSea = await prisma.serverWorld.findUniqueOrThrow({
      where: { worldCode: "SECOND_SEA" },
    });
    const thirdSea = await prisma.serverWorld.findUniqueOrThrow({
      where: { worldCode: "THIRD_SEA" },
    });

    // Seed two discovered servers: one unscanned, one active
    await prisma.server.upsert({
      where: { jobId: "test-job-second-sea-001" },
      update: {},
      create: {
        jobId: "test-job-second-sea-001",
        placeId: secondSea.placeId,
        worldId: secondSea.id,
        playerCount: 9,
        maxPlayers: 12,
        serverStatus: "ACTIVE",
        scanStatus: "UNSCANNED",
        verificationStatus: "UNCHECKED",
        joinUrl: buildRobloxJoinUrl(secondSea.placeId, "test-job-second-sea-001"),
      },
    });

    await prisma.server.upsert({
      where: { jobId: "test-job-third-sea-002" },
      update: {},
      create: {
        jobId: "test-job-third-sea-002",
        placeId: thirdSea.placeId,
        worldId: thirdSea.id,
        playerCount: 12,
        maxPlayers: 12,
        serverStatus: "FULL",
        scanStatus: "UNSCANNED",
        verificationStatus: "UNCHECKED",
        joinUrl: buildRobloxJoinUrl(thirdSea.placeId, "test-job-third-sea-002"),
      },
    });
  });

  it("maintains scanner transparency (never claims all servers scanned when unscanned exist)", async () => {
    const prisma = await getPrisma();
    const coverage = await getScannerCoverageReport(prisma);
    expect(coverage.totalDiscoveredServers).toBeGreaterThanOrEqual(2);
    expect(coverage.unscannedServers).toBeGreaterThanOrEqual(2);
    expect(coverage.allServersScanned).toBe(false);
  });

  it("ingests and deduplicates detections while preserving verification provenance", async () => {
    const prisma = await getPrisma();
    const now = new Date();

    const first = await ingestDetectionCandidate(prisma, "TEST_PROVIDER", {
      eventSlug: "sea-king-spawn",
      serverJobId: "test-job-second-sea-001",
      placeId: "6381829480",
      status: "ACTIVE",
      verificationStatus: "ESTIMATED",
      startedAt: now,
      expiresAt: new Date(now.getTime() + 600_000),
      playerCountAtDetection: 9,
      confidenceScore: 0.45,
      isTestData: true,
    });
    expect(first.created).toBe(true);
    expect(first.detection.isTestData).toBe(true);

    // Second ingestion of same event+server deduplicates and upgrades when VERIFIED
    const second = await ingestDetectionCandidate(prisma, "AUTHORIZED_AGENT", {
      eventSlug: "sea-king-spawn",
      serverJobId: "test-job-second-sea-001",
      placeId: "6381829480",
      status: "ACTIVE",
      verificationStatus: "VERIFIED",
      startedAt: now,
      expiresAt: new Date(now.getTime() + 700_000),
      playerCountAtDetection: 10,
      confidenceScore: 0.98,
      isTestData: false,
    });
    expect(second.created).toBe(false);
    expect(second.detection.verificationStatus).toBe("VERIFIED");

    // Transitions expired detections to ENDED cleanly
    await prisma.eventDetection.update({
      where: { id: second.detection.id },
      data: { expiresAt: new Date(Date.now() - 5000) },
    });
    const sweep = await runExpiryAndStatusSweep(prisma);
    expect(sweep.expired).toBeGreaterThanOrEqual(1);
  });

  it("serves health, categories, events, servers, and coverage endpoints", async () => {
    const healthRes = await getHealth();
    expect(healthRes.status).toBe(200);
    const healthJson = await healthRes.json();
    expect(healthJson.database).toBe("CONNECTED");

    const catRes = await getCategories(new Request("http://localhost/api/v1/categories"));
    expect(catRes.status).toBe(200);
    const catJson = await catRes.json();
    expect(catJson.categories.length).toBeGreaterThanOrEqual(6);

    const eventsRes = await getEvents(new Request("http://localhost/api/v1/events"));
    expect(eventsRes.status).toBe(200);
    const eventsJson = await eventsRes.json();
    expect(eventsJson.data.length).toBeGreaterThanOrEqual(20);

    const serversRes = await getServers(new Request("http://localhost/api/v1/servers"));
    expect(serversRes.status).toBe(200);

    const worldRes = await getServersByWorld(
      new Request("http://localhost/api/v1/servers/world/SECOND_SEA"),
      { params: Promise.resolve({ world: "SECOND_SEA" }) }
    );
    expect(worldRes.status).toBe(200);

    const covRes = await getCoverage(new Request("http://localhost/api/v1/scanner/coverage"));
    expect(covRes.status).toBe(200);
  });

  it("enforces admin authentication on Event CRUD and authenticates admin login", async () => {
    const unauthRes = await createEvent(
      new Request("http://localhost/api/v1/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: "unauth-test",
          name: "Unauth Test",
          eventType: "BOSS",
          categorySlug: "boss",
          worldCode: "FIRST_SEA",
          description: "Should fail",
          spawnLocation: "Nowhere",
        }),
      })
    );
    expect(unauthRes.status).toBe(403);

    const loginRes = await loginHandler(
      new Request("http://localhost/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailOrUsername: "admin@kinglegacy.gg",
          password: "Admin123!",
        }),
      })
    );
    expect(loginRes.status).toBe(200);
    const setCookie = loginRes.headers.get("set-cookie");
    expect(setCookie).toBeTruthy();
    adminCookieHeader = setCookie!.split(";")[0]!;

    // Admin create + delete event
    const createdRes = await createEvent(
      new Request("http://localhost/api/v1/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: adminCookieHeader,
        },
        body: JSON.stringify({
          slug: "qa-admin-boss",
          name: "QA Admin Test Boss",
          eventType: "BOSS",
          categorySlug: "boss",
          worldCode: "THIRD_SEA",
          description: "Integration test created boss event",
          spawnLocation: "Third Sea Arena",
        }),
      })
    );
    expect(createdRes.status).toBe(201);
    const createdJson = await createdRes.json();

    const deletedRes = await deleteEvent(
      new Request(`http://localhost/api/v1/events/${createdJson.data.id}`, {
        method: "DELETE",
        headers: { cookie: adminCookieHeader },
      }),
      { params: Promise.resolve({ id: createdJson.data.id }) }
    );
    expect(deletedRes.status).toBe(200);
  });

  it("handles community event report -> admin approval -> VERIFIED detection & authorized agent ingest", async () => {
    const reportRes = await submitReport(
      new Request("http://localhost/api/v1/events/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventIdOrSlug: "depth-king",
          serverJobId: "test-job-third-sea-002",
          placeId: "15759515082",
          playerCount: 12,
          durationMinutes: 25,
          notes: "Spotted via Legacy Pose!",
        }),
      })
    );
    expect(reportRes.status).toBe(201);
    const reportJson = await reportRes.json();
    expect(reportJson.data.status).toBe("PENDING");
    expect(reportJson.detection.verificationStatus).toBe("REPORTED");

    const approveRes = await moderateReport(
      new Request("http://localhost/api/v1/admin/reports", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: adminCookieHeader,
        },
        body: JSON.stringify({
          reportId: reportJson.data.id,
          action: "APPROVE",
        }),
      })
    );
    expect(approveRes.status).toBe(200);
    const approveJson = await approveRes.json();
    expect(approveJson.data.verificationAssigned).toBe("VERIFIED");

    // Authorized Monitoring Agent ingest
    const ingestRes = await agentIngest(
      new Request("http://localhost/api/v1/scanner/agent-ingest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-agent-secret": process.env.AGENT_INGEST_SECRET || "kl-authorized-agent-secret-2026",
        },
        body: JSON.stringify({
          eventSlug: "hydra-sea-raid",
          serverJobId: "test-job-second-sea-001",
          placeId: "6381829480",
          playerCount: 10,
          durationSeconds: 1200,
        }),
      })
    );
    expect(ingestRes.status).toBe(201);

    const globalRes = await getGlobalEvents(
      new Request("http://localhost/api/v1/events/global?verification=VERIFIED")
    );
    expect(globalRes.status).toBe(200);
    const globalJson = await globalRes.json();
    expect(globalJson.data.length).toBeGreaterThanOrEqual(2);
  });
});
