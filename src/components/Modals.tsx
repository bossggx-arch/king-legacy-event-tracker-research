"use client";

import React, { useState } from "react";
import {
  X,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  MapPin,
  Clock,
  Server,
  AlertTriangle,
  Award,
  UserCheck,
} from "lucide-react";
import type { EventDetectionDTO, UserDTO } from "@/types/tracker";
import {
  formatTimeHms,
  resolveLiveDetectionState,
  statusBadgeStyle,
  verificationBadgeStyle,
} from "@/lib/client-time";

interface EventDetailsModalProps {
  detection: EventDetectionDTO | null;
  serverNowMs: number;
  onClose: () => void;
}

export function EventDetailsModal({ detection, serverNowMs, onClose }: EventDetailsModalProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!detection) return null;

  const live = resolveLiveDetectionState(
    {
      status: detection.status,
      startedAt: detection.startedAt,
      expiresAt: detection.expiresAt,
    },
    serverNowMs
  );
  const verStyle = verificationBadgeStyle(detection.verificationStatus);
  const joinUrl =
    detection.server.joinUrl ||
    `roblox://experiences/start?placeId=${detection.server.placeId}&gameInstanceId=${detection.server.jobId}`;

  const copyValue = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(key);
      setTimeout(() => setCopiedField(null), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  const fullText = [
    `King Legacy Event: ${detection.event.name}`,
    `Category: ${detection.event.category.name}`,
    `World / Sea: ${detection.world.name} (Place ID: ${detection.server.placeId})`,
    `Server Job ID: ${detection.server.jobId}`,
    `Players: ${detection.server.playerCount}/${detection.server.maxPlayers}`,
    `Status: ${live.effectiveStatus} | Verification: ${detection.verificationStatus}`,
    `Detection Source: ${detection.source.name}`,
    `Detected At: ${formatTimeHms(detection.detectedAt)} (UTC+7)`,
    `Countdown: ${live.countdownLabel}`,
    `Join URL: ${joinUrl}`,
  ].join("\n");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        data-testid="event-details-modal"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#243252] bg-[#0d1323] shadow-2xl"
      >
        {/* Top Banner */}
        <div className="relative h-48 w-full overflow-hidden">
          <img
            src={detection.event.imageUrl}
            alt={detection.event.name}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d1323] via-[#0d1323]/40 to-black/30" />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-lg border border-white/15 bg-black/60 p-1.5 text-slate-300 hover:bg-rose-600/80 hover:text-white"
            aria-label="Close details"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="absolute bottom-3 left-5 right-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                <span className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase ${statusBadgeStyle(live.effectiveStatus)}`}>
                  {live.effectiveStatus}
                </span>
                <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-bold uppercase ${verStyle.bg} ${verStyle.text} ${verStyle.border}`}>
                  <ShieldCheck className="h-3 w-3" />
                  {detection.verificationStatus}
                </span>
                {detection.isTestData && (
                  <span className="rounded border border-fuchsia-500/40 bg-fuchsia-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-fuchsia-300">
                    TEST_PROVIDER DATA
                  </span>
                )}
              </div>
              <h2 className="text-2xl font-extrabold text-white">{detection.event.name}</h2>
              <p className="text-xs text-slate-300">{detection.event.description}</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-black/75 px-3 py-1.5 text-right font-mono">
              <div className="text-[10px] uppercase text-slate-400">
                {live.effectiveStatus === "UPCOMING" ? "Starts In" : "Time Remaining"}
              </div>
              <div className="text-lg font-bold text-emerald-400">{live.countdownLabel}</div>
            </div>
          </div>
        </div>

        {/* Details Grid */}
        <div className="space-y-4 p-5 text-sm">
          {detection.isTestData && (
            <div className="flex items-start gap-2 rounded-xl border border-fuchsia-500/30 bg-fuchsia-950/25 p-3 text-xs text-fuchsia-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-fuchsia-400" />
              <div>
                <strong>Transparency Notice:</strong> This detection was produced by{" "}
                <code>TEST_PROVIDER</code> attached to a real Roblox public server for dashboard testing.
                Verified in-game events require an Authorized Monitoring Agent, Admin Approval, or Official Public API.
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[#1d2842] bg-[#11182b] p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                <MapPin className="h-3.5 w-3.5 text-cyan-400" /> World & Spawn Location
              </div>
              <div className="mt-1 font-bold text-white">{detection.world.name}</div>
              <div className="text-xs text-slate-400">
                Place ID: <span className="font-mono text-slate-200">{detection.server.placeId}</span>
              </div>
              <div className="mt-1 text-xs text-cyan-300">{detection.event.spawnLocation}</div>
            </div>

            <div className="rounded-xl border border-[#1d2842] bg-[#11182b] p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                <Server className="h-3.5 w-3.5 text-blue-400" /> Server Telemetry
              </div>
              <div className="mt-1 font-mono text-xs text-white break-all">{detection.server.jobId}</div>
              <div className="mt-1 flex items-center gap-3 text-xs text-slate-300">
                <span>
                  Players: <strong>{detection.server.playerCount}/{detection.server.maxPlayers}</strong>
                </span>
                {detection.server.ping !== null && <span>Ping: {detection.server.ping}ms</span>}
                {detection.server.fps !== null && <span>FPS: {detection.server.fps.toFixed(0)}</span>}
              </div>
            </div>

            <div className="rounded-xl border border-[#1d2842] bg-[#11182b] p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                <Clock className="h-3.5 w-3.5 text-amber-400" /> Detection & Provenance
              </div>
              <div className="mt-1 text-xs text-slate-200">
                Source: <strong>{detection.source.name}</strong>
              </div>
              <div className="text-xs text-slate-400">
                Confidence: <strong>{Math.round(detection.confidenceScore * 100)}%</strong>
              </div>
              <div className="mt-1 text-xs text-slate-400">
                Detected: {formatTimeHms(detection.detectedAt)} • Updated: {formatTimeHms(detection.lastUpdated)}
              </div>
            </div>

            <div className="rounded-xl border border-[#1d2842] bg-[#11182b] p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                <Award className="h-3.5 w-3.5 text-emerald-400" /> Rewards & Conditions
              </div>
              <div className="mt-1 text-xs text-emerald-300">
                {detection.event.rewards || "Materials, Beli, Gems"}
              </div>
              <div className="mt-1 text-xs text-slate-400">
                {detection.event.spawnConditions || "Standard spawn cycle"}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#1e2942] pt-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => copyValue("job", detection.server.jobId)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#2a395c] bg-[#162038] px-3 py-2 text-xs font-semibold text-slate-200 hover:border-blue-400 hover:text-white"
              >
                {copiedField === "job" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                Copy Server ID
              </button>
              <button
                type="button"
                onClick={() => copyValue("all", fullText)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#2a395c] bg-[#162038] px-3 py-2 text-xs font-semibold text-slate-200 hover:border-blue-400 hover:text-white"
              >
                {copiedField === "all" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                Copy Full Info
              </button>
            </div>

            <a
              href={joinUrl}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-blue-500"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Join Roblox Server
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ReportEventModalProps {
  open: boolean;
  onClose: () => void;
  events: Array<{ id: string; slug: string; name: string; world: { worldCode: string; name: string; placeId: string } }>;
  defaultJobId?: string;
  defaultPlaceId?: string;
  onSubmitted: () => void;
}

export function ReportEventModal({
  open,
  onClose,
  events,
  defaultJobId = "",
  defaultPlaceId = "6381829480",
  onSubmitted,
}: ReportEventModalProps) {
  const [eventSlug, setEventSlug] = useState(events[0]?.slug || "sea-king-spawn");
  const [serverJobId, setServerJobId] = useState(defaultJobId);
  const [placeId, setPlaceId] = useState(defaultPlaceId);
  const [playerCount, setPlayerCount] = useState(8);
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/events/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventIdOrSlug: eventSlug,
          serverJobId: serverJobId.trim(),
          placeId: placeId.trim(),
          playerCount: Number(playerCount),
          durationMinutes: Number(durationMinutes),
          notes: notes.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to submit report");
      } else {
        onSubmitted();
        onClose();
      }
    } catch {
      setError("Network error while submitting report");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-[#243252] bg-[#0d1323] p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[#1d2842] pb-3">
          <h3 className="text-base font-bold text-white">Report Live King Legacy Event</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="mt-4 space-y-3 text-xs">
          {error && <div className="rounded-lg border border-rose-500/40 bg-rose-950/40 p-2.5 text-rose-200">{error}</div>}

          <div>
            <label className="mb-1 block font-semibold text-slate-300">King Legacy Event</label>
            <select
              value={eventSlug}
              onChange={(e) => {
                const slug = e.target.value;
                setEventSlug(slug);
                const found = events.find((ev) => ev.slug === slug);
                if (found?.world?.placeId && found.world.placeId !== "UNKNOWN") {
                  setPlaceId(found.world.placeId);
                }
              }}
              className="w-full rounded-lg border border-[#263354] bg-[#121a2e] px-3 py-2 text-white outline-none focus:border-blue-500"
            >
              {events.map((ev) => (
                <option key={ev.id} value={ev.slug}>
                  {ev.name} ({ev.world.name})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block font-semibold text-slate-300">World / Sea (Place ID)</label>
              <select
                value={placeId}
                onChange={(e) => setPlaceId(e.target.value)}
                className="w-full rounded-lg border border-[#263354] bg-[#121a2e] px-3 py-2 text-white outline-none focus:border-blue-500"
              >
                <option value="4520749081">First Sea (4520749081)</option>
                <option value="6381829480">Second Sea (6381829480)</option>
                <option value="15759515082">Third Sea (15759515082)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block font-semibold text-slate-300">Server Job ID</label>
              <input
                required
                minLength={6}
                placeholder="e.g. 45ecfe56-5d97-411d..."
                value={serverJobId}
                onChange={(e) => setServerJobId(e.target.value)}
                className="w-full rounded-lg border border-[#263354] bg-[#121a2e] px-3 py-2 font-mono text-white outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-semibold text-slate-300">Player Count</label>
              <input
                type="number"
                min={0}
                max={20}
                value={playerCount}
                onChange={(e) => setPlayerCount(Number(e.target.value))}
                className="w-full rounded-lg border border-[#263354] bg-[#121a2e] px-3 py-2 text-white outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block font-semibold text-slate-300">Est. Remaining (Mins)</label>
              <input
                type="number"
                min={1}
                max={120}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full rounded-lg border border-[#263354] bg-[#121a2e] px-3 py-2 text-white outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block font-semibold text-slate-300">Notes / Evidence (Optional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Spawn location details or confirmation notes..."
              className="w-full rounded-lg border border-[#263354] bg-[#121a2e] px-3 py-2 text-white outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#263354] px-3 py-2 font-semibold text-slate-300 hover:bg-[#162038]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {loading ? "Submitting..." : "Submit Report"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onAuthenticated: (user: UserDTO) => void;
}

export function AuthModal({ open, onClose, onAuthenticated }: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const endpoint = mode === "login" ? "/api/v1/auth/login" : "/api/v1/auth/register";
      const payload =
        mode === "login"
          ? { emailOrUsername, password }
          : { username, email, password };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Authentication failed");
      } else if (json.user) {
        onAuthenticated(json.user);
        onClose();
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        data-testid="auth-modal"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-[#243252] bg-[#0d1323] p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[#1d2842] pb-3">
          <h3 className="text-base font-bold text-white">
            {mode === "login" ? "Sign In to King Legacy Tracker" : "Create Tracker Account"}
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 flex gap-2 rounded-lg bg-[#080c17] p-1 text-xs">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`flex-1 rounded-md py-1.5 font-semibold ${
              mode === "login" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            className={`flex-1 rounded-md py-1.5 font-semibold ${
              mode === "register" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Register
          </button>
        </div>

        <form onSubmit={submit} className="mt-4 space-y-3 text-xs">
          {error && <div className="rounded-lg border border-rose-500/40 bg-rose-950/40 p-2.5 text-rose-200">{error}</div>}

          {mode === "login" ? (
            <div>
              <label className="mb-1 block font-semibold text-slate-300">Email or Username</label>
              <input
                required
                data-testid="login-identifier"
                value={emailOrUsername}
                onChange={(e) => setEmailOrUsername(e.target.value)}
                placeholder="admin@kinglegacy.gg"
                className="w-full rounded-lg border border-[#263354] bg-[#121a2e] px-3 py-2 text-white outline-none focus:border-blue-500"
              />
            </div>
          ) : (
            <>
              <div>
                <label className="mb-1 block font-semibold text-slate-300">Username</label>
                <input
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="SeaPirate99"
                  className="w-full rounded-lg border border-[#263354] bg-[#121a2e] px-3 py-2 text-white outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-300">Email</label>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="hunter@example.com"
                  className="w-full rounded-lg border border-[#263354] bg-[#121a2e] px-3 py-2 text-white outline-none focus:border-blue-500"
                />
              </div>
            </>
          )}

          <div>
            <label className="mb-1 block font-semibold text-slate-300">Password</label>
            <input
              required
              type="password"
              data-testid="login-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-[#263354] bg-[#121a2e] px-3 py-2 text-white outline-none focus:border-blue-500"
            />
          </div>

          {mode === "login" && (
            <div className="rounded-lg border border-[#1f2c4a] bg-[#0a0f1d] p-2.5 text-[11px] text-slate-400">
              <div className="mb-1.5 flex items-center gap-1 font-semibold text-slate-300">
                <UserCheck className="h-3.5 w-3.5 text-blue-400" /> Quick Demo Accounts:
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEmailOrUsername("admin@kinglegacy.gg");
                    setPassword("Admin123!");
                  }}
                  className="rounded border border-blue-500/30 bg-blue-500/15 px-2 py-1 text-blue-300 hover:bg-blue-500/25"
                >
                  Fill Admin
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmailOrUsername("hunter@kinglegacy.gg");
                    setPassword("Hunter123!");
                  }}
                  className="rounded border border-emerald-500/30 bg-emerald-500/15 px-2 py-1 text-emerald-300 hover:bg-emerald-500/25"
                >
                  Fill User
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            data-testid="auth-submit-btn"
            className="w-full rounded-lg bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}
