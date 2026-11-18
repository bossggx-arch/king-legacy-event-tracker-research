-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'MODERATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "WorldCode" AS ENUM ('FIRST_SEA', 'SECOND_SEA', 'THIRD_SEA', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('BOSS', 'SEA_EVENT', 'ISLAND_EVENT', 'SPECIAL_EVENT', 'LIMITED_EVENT', 'SHOP_STOCK', 'UPDATE_EVENT');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('ACTIVE', 'UPCOMING', 'ENDED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('VERIFIED', 'REPORTED', 'ESTIMATED', 'UNAVAILABLE', 'UNCHECKED');

-- CreateEnum
CREATE TYPE "ServerStatus" AS ENUM ('ACTIVE', 'FULL', 'CLOSED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('SCANNED', 'UNSCANNED', 'VERIFIED', 'FAILED');

-- CreateEnum
CREATE TYPE "ScanType" AS ENUM ('DISCOVERY', 'STATUS_CHECK', 'EVENT_DETECTION');

-- CreateEnum
CREATE TYPE "ScanOutcome" AS ENUM ('SUCCESS', 'FAILED', 'RATE_LIMITED');

-- CreateEnum
CREATE TYPE "DetectionProviderCode" AS ENUM ('OFFICIAL_PUBLIC', 'AUTHORIZED_AGENT', 'COMMUNITY_REPORT', 'ADMIN_REPORT', 'EXTERNAL_API', 'TEST_PROVIDER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('NEW_EVENT', 'BOSS_SPAWN', 'SEA_EVENT', 'SERVER_EVENT', 'UPCOMING_EVENT', 'ENDING_SOON');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('WEBSITE', 'DISCORD_WEBHOOK', 'DISCORD_BOT');

-- CreateEnum
CREATE TYPE "ScannerJobType" AS ENUM ('ROBLOX_DISCOVERY', 'SERVER_HEALTH', 'PROVIDER_POLL', 'EXPIRY_CLEANUP');

-- CreateEnum
CREATE TYPE "ScannerJobStatus" AS ENUM ('COMPLETED', 'RUNNING', 'FAILED', 'RETRYING');

-- CreateTable
CREATE TABLE "Users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "avatarUrl" TEXT,
    "discordWebhookUrl" TEXT,
    "notifyWorlds" TEXT[] DEFAULT ARRAY['FIRST_SEA', 'SECOND_SEA', 'THIRD_SEA']::TEXT[],
    "notifyCategories" TEXT[] DEFAULT ARRAY['boss', 'sea-events', 'island-events', 'special-events', 'limited-events']::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventCategories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventCategories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServerWorlds" (
    "id" TEXT NOT NULL,
    "worldCode" "WorldCode" NOT NULL,
    "name" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "universeId" TEXT NOT NULL DEFAULT '1451439645',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServerWorlds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Events" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "eventType" "EventType" NOT NULL,
    "categoryId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "spawnLocation" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "spawnIntervalSec" INTEGER,
    "activeDurationSec" INTEGER,
    "lastSeen" TIMESTAMP(3),
    "nextEstimatedSpawn" TIMESTAMP(3),
    "detectionTime" TIMESTAMP(3),
    "currentStatus" "EventStatus" NOT NULL DEFAULT 'UNKNOWN',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNCHECKED',
    "detectionSource" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "confidenceLevel" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rewards" TEXT,
    "spawnConditions" TEXT,
    "lastUpdated" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Servers" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "playerCount" INTEGER NOT NULL DEFAULT 0,
    "maxPlayers" INTEGER NOT NULL DEFAULT 12,
    "fps" DOUBLE PRECISION,
    "ping" INTEGER,
    "serverStatus" "ServerStatus" NOT NULL DEFAULT 'ACTIVE',
    "scanStatus" "ScanStatus" NOT NULL DEFAULT 'UNSCANNED',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNCHECKED',
    "joinUrl" TEXT,
    "firstDiscovered" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastChecked" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Servers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServerScans" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "scanType" "ScanType" NOT NULL,
    "status" "ScanOutcome" NOT NULL,
    "playerCount" INTEGER NOT NULL DEFAULT 0,
    "fps" DOUBLE PRECISION,
    "ping" INTEGER,
    "eventsFoundCount" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL,
    "errorMessage" TEXT,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServerScans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetectionSources" (
    "id" TEXT NOT NULL,
    "code" "DetectionProviderCode" NOT NULL,
    "name" TEXT NOT NULL,
    "providerType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isTestProvider" BOOLEAN NOT NULL DEFAULT false,
    "trustWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "lastPolledAt" TIMESTAMP(3),
    "totalDetections" INTEGER NOT NULL DEFAULT 0,
    "configJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DetectionSources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventDetections" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'ACTIVE',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNCHECKED',
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "playerCountAtDetection" INTEGER NOT NULL DEFAULT 0,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "evidenceUrl" TEXT,
    "evidenceMetadata" TEXT,
    "isDuplicate" BOOLEAN NOT NULL DEFAULT false,
    "isTestData" BOOLEAN NOT NULL DEFAULT false,
    "lastUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventDetections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventHistory" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "serverId" TEXT,
    "worldId" TEXT NOT NULL,
    "serverJobId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "eventCategory" TEXT NOT NULL,
    "worldName" TEXT NOT NULL,
    "status" "EventStatus" NOT NULL,
    "verificationStatus" "VerificationStatus" NOT NULL,
    "detectionSource" TEXT NOT NULL,
    "playerCount" INTEGER NOT NULL DEFAULT 0,
    "detectedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "archivalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventReports" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "serverId" TEXT,
    "serverJobId" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "reporterId" TEXT,
    "reporterName" TEXT NOT NULL DEFAULT 'Anonymous',
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "verificationAssigned" "VerificationStatus" NOT NULL DEFAULT 'REPORTED',
    "notes" TEXT,
    "evidenceUrl" TEXT,
    "playerCount" INTEGER,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventReports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "eventId" TEXT,
    "serverId" TEXT,
    "detectionId" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "notificationType" "NotificationType" NOT NULL,
    "worldCode" "WorldCode",
    "categorySlug" TEXT,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'WEBSITE',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKeys" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY['read:events', 'read:servers', 'read:scanner']::TEXT[],
    "rateLimitPerMin" INTEGER NOT NULL DEFAULT 120,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKeys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminLogs" (
    "id" TEXT NOT NULL,
    "adminId" TEXT,
    "adminUsername" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "detailsJson" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminLogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScannerJobs" (
    "id" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "jobType" "ScannerJobType" NOT NULL,
    "status" "ScannerJobStatus" NOT NULL DEFAULT 'RUNNING',
    "serversDiscovered" INTEGER NOT NULL DEFAULT 0,
    "serversUpdated" INTEGER NOT NULL DEFAULT 0,
    "serversClosed" INTEGER NOT NULL DEFAULT 0,
    "detectionsProcessed" INTEGER NOT NULL DEFAULT 0,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "errorLog" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ScannerJobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Users_username_key" ON "Users"("username");
CREATE UNIQUE INDEX "Users_email_key" ON "Users"("email");
CREATE INDEX "Users_role_idx" ON "Users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "EventCategories_slug_key" ON "EventCategories"("slug");
CREATE INDEX "EventCategories_sortOrder_idx" ON "EventCategories"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ServerWorlds_worldCode_key" ON "ServerWorlds"("worldCode");
CREATE UNIQUE INDEX "ServerWorlds_placeId_key" ON "ServerWorlds"("placeId");
CREATE INDEX "ServerWorlds_placeId_idx" ON "ServerWorlds"("placeId");

-- CreateIndex
CREATE UNIQUE INDEX "Events_slug_key" ON "Events"("slug");
CREATE INDEX "Events_categoryId_idx" ON "Events"("categoryId");
CREATE INDEX "Events_worldId_idx" ON "Events"("worldId");
CREATE INDEX "Events_eventType_idx" ON "Events"("eventType");
CREATE INDEX "Events_currentStatus_idx" ON "Events"("currentStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Servers_jobId_key" ON "Servers"("jobId");
CREATE INDEX "Servers_worldId_idx" ON "Servers"("worldId");
CREATE INDEX "Servers_placeId_idx" ON "Servers"("placeId");
CREATE INDEX "Servers_serverStatus_idx" ON "Servers"("serverStatus");
CREATE INDEX "Servers_scanStatus_idx" ON "Servers"("scanStatus");
CREATE INDEX "Servers_lastChecked_idx" ON "Servers"("lastChecked");

-- CreateIndex
CREATE INDEX "ServerScans_serverId_idx" ON "ServerScans"("serverId");
CREATE INDEX "ServerScans_worldId_idx" ON "ServerScans"("worldId");
CREATE INDEX "ServerScans_scannedAt_idx" ON "ServerScans"("scannedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DetectionSources_code_key" ON "DetectionSources"("code");

-- CreateIndex
CREATE INDEX "EventDetections_eventId_serverId_status_idx" ON "EventDetections"("eventId", "serverId", "status");
CREATE INDEX "EventDetections_status_expiresAt_idx" ON "EventDetections"("status", "expiresAt");
CREATE INDEX "EventDetections_worldId_idx" ON "EventDetections"("worldId");
CREATE INDEX "EventDetections_detectedAt_idx" ON "EventDetections"("detectedAt");
CREATE INDEX "EventDetections_verificationStatus_idx" ON "EventDetections"("verificationStatus");

-- CreateIndex
CREATE INDEX "EventHistory_eventId_idx" ON "EventHistory"("eventId");
CREATE INDEX "EventHistory_worldId_idx" ON "EventHistory"("worldId");
CREATE INDEX "EventHistory_detectedAt_idx" ON "EventHistory"("detectedAt");

-- CreateIndex
CREATE INDEX "EventReports_status_idx" ON "EventReports"("status");
CREATE INDEX "EventReports_eventId_idx" ON "EventReports"("eventId");
CREATE INDEX "EventReports_createdAt_idx" ON "EventReports"("createdAt");

-- CreateIndex
CREATE INDEX "Notifications_userId_isRead_idx" ON "Notifications"("userId", "isRead");
CREATE INDEX "Notifications_createdAt_idx" ON "Notifications"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKeys_keyHash_key" ON "ApiKeys"("keyHash");
CREATE INDEX "ApiKeys_userId_idx" ON "ApiKeys"("userId");
CREATE INDEX "ApiKeys_isActive_idx" ON "ApiKeys"("isActive");

-- CreateIndex
CREATE INDEX "AdminLogs_createdAt_idx" ON "AdminLogs"("createdAt");
CREATE INDEX "AdminLogs_action_idx" ON "AdminLogs"("action");

-- CreateIndex
CREATE INDEX "ScannerJobs_jobType_startedAt_idx" ON "ScannerJobs"("jobType", "startedAt");
CREATE INDEX "ScannerJobs_status_idx" ON "ScannerJobs"("status");

-- AddForeignKey
ALTER TABLE "Events" ADD CONSTRAINT "Events_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "EventCategories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Events" ADD CONSTRAINT "Events_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "ServerWorlds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Servers" ADD CONSTRAINT "Servers_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "ServerWorlds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerScans" ADD CONSTRAINT "ServerScans_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServerScans" ADD CONSTRAINT "ServerScans_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "ServerWorlds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventDetections" ADD CONSTRAINT "EventDetections_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventDetections" ADD CONSTRAINT "EventDetections_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventDetections" ADD CONSTRAINT "EventDetections_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "ServerWorlds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventDetections" ADD CONSTRAINT "EventDetections_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DetectionSources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventHistory" ADD CONSTRAINT "EventHistory_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventHistory" ADD CONSTRAINT "EventHistory_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Servers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EventHistory" ADD CONSTRAINT "EventHistory_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "ServerWorlds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventReports" ADD CONSTRAINT "EventReports_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventReports" ADD CONSTRAINT "EventReports_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Servers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EventReports" ADD CONSTRAINT "EventReports_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "ServerWorlds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventReports" ADD CONSTRAINT "EventReports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "Users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EventReports" ADD CONSTRAINT "EventReports_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "Users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notifications" ADD CONSTRAINT "Notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notifications" ADD CONSTRAINT "Notifications_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Notifications" ADD CONSTRAINT "Notifications_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Servers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Notifications" ADD CONSTRAINT "Notifications_detectionId_fkey" FOREIGN KEY ("detectionId") REFERENCES "EventDetections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKeys" ADD CONSTRAINT "ApiKeys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminLogs" ADD CONSTRAINT "AdminLogs_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
