import { getPrisma } from "@/lib/prisma";
import { getCurrentUser, sanitizeUser } from "@/lib/auth";
import { getScannerCoverageReport } from "@/lib/scanner/engine";
import { ensureBackgroundScannerStarted } from "@/lib/scanner/queue";
import { getCalibratedServerNowMs } from "@/lib/time-sync";
import { TrackerDashboard } from "@/components/TrackerDashboard";
import type {
  CategorySummary,
  EventDetectionDTO,
  UserDTO,
  WorldSummary,
} from "@/types/tracker";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  void ensureBackgroundScannerStarted();
  const prisma = await getPrisma();
  const user = await getCurrentUser();

  const [detectionsRaw, categoriesRaw, worldsRaw, coverage, catalogEventsRaw] =
    await Promise.all([
      prisma.eventDetection.findMany({
        where: { status: { in: ["ACTIVE", "UPCOMING"] } },
        include: {
          event: { include: { category: true } },
          server: true,
          world: true,
          source: true,
        },
        orderBy: [{ expiresAt: "asc" }, { detectedAt: "desc" }],
        take: 100,
      }),
      prisma.eventCategory.findMany({
        include: {
          events: {
            include: {
              detections: {
                where: { status: { in: ["ACTIVE", "UPCOMING"] } },
                select: { id: true },
              },
            },
          },
        },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.serverWorld.findMany({
        include: {
          _count: {
            select: {
              servers: { where: { serverStatus: { not: "CLOSED" } } },
              eventDetections: { where: { status: { in: ["ACTIVE", "UPCOMING"] } } },
            },
          },
        },
      }),
      getScannerCoverageReport(prisma),
      prisma.event.findMany({
        select: {
          id: true,
          slug: true,
          name: true,
          world: { select: { worldCode: true, name: true, placeId: true } },
        },
        orderBy: { name: "asc" },
      }),
    ]);

  const serialize = <T,>(val: T): T => JSON.parse(JSON.stringify(val));

  const initialDetections = serialize(detectionsRaw) as unknown as EventDetectionDTO[];
  const initialCategories: CategorySummary[] = categoriesRaw.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description,
    icon: c.icon,
    sortOrder: c.sortOrder,
    eventCount: c.events.length,
    activeDetectionCount: c.events.reduce((sum, e) => sum + e.detections.length, 0),
  }));
  const initialWorlds: WorldSummary[] = worldsRaw
    .filter((w) => w.worldCode !== "UNKNOWN")
    .map((w) => ({
      id: w.id,
      worldCode: w.worldCode,
      name: w.name,
      placeId: w.placeId,
      serverCount: w._count.servers,
      activeDetectionCount: w._count.eventDetections,
    }));

  const initialUser = user ? (serialize(sanitizeUser(user)) as unknown as UserDTO) : null;

  return (
    <TrackerDashboard
      initialDetections={initialDetections}
      initialCategories={initialCategories}
      initialWorlds={initialWorlds}
      initialCoverage={serialize(coverage)}
      initialCatalogEvents={serialize(catalogEventsRaw)}
      initialUser={initialUser}
      initialServerTimeMs={getCalibratedServerNowMs()}
    />
  );
}
