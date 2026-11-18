import type { EventStatus, VerificationStatus, WorldCode } from "@/types/tracker";

export interface LiveDetectionState {
  effectiveStatus: EventStatus;
  countdownLabel: string;
  remainingSec: number | null;
  urgency: "critical" | "soon" | "normal" | "muted";
}

/**
 * Resolves exact live status & countdown from server-calibrated timestamp:
 * - UPCOMING transitions automatically to ACTIVE as soon as serverNowMs >= startedAt
 * - ACTIVE transitions automatically to ENDED as soon as serverNowMs >= expiresAt
 */
export function resolveLiveDetectionState(
  input: {
    status: EventStatus;
    startedAt: string | null | undefined;
    expiresAt: string | null | undefined;
  },
  serverNowMs: number
): LiveDetectionState {
  if (input.status === "UNKNOWN") {
    return { effectiveStatus: "UNKNOWN", countdownLabel: "UNKNOWN", remainingSec: null, urgency: "muted" };
  }
  if (input.status === "ENDED") {
    return { effectiveStatus: "ENDED", countdownLabel: "ENDED", remainingSec: 0, urgency: "muted" };
  }

  const startMs = input.startedAt ? new Date(input.startedAt).getTime() : null;
  const expireMs = input.expiresAt ? new Date(input.expiresAt).getTime() : null;

  if (expireMs !== null && !Number.isNaN(expireMs) && serverNowMs >= expireMs) {
    return { effectiveStatus: "ENDED", countdownLabel: "ENDED", remainingSec: 0, urgency: "muted" };
  }

  let effectiveStatus: EventStatus = input.status;
  let targetMs: number | null = expireMs;

  if (effectiveStatus === "UPCOMING" && startMs !== null && !Number.isNaN(startMs)) {
    if (serverNowMs < startMs) {
      targetMs = startMs;
    } else {
      effectiveStatus = "ACTIVE";
      targetMs = expireMs;
    }
  }

  if (targetMs === null || Number.isNaN(targetMs)) {
    return { effectiveStatus, countdownLabel: "LIVE", remainingSec: null, urgency: "normal" };
  }

  const diffSec = Math.max(0, Math.ceil((targetMs - serverNowMs) / 1000));
  if (diffSec <= 0) {
    return { effectiveStatus: "ENDED", countdownLabel: "ENDED", remainingSec: 0, urgency: "muted" };
  }

  const hrs = Math.floor(diffSec / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  const secs = diffSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  const formatted = hrs > 0 ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`;

  const countdownLabel = effectiveStatus === "UPCOMING" ? `IN ${formatted}` : formatted;
  const urgency =
    effectiveStatus === "UPCOMING"
      ? "normal"
      : diffSec <= 120
      ? "critical"
      : diffSec <= 300
      ? "soon"
      : "normal";

  return {
    effectiveStatus,
    countdownLabel,
    remainingSec: diffSec,
    urgency,
  };
}

export function formatCountdown(
  targetIso: string | null,
  status: EventStatus,
  serverNowMs: number
): { label: string; remainingSec: number | null; urgency: "critical" | "soon" | "normal" | "muted" } {
  if (!targetIso || status === "UNKNOWN") {
    return { label: "UNKNOWN", remainingSec: null, urgency: "muted" };
  }
  const diffSec = Math.ceil((new Date(targetIso).getTime() - serverNowMs) / 1000);
  if (diffSec <= 0 || status === "ENDED") {
    return { label: "ENDED", remainingSec: 0, urgency: "muted" };
  }
  const hrs = Math.floor(diffSec / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  const secs = diffSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  const label = hrs > 0 ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`;

  const urgency = diffSec <= 120 ? "critical" : diffSec <= 300 ? "soon" : "normal";
  return { label, remainingSec: diffSec, urgency };
}

export function formatTimeHms(iso: string | null | undefined): string {
  if (!iso) return "UNKNOWN";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "UNKNOWN";
  return d.toLocaleTimeString("en-GB", {
    timeZone: "Asia/Bangkok",
    hour12: false,
  });
}

export function formatBangkokClock(nowMs: number): string {
  return new Date(nowMs).toLocaleTimeString("en-GB", {
    timeZone: "Asia/Bangkok",
    hour12: false,
  });
}

export function formatRelativeAge(iso: string | null | undefined, serverNowMs: number): string {
  if (!iso) return "UNKNOWN";
  const diffSec = Math.max(0, Math.floor((serverNowMs - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

export function worldShortName(worldCode: WorldCode): string {
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

export function worldFullName(worldCode: WorldCode): string {
  switch (worldCode) {
    case "FIRST_SEA":
      return "First Sea";
    case "SECOND_SEA":
      return "Second Sea";
    case "THIRD_SEA":
      return "Third Sea";
    default:
      return "UNKNOWN";
  }
}

export function verificationBadgeStyle(status: VerificationStatus): {
  bg: string;
  text: string;
  border: string;
} {
  switch (status) {
    case "VERIFIED":
      return { bg: "bg-emerald-500/20", text: "text-emerald-300", border: "border-emerald-500/40" };
    case "REPORTED":
      return { bg: "bg-sky-500/20", text: "text-sky-300", border: "border-sky-500/40" };
    case "ESTIMATED":
      return { bg: "bg-amber-500/20", text: "text-amber-300", border: "border-amber-500/40" };
    case "UNAVAILABLE":
      return { bg: "bg-rose-500/20", text: "text-rose-300", border: "border-rose-500/40" };
    default:
      return { bg: "bg-slate-600/25", text: "text-slate-300", border: "border-slate-500/40" };
  }
}

export function statusBadgeStyle(status: EventStatus): string {
  switch (status) {
    case "ACTIVE":
      return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
    case "UPCOMING":
      return "bg-indigo-500/20 text-indigo-300 border-indigo-500/40";
    case "ENDED":
      return "bg-slate-700/40 text-slate-400 border-slate-600/40";
    default:
      return "bg-slate-700/40 text-slate-300 border-slate-600/40";
  }
}
