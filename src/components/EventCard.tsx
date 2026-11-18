"use client";

import React, { useState } from "react";
import { Check, Copy, Info, ShieldCheck, Clock, Users } from "lucide-react";
import type { EventDetectionDTO } from "@/types/tracker";
import {
  formatRelativeAge,
  formatTimeHms,
  resolveLiveDetectionState,
  statusBadgeStyle,
  verificationBadgeStyle,
  worldShortName,
} from "@/lib/client-time";

interface EventCardProps {
  detection: EventDetectionDTO;
  serverNowMs: number;
  onOpenDetails: (detection: EventDetectionDTO) => void;
  compact?: boolean;
}

export function EventCard({ detection, serverNowMs, onOpenDetails, compact = false }: EventCardProps) {
  const [copied, setCopied] = useState(false);

  const live = resolveLiveDetectionState(
    {
      status: detection.status,
      startedAt: detection.startedAt,
      expiresAt: detection.expiresAt,
    },
    serverNowMs
  );
  const verStyle = verificationBadgeStyle(detection.verificationStatus);
  const isFull = detection.server.playerCount >= detection.server.maxPlayers;

  const dotColor =
    live.urgency === "critical"
      ? "bg-rose-500 shadow-[0_0_8px_#f43f5e]"
      : live.urgency === "soon"
      ? "bg-amber-400 shadow-[0_0_8px_#fbbf24]"
      : live.urgency === "normal"
      ? "bg-emerald-400 shadow-[0_0_8px_#34d399]"
      : "bg-slate-500";

  const copySummary = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const infoText = [
      `Event: ${detection.event.name} (${detection.event.category.name})`,
      `World: ${detection.world.name} (Place ID: ${detection.server.placeId})`,
      `Server ID: ${detection.server.jobId}`,
      `Players: ${detection.server.playerCount}/${detection.server.maxPlayers}`,
      `Status: ${live.effectiveStatus} | Verification: ${detection.verificationStatus}${
        detection.isTestData ? " [TEST_PROVIDER]" : ""
      }`,
      `Detected: ${formatTimeHms(detection.detectedAt)} (UTC+7) | Remaining: ${live.countdownLabel}`,
      `Join: ${detection.server.joinUrl || `roblox://experiences/start?placeId=${detection.server.placeId}&gameInstanceId=${detection.server.jobId}`}`,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(infoText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore clipboard errors in headless environments
    }
  };

  return (
    <article
      data-testid="event-card"
      onClick={() => onOpenDetails(detection)}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-[#1d2742] bg-[#0f1526] shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-500/60 hover:shadow-blue-950/30 cursor-pointer"
    >
      {/* Visual Banner Region matching reference cards */}
      <div className={`relative ${compact ? "h-36" : "h-40"} w-full overflow-hidden bg-[#0a0f1d]`}>
        <img
          src={detection.event.imageUrl}
          alt={detection.event.name}
          className="h-full w-full object-cover opacity-85 transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b101d] via-[#0b101d]/35 to-black/35" />

        {/* Top Bar: Details pill + Countdown timer pill */}
        <div className="absolute inset-x-2.5 top-2.5 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetails(detection);
            }}
            className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-black/60 px-2 py-0.5 text-[11px] font-medium text-slate-200 backdrop-blur-sm transition hover:border-blue-400/60 hover:bg-blue-600/75 hover:text-white"
          >
            <Info className="h-3 w-3" />
            Details
          </button>

          <div
            data-testid="card-countdown"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/70 px-2.5 py-0.5 font-mono text-xs font-bold text-white backdrop-blur-sm"
            title={
              live.effectiveStatus === "UPCOMING"
                ? "Time until event starts"
                : "Server-synced remaining time"
            }
          >
            <span className={`h-2 w-2 rounded-full animate-live-dot ${dotColor}`} />
            <span>{live.countdownLabel}</span>
          </div>
        </div>

        {/* Status & Verification Badges */}
        <div className="absolute left-2.5 top-10 flex flex-wrap items-center gap-1">
          <span
            className={`rounded border px-1.5 py-0.5 text-[9px] font-bold tracking-wide uppercase ${statusBadgeStyle(
              live.effectiveStatus
            )}`}
          >
            {live.effectiveStatus}
          </span>
          <span
            className={`inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[9px] font-bold tracking-wide uppercase ${verStyle.bg} ${verStyle.text} ${verStyle.border}`}
          >
            <ShieldCheck className="h-2.5 w-2.5" />
            {detection.verificationStatus}
          </span>
          {detection.isTestData && (
            <span className="rounded border border-fuchsia-500/40 bg-fuchsia-600/25 px-1.5 py-0.5 text-[9px] font-bold uppercase text-fuchsia-300">
              TEST
            </span>
          )}
        </div>

        {/* Title & Description overlay at bottom of artwork */}
        <div className="absolute inset-x-2.5 bottom-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate text-[15px] font-bold tracking-tight text-white drop-shadow">
              {detection.event.name}
            </h3>
            <span className="shrink-0 rounded bg-blue-500/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-blue-300 border border-blue-500/30">
              {detection.event.category.name}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[11px] text-slate-300/90">
            {detection.event.description}
          </p>
        </div>
      </div>

      {/* Bottom Telemetry Bar */}
      <div className="flex flex-col gap-1.5 border-t border-[#1c2640] bg-[#0b101e] px-2.5 py-2">
        {/* Sea | Server ID | Players */}
        <div className="flex items-center justify-between gap-1.5 text-[11px]">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="shrink-0 rounded bg-[#162038] px-1.5 py-0.5 font-semibold text-cyan-300 border border-cyan-500/20">
              {worldShortName(detection.world.worldCode)}
            </span>
            <span
              className="truncate font-mono text-slate-400"
              title={`Job ID: ${detection.server.jobId}`}
            >
              {detection.server.jobId.slice(0, 8)}…
            </span>
          </div>

          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
              isFull
                ? "bg-rose-600/85 text-white"
                : "bg-[#172136] text-slate-200 border border-slate-700/70"
            }`}
          >
            <Users className="h-2.5 w-2.5" />
            {detection.server.playerCount}/{detection.server.maxPlayers}
            {isFull ? " Full" : ""}
          </span>
        </div>

        {/* Timestamps + Copy Information Button */}
        <div className="flex items-center justify-between gap-1.5 text-[10px] text-slate-400">
          <div className="flex min-w-0 items-center gap-1 truncate" title={`Detected at ${detection.detectedAt}`}>
            <Clock className="h-2.5 w-2.5 shrink-0 text-slate-500" />
            <span className="truncate">
              {formatTimeHms(detection.detectedAt)} • {formatRelativeAge(detection.detectedAt, serverNowMs)}
            </span>
          </div>

          <button
            type="button"
            onClick={copySummary}
            className="inline-flex shrink-0 items-center gap-1 rounded border border-[#243252] bg-[#131b30] px-2 py-0.5 text-[10px] font-medium text-slate-200 transition hover:border-blue-400/60 hover:bg-blue-600/25 hover:text-white"
          >
            {copied ? (
              <>
                <Check className="h-2.5 w-2.5 text-emerald-400" />
                <span className="text-emerald-300">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-2.5 w-2.5" />
                <span>Copy Info</span>
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  );
}
