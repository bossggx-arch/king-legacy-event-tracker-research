"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Activity,
  Check,
  Copy,
  ExternalLink,
  History,
  Radar,
  RefreshCw,
  Search,
  Server as ServerIcon,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
import type { CoverageReportDTO, ServerDTO } from "@/types/tracker";
import {
  formatTimeHms,
  statusBadgeStyle,
  verificationBadgeStyle,
} from "@/lib/client-time";

interface GlobalScannerViewProps {
  serverNowMs: number;
  onTriggerScan: () => Promise<void>;
  scanning: boolean;
  onReportServer: (jobId: string, placeId: string) => void;
}

type ScannerFilter =
  | "all"
  | "FIRST_SEA"
  | "SECOND_SEA"
  | "THIRD_SEA"
  | "active_events"
  | "no_events"
  | "recently_discovered"
  | "verified_events";

export function GlobalScannerView({
  serverNowMs,
  onTriggerScan,
  scanning,
  onReportServer,
}: GlobalScannerViewProps) {
  const [coverage, setCoverage] = useState<CoverageReportDTO | null>(null);
  const [servers, setServers] = useState<ServerDTO[]>([]);
  const [filter, setFilter] = useState<ScannerFilter>("all");
  const [searchId, setSearchId] = useState("");
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedServer, setSelectedServer] = useState<{
    server: ServerDTO;
    history: Array<{
      id: string;
      eventName: string;
      status: string;
      verificationStatus: string;
      detectionSource: string;
      detectedAt: string;
    }>;
  } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "60" });
      if (filter === "FIRST_SEA" || filter === "SECOND_SEA" || filter === "THIRD_SEA") {
        params.set("world", filter);
      } else if (filter !== "all") {
        params.set("filter", filter);
      }
      if (searchId.trim()) {
        params.set("q", searchId.trim());
      }

      const [covRes, srvRes] = await Promise.all([
        fetch("/api/v1/scanner/coverage"),
        fetch(`/api/v1/servers?${params.toString()}`),
      ]);
      const covJson = await covRes.json();
      const srvJson = await srvRes.json();
      if (covJson.data) setCoverage(covJson.data);
      if (srvJson.data) setServers(srvJson.data);
    } finally {
      setLoading(false);
    }
  }, [filter, searchId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openServerDetails = async (srv: ServerDTO) => {
    const res = await fetch(`/api/v1/servers/${srv.id}`);
    const json = await res.json();
    setSelectedServer({
      server: json.data || srv,
      history: json.data?.history || [],
    });
  };

  const copyText = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(key);
      setTimeout(() => setCopiedId(null), 1600);
    } catch {
      // ignore clipboard errors
    }
  };

  const statCards = [
    { label: "Total Discovered Servers", value: coverage?.totalDiscoveredServers ?? 0, color: "text-white" },
    { label: "Active Servers", value: coverage?.activeServers ?? 0, color: "text-emerald-400" },
    { label: "Scanned Servers", value: coverage?.scannedServers ?? 0, color: "text-cyan-400" },
    { label: "Unscanned Servers", value: coverage?.unscannedServers ?? 0, color: "text-amber-400" },
    { label: "Servers With Events", value: coverage?.serversWithEvents ?? 0, color: "text-blue-400" },
    { label: "Total Active Events", value: coverage?.totalActiveEvents ?? 0, color: "text-rose-400" },
    { label: "First Sea Servers", value: coverage?.firstSeaServers ?? 0, color: "text-sky-300" },
    { label: "Second Sea Servers", value: coverage?.secondSeaServers ?? 0, color: "text-indigo-300" },
    { label: "Third Sea Servers", value: coverage?.thirdSeaServers ?? 0, color: "text-purple-300" },
  ];

  const filterChips: Array<{ id: ScannerFilter; label: string }> = [
    { id: "all", label: "All Worlds" },
    { id: "FIRST_SEA", label: "First Sea" },
    { id: "SECOND_SEA", label: "Second Sea" },
    { id: "THIRD_SEA", label: "Third Sea" },
    { id: "active_events", label: "Active Events" },
    { id: "no_events", label: "No Events" },
    { id: "recently_discovered", label: "Recently Discovered" },
    { id: "verified_events", label: "Verified Events" },
  ];

  return (
    <div data-testid="global-scanner-view" className="space-y-5">
      {/* Scanner Header + Transparency Notice */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#1f2a46] bg-[#0d1323] p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/15 p-2.5 text-cyan-400">
            <Radar className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Global Server Scanner Dashboard</h2>
            <p className="mt-0.5 text-xs text-slate-400">
              {coverage?.transparencyNotice ||
                "Public Server Discovery runs against Roblox Public APIs across First Sea (4520749081), Second Sea (6381829480), and Third Sea (15759515082)."}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-300">
              <span className="inline-flex items-center gap-1 rounded bg-[#141d35] px-2 py-0.5">
                <Activity className="h-3 w-3 text-emerald-400" />
                Coverage: <strong>{coverage?.coveragePercent ?? 0}%</strong>
              </span>
              <span>
                Status: <strong className="text-cyan-300">{coverage?.currentScanStatus ?? "IDLE"}</strong>
              </span>
              <span>
                Last Scan:{" "}
                <strong>{coverage?.lastScanTime ? formatTimeHms(coverage.lastScanTime) : "Running"}</strong>
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={async () => {
            await onTriggerScan();
            await loadData();
          }}
          disabled={scanning}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow hover:bg-blue-500 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${scanning ? "animate-spin" : ""}`} />
          {scanning ? "Scanning Public Servers..." : "Scan Roblox Servers"}
        </button>
      </div>

      {/* 9 Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9">
        {statCards.map((st) => (
          <div
            key={st.label}
            className="rounded-xl border border-[#1d2742] bg-[#0f1526] p-3"
          >
            <div className="text-[10px] font-medium text-slate-400 leading-tight">{st.label}</div>
            <div className={`mt-1 text-xl font-extrabold ${st.color}`}>{st.value}</div>
          </div>
        ))}
      </div>

      {/* Filter Bar & Server ID Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#1d2742] bg-[#0c111e] p-3">
        <div className="flex flex-wrap gap-1.5">
          {filterChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setFilter(chip.id)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                filter === chip.id
                  ? "bg-blue-600 text-white"
                  : "border border-[#202b47] bg-[#12192d] text-slate-300 hover:border-blue-500/40 hover:text-white"
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            placeholder="Search Server Job ID..."
            className="w-full rounded-lg border border-[#223050] bg-[#121a2e] py-2 pl-8 pr-3 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Discovered Server Cards Grid */}
      {loading ? (
        <div className="rounded-xl border border-[#1d2742] bg-[#0f1526] p-8 text-center text-sm text-slate-400">
          Loading discovered Roblox servers...
        </div>
      ) : servers.length === 0 ? (
        <div className="rounded-xl border border-[#1d2742] bg-[#0f1526] p-8 text-center text-sm text-slate-400">
          No servers match your current filter. Click &ldquo;Scan Roblox Servers&rdquo; to discover live public servers.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {servers.map((srv) => {
            const topDetection = srv.detections[0];
            const effectiveVer = topDetection?.verificationStatus || srv.verificationStatus;
            const verStyle = verificationBadgeStyle(effectiveVer);
            const infoBlob = [
              `Event: ${topDetection ? topDetection.event.name : "No Confirmed Event"}`,
              `World: ${srv.world.name} (Place ${srv.placeId})`,
              `Server ID: ${srv.jobId}`,
              `Players: ${srv.playerCount}/${srv.maxPlayers}`,
              `Status: ${topDetection?.status || srv.serverStatus} | Verification: ${effectiveVer}`,
            ].join("\n");

            return (
              <div
                key={srv.id}
                onClick={() => openServerDetails(srv)}
                className="flex flex-col justify-between rounded-xl border border-[#1d2742] bg-[#0f1526] p-3.5 transition hover:border-blue-500/60 cursor-pointer"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-cyan-400">
                        {srv.world.name}
                      </div>
                      <h3 className="mt-0.5 text-sm font-bold text-white">
                        {topDetection ? topDetection.event.name : "Unchecked Public Server"}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1">
                      <span
                        className={`rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase ${statusBadgeStyle(
                          topDetection?.status || (srv.serverStatus === "CLOSED" ? "ENDED" : "ACTIVE")
                        )}`}
                      >
                        {topDetection?.status || srv.serverStatus}
                      </span>
                      <span
                        className={`inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase ${verStyle.bg} ${verStyle.text} ${verStyle.border}`}
                      >
                        {effectiveVer === "VERIFIED" ? (
                          <ShieldCheck className="h-2.5 w-2.5" />
                        ) : (
                          <ShieldAlert className="h-2.5 w-2.5" />
                        )}
                        {effectiveVer}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2.5 space-y-1 rounded-lg border border-[#1a243d] bg-[#0a0f1d] p-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Server ID:</span>
                      <span className="font-mono text-slate-200">{srv.jobId.slice(0, 18)}…</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Players:</span>
                      <span className="font-semibold text-white">
                        {srv.playerCount}/{srv.maxPlayers}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Detected:</span>
                      <span className="text-slate-300">
                        {topDetection
                          ? formatTimeHms(topDetection.detectedAt)
                          : `Checked ${formatTimeHms(srv.lastChecked)}`}
                      </span>
                    </div>
                  </div>
                </div>

                <div
                  className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[#1c2640] pt-2.5 text-[11px]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => openServerDetails(srv)}
                    className="rounded border border-[#263455] bg-[#141c31] px-2 py-1 font-semibold text-slate-200 hover:border-blue-400 hover:text-white"
                  >
                    View Details
                  </button>
                  <button
                    type="button"
                    onClick={() => copyText(`id-${srv.id}`, srv.jobId)}
                    className="inline-flex items-center gap-1 rounded border border-[#263455] bg-[#141c31] px-2 py-1 font-semibold text-slate-200 hover:border-blue-400"
                  >
                    {copiedId === `id-${srv.id}` ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    Copy ID
                  </button>
                  <button
                    type="button"
                    onClick={() => copyText(`info-${srv.id}`, infoBlob)}
                    className="rounded border border-[#263455] bg-[#141c31] px-2 py-1 font-semibold text-slate-200 hover:border-blue-400"
                  >
                    {copiedId === `info-${srv.id}` ? "Copied!" : "Copy Info"}
                  </button>
                  {srv.joinUrl && (
                    <a
                      href={srv.joinUrl}
                      className="inline-flex items-center gap-1 rounded bg-blue-600/85 px-2 py-1 font-semibold text-white hover:bg-blue-500"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Join
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => openServerDetails(srv)}
                    className="inline-flex items-center gap-1 rounded border border-[#263455] bg-[#141c31] px-2 py-1 font-semibold text-slate-300 hover:text-white"
                  >
                    <History className="h-3 w-3" />
                    History
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Server Detail + Event History Modal */}
      {selectedServer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setSelectedServer(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#263455] bg-[#0d1323] p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-[#1d2842] pb-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-cyan-400">
                  <ServerIcon className="h-4 w-4" />
                  {selectedServer.server.world.name} (Place {selectedServer.server.placeId})
                </div>
                <h3 className="mt-1 font-mono text-sm font-bold text-white break-all">
                  {selectedServer.server.jobId}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedServer(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              <div className="rounded-lg border border-[#1d2842] bg-[#121a2e] p-2.5">
                <div className="text-slate-400">Players</div>
                <div className="mt-0.5 text-sm font-bold text-white">
                  {selectedServer.server.playerCount}/{selectedServer.server.maxPlayers}
                </div>
              </div>
              <div className="rounded-lg border border-[#1d2842] bg-[#121a2e] p-2.5">
                <div className="text-slate-400">Scan Status</div>
                <div className="mt-0.5 text-sm font-bold text-cyan-300">
                  {selectedServer.server.scanStatus}
                </div>
              </div>
              <div className="rounded-lg border border-[#1d2842] bg-[#121a2e] p-2.5">
                <div className="text-slate-400">Ping / FPS</div>
                <div className="mt-0.5 text-sm font-bold text-white">
                  {selectedServer.server.ping ?? "—"}ms /{" "}
                  {selectedServer.server.fps ? selectedServer.server.fps.toFixed(0) : "—"}
                </div>
              </div>
              <div className="rounded-lg border border-[#1d2842] bg-[#121a2e] p-2.5">
                <div className="text-slate-400">First Seen</div>
                <div className="mt-0.5 text-sm font-bold text-slate-200">
                  {formatTimeHms(selectedServer.server.firstDiscovered)}
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  const s = selectedServer.server;
                  setSelectedServer(null);
                  onReportServer(s.jobId, s.placeId);
                }}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500"
              >
                Report Event on This Server
              </button>
              {selectedServer.server.joinUrl && (
                <a
                  href={selectedServer.server.joinUrl}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-500"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Join Server
                </a>
              )}
            </div>

            <div className="mt-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Server Event History ({selectedServer.history.length})
              </h4>
              <div className="mt-2 space-y-2">
                {selectedServer.history.length === 0 ? (
                  <div className="rounded-lg border border-[#1d2842] bg-[#0a0f1d] p-3 text-xs text-slate-400">
                    No historical event detections recorded for this server yet (last checked{" "}
                    {new Date(selectedServer.server.lastChecked).toLocaleTimeString()} — server offset{" "}
                    {Math.round((serverNowMs - Date.now()) / 1000)}s).
                  </div>
                ) : (
                  selectedServer.history.map((h) => (
                    <div
                      key={h.id}
                      className="flex items-center justify-between rounded-lg border border-[#1d2842] bg-[#101729] px-3 py-2 text-xs"
                    >
                      <div>
                        <div className="font-bold text-white">{h.eventName}</div>
                        <div className="text-[11px] text-slate-400">
                          {h.detectionSource} • {formatTimeHms(h.detectedAt)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-200">
                          {h.status}
                        </span>
                        <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-bold text-blue-300">
                          {h.verificationStatus}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
