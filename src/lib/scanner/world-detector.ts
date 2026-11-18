import type { WorldCode } from "@prisma/client";

export const KING_LEGACY_UNIVERSE_ID = "1451439645";

export const KING_LEGACY_PLACES: Record<
  string,
  {
    placeId: string;
    worldCode: WorldCode;
    worldName: string;
    shortLabel: string;
    description: string;
  }
> = {
  "4520749081": {
    placeId: "4520749081",
    worldCode: "FIRST_SEA",
    worldName: "First Sea",
    shortLabel: "Sea 1",
    description: "King Legacy Main Hub & First Sea (Levels 1 - 2,250)",
  },
  "6381829480": {
    placeId: "6381829480",
    worldCode: "SECOND_SEA",
    worldName: "Second Sea",
    shortLabel: "Sea 2",
    description: "New World / Second Sea (Levels 2,250 - 4,000+)",
  },
  "15759515082": {
    placeId: "15759515082",
    worldCode: "THIRD_SEA",
    worldName: "Third Sea",
    shortLabel: "Sea 3",
    description: "Third Sea Endgame Islands & Deep Trench",
  },
};

export const WORLD_CODE_TO_PLACE_ID: Record<Exclude<WorldCode, "UNKNOWN">, string> = {
  FIRST_SEA: "4520749081",
  SECOND_SEA: "6381829480",
  THIRD_SEA: "15759515082",
};

export interface WorldDetectionResult {
  worldCode: WorldCode;
  worldName: string;
  shortLabel: string;
  placeId: string | null;
  verifiedByPlaceId: boolean;
}

/**
 * Deterministically maps a Roblox Place ID to a King Legacy World/Sea.
 * Never guesses a world from a server name; returns UNKNOWN if Place ID is unrecognized.
 */
export function detectWorldFromPlaceId(placeId: string | number | null | undefined): WorldDetectionResult {
  if (placeId === null || placeId === undefined) {
    return {
      worldCode: "UNKNOWN",
      worldName: "UNKNOWN",
      shortLabel: "UNKNOWN",
      placeId: null,
      verifiedByPlaceId: false,
    };
  }
  const normalized = String(placeId).trim();
  const known = KING_LEGACY_PLACES[normalized];
  if (!known) {
    return {
      worldCode: "UNKNOWN",
      worldName: "UNKNOWN",
      shortLabel: "UNKNOWN",
      placeId: normalized || null,
      verifiedByPlaceId: false,
    };
  }
  return {
    worldCode: known.worldCode,
    worldName: known.worldName,
    shortLabel: known.shortLabel,
    placeId: known.placeId,
    verifiedByPlaceId: true,
  };
}

export function normalizeWorldFilterParam(input: string | null | undefined): WorldCode | null {
  if (!input) return null;
  const val = input.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (val === "ALL" || val === "ALL_SEAS" || val === "ALL_WORLDS") return null;
  if (val === "1" || val === "SEA_1" || val === "SEA1" || val === "FIRST_SEA" || val === "FIRST") return "FIRST_SEA";
  if (val === "2" || val === "SEA_2" || val === "SEA2" || val === "SECOND_SEA" || val === "SECOND") return "SECOND_SEA";
  if (val === "3" || val === "SEA_3" || val === "SEA3" || val === "THIRD_SEA" || val === "THIRD") return "THIRD_SEA";
  if (val === "UNKNOWN") return "UNKNOWN";
  return null;
}

export function formatWorldShortLabel(worldCode: WorldCode): string {
  switch (worldCode) {
    case "FIRST_SEA":
      return "Sea 1";
    case "SECOND_SEA":
      return "Sea 2";
    case "THIRD_SEA":
      return "Sea 3";
    default:
      return "UNKNOWN";
  }
}

export function buildRobloxJoinUrl(placeId: string, jobId: string): string {
  return `roblox://experiences/start?placeId=${encodeURIComponent(placeId)}&gameInstanceId=${encodeURIComponent(jobId)}`;
}

export function buildRobloxWebLaunchUrl(placeId: string, jobId: string): string {
  return `https://www.roblox.com/games/start?placeId=${encodeURIComponent(placeId)}&gameInstanceId=${encodeURIComponent(jobId)}`;
}
