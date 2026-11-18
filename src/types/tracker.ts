export type WorldCode = "FIRST_SEA" | "SECOND_SEA" | "THIRD_SEA" | "UNKNOWN";
export type EventStatus = "ACTIVE" | "UPCOMING" | "ENDED" | "UNKNOWN";
export type VerificationStatus = "VERIFIED" | "REPORTED" | "ESTIMATED" | "UNAVAILABLE" | "UNCHECKED";
export type ServerStatus = "ACTIVE" | "FULL" | "CLOSED" | "UNKNOWN";
export type ScanStatus = "SCANNED" | "UNSCANNED" | "VERIFIED" | "FAILED";
export type UserRole = "USER" | "MODERATOR" | "ADMIN";

export interface CategorySummary {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  sortOrder: number;
  eventCount: number;
  activeDetectionCount: number;
}

export interface WorldSummary {
  id: string;
  worldCode: WorldCode;
  name: string;
  placeId: string;
  serverCount: number;
  activeDetectionCount: number;
}

export interface EventDetectionDTO {
  id: string;
  eventId: string;
  serverId: string;
  worldId: string;
  sourceId: string;
  status: EventStatus;
  verificationStatus: VerificationStatus;
  detectedAt: string;
  startedAt: string;
  expiresAt: string | null;
  endedAt: string | null;
  playerCountAtDetection: number;
  confidenceScore: number;
  evidenceUrl: string | null;
  evidenceMetadata: string | null;
  isDuplicate: boolean;
  isTestData: boolean;
  lastUpdated: string;
  event: {
    id: string;
    slug: string;
    name: string;
    eventType: string;
    description: string;
    imageUrl: string;
    spawnLocation: string;
    rewards: string | null;
    spawnConditions: string | null;
    spawnIntervalSec: number | null;
    activeDurationSec: number | null;
    category: {
      id: string;
      slug: string;
      name: string;
    };
  };
  server: {
    id: string;
    jobId: string;
    placeId: string;
    playerCount: number;
    maxPlayers: number;
    fps: number | null;
    ping: number | null;
    serverStatus: ServerStatus;
    scanStatus: ScanStatus;
    verificationStatus: VerificationStatus;
    joinUrl: string | null;
    firstDiscovered: string;
    lastChecked: string;
    lastUpdated: string;
  };
  world: {
    id: string;
    worldCode: WorldCode;
    name: string;
    placeId: string;
  };
  source: {
    id: string;
    code: string;
    name: string;
    isTestProvider: boolean;
  };
}

export interface ServerDTO {
  id: string;
  jobId: string;
  placeId: string;
  worldId: string;
  playerCount: number;
  maxPlayers: number;
  fps: number | null;
  ping: number | null;
  serverStatus: ServerStatus;
  scanStatus: ScanStatus;
  verificationStatus: VerificationStatus;
  joinUrl: string | null;
  firstDiscovered: string;
  lastChecked: string;
  lastUpdated: string;
  world: {
    id: string;
    worldCode: WorldCode;
    name: string;
    placeId: string;
  };
  detections: EventDetectionDTO[];
  _count?: {
    scans: number;
    detections: number;
    history: number;
  };
}

export interface CoverageReportDTO {
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

export interface UserDTO {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  avatarUrl: string | null;
  discordWebhookUrl: string | null;
  notifyWorlds: string[];
  notifyCategories: string[];
  createdAt: string;
}
