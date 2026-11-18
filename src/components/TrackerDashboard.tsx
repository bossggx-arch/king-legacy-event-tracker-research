"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Anchor,
  Bell,
  Clock,
  Code2,
  Compass,
  Flame,
  History,
  Layers,
  LogIn,
  LogOut,
  Menu,
  MessageSquare,
  PlusCircle,
  Radar,
  RefreshCw,
  Search,
  Server as ServerIcon,
  Settings,
  Shield,
  Skull,
  Sparkles,
  Store,
  Waves,
  X,
} from "lucide-react";
import type {
  CategorySummary,
  CoverageReportDTO,
  EventDetectionDTO,
  UserDTO,
  WorldSummary,
} from "@/types/tracker";
import { EventCard } from "./EventCard";
import { formatBangkokClock, resolveLiveDetectionState } from "@/lib/client-time";
import { AuthModal, EventDetailsModal, ReportEventModal } from "./Modals";
import { GlobalScannerView } from "./GlobalScannerView";
import {
  ApiDocsView,
  EventHistoryView,
  NotificationsView,
  ServerBrowserView,
  SettingsView,
} from "./SystemViews";
import { AdminDashboardView } from "./AdminDashboardView";

type SystemView =
  | "events"
  | "scanner"
  | "servers"
  | "history"
  | "notifications"
  | "api-docs"
  | "settings"
  | "admin";

type SortMode = "ending_soonest" | "just_found" | "most_recent" | "most_active";

interface TrackerDashboardProps {
  initialDetections: EventDetectionDTO[];
  initialCategories: CategorySummary[];
  initialWorlds: WorldSummary[];
  initialCoverage: CoverageReportDTO;
  initialCatalogEvents: Array<{
    id: string;
    slug: string;
    name: string;
    world: { worldCode: string; name: string; placeId: string };
  }>;
  initialUser: UserDTO | null;
  initialServerTimeMs: number;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  boss: <Skull className="h-3.5 w-3.5" />,
  "sea-events": <Waves className="h-3.5 w-3.5" />,
  "island-events": <Compass className="h-3.5 w-3.5" />,
  "special-events": <Sparkles className="h-3.5 w-3.5" />,
  "limited-events": <Flame className="h-3.5 w-3.5" />,
  "other-events": <Store className="h-3.5 w-3.5" />,
};

export function TrackerDashboard({
  initialDetections,
  initialCategories,
  initialWorlds,
  initialCoverage,
  initialCatalogEvents,
  initialUser,
  initialServerTimeMs,
}: TrackerDashboardProps) {
  const [detections, setDetections] = useState<EventDetectionDTO[]>(initialDetections);
  const [categories, setCategories] = useState<CategorySummary[]>(initialCategories);
  const [worlds, setWorlds] = useState<WorldSummary[]>(initialWorlds);
  const [coverage, setCoverage] = useState<CoverageReportDTO>(initialCoverage);
  const [user, setUser] = useState<UserDTO | null>(initialUser);

  const [activeView, setActiveView] = useState<SystemView>("events");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedWorld, setSelectedWorld] = useState<string>("all");
  const [sortMode, setSortMode] = useState<SortMode>("ending_soonest");
  const [searchEvent, setSearchEvent] = useState("");
  const [searchServerId, setSearchServerId] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL_LIVE");
  const [verificationFilter, setVerificationFilter] = useState<string>("ALL");

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sseConnected, setSseConnected] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // Server-synced clock offset + 1s live tick for real-time countdowns
  const [serverOffsetMs, setServerOffsetMs] = useState(() => initialServerTimeMs - Date.now());
  const [clientNowMs, setClientNowMs] = useState(() => Date.now());

  const [selectedDetection, setSelectedDetection] = useState<EventDetectionDTO | null>(null);
  const [reportModalState, setReportModalState] = useState<{
    open: boolean;
    jobId?: string;
    placeId?: string;
  }>({ open: false });
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const serverNowMs = clientNowMs + serverOffsetMs;

  // High-precision 250ms ticker so seconds boundaries stay crisp & accurate
  useEffect(() => {
    const timer = setInterval(() => {
      setClientNowMs(Date.now());
    }, 250);
    return () => clearInterval(timer);
  }, []);

  // RTT-compensated clock calibration against Roblox-synced /api/v1/time
  useEffect(() => {
    const syncClockWithServer = async () => {
      try {
        const t0 = Date.now();
        const res = await fetch("/api/v1/time", { cache: "no-store" });
        const t1 = Date.now();
        if (!res.ok) return;
        const json = (await res.json()) as { serverTimeMs?: number };
        if (typeof json.serverTimeMs === "number") {
          const midpoint = Math.round((t0 + t1) / 2);
          setServerOffsetMs(json.serverTimeMs - midpoint);
        }
      } catch {
        // retain current offset if offline
      }
    };

    void syncClockWithServer();
    const interval = setInterval(syncClockWithServer, 30_000);
    return () => clearInterval(interval);
  }, []);

  const refreshFeed = useCallback(async () => {
    const params = new URLSearchParams({ limit: "120", sort: sortMode });
    if (selectedCategory !== "all") params.set("category", selectedCategory);
    if (selectedWorld !== "all") params.set("world", selectedWorld);
    if (searchEvent.trim()) params.set("q", searchEvent.trim());
    if (searchServerId.trim()) params.set("serverId", searchServerId.trim());
    if (statusFilter === "ENDED") {
      params.set("status", "ENDED");
      params.set("includeEnded", "true");
    } else if (statusFilter === "ACTIVE" || statusFilter === "UPCOMING") {
      params.set("status", statusFilter);
    }
    if (verificationFilter !== "ALL") {
      params.set("verification", verificationFilter);
    }

    const [detRes, catRes, covRes, notRes] = await Promise.all([
      fetch(`/api/v1/events/global?${params.toString()}`),
      fetch("/api/v1/categories"),
      fetch("/api/v1/scanner/coverage"),
      fetch("/api/v1/notifications"),
    ]);

    if (detRes.ok) {
      const detJson = await detRes.json();
      setDetections(detJson.data || []);
      if (typeof detJson.serverTimeMs === "number") {
        setServerOffsetMs(detJson.serverTimeMs - Date.now());
      }
    }
    if (catRes.ok) {
      const catJson = await catRes.json();
      setCategories(catJson.categories || []);
      setWorlds(catJson.worlds || []);
    }
    if (covRes.ok) {
      const covJson = await covRes.json();
      if (covJson.data) setCoverage(covJson.data);
    }
    if (notRes.ok) {
      const notJson = await notRes.json();
      setUnreadNotifications(notJson.unreadCount || 0);
    }
  }, [
    sortMode,
    selectedCategory,
    selectedWorld,
    searchEvent,
    searchServerId,
    statusFilter,
    verificationFilter,
  ]);

  useEffect(() => {
    void refreshFeed();
  }, [refreshFeed]);

  // Real-time Server-Sent Events (SSE) subscription
  useEffect(() => {
    const es = new EventSource("/api/v1/stream/global");

    const syncClock = (raw: string) => {
      try {
        const parsed = JSON.parse(raw) as { serverTimeMs?: number };
        if (typeof parsed.serverTimeMs === "number") {
          setServerOffsetMs(parsed.serverTimeMs - Date.now());
        }
      } catch {
        // ignore malformed frame
      }
    };

    es.addEventListener("connected", (e) => {
      setSseConnected(true);
      syncClock((e as MessageEvent).data);
    });
    es.addEventListener("heartbeat", (e) => {
      syncClock((e as MessageEvent).data);
    });

    const handleChange = () => {
      void refreshFeed();
    };

    es.addEventListener("event:detected", handleChange);
    es.addEventListener("event:updated", handleChange);
    es.addEventListener("event:expired", handleChange);
    es.addEventListener("server:discovered", handleChange);
    es.addEventListener("report:created", handleChange);
    es.addEventListener("report:reviewed", handleChange);
    es.addEventListener("scanner:status", handleChange);
    es.addEventListener("notification:created", () => {
      setUnreadNotifications((c) => c + 1);
    });

    es.onerror = () => {
      setSseConnected(false);
    };

    return () => {
      es.close();
    };
  }, [refreshFeed]);

  const handleTriggerScan = async () => {
    setScanning(true);
    try {
      await fetch("/api/v1/scanner/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxPagesPerSea: 2 }),
      });
      await refreshFeed();
    } finally {
      setScanning(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    setUser(null);
  };

  const visibleDetections = useMemo(() => {
    if (statusFilter === "ENDED") return detections;
    return detections.filter((det) => {
      const live = resolveLiveDetectionState(
        { status: det.status, startedAt: det.startedAt, expiresAt: det.expiresAt },
        serverNowMs
      );
      if (statusFilter === "ACTIVE") return live.effectiveStatus === "ACTIVE";
      if (statusFilter === "UPCOMING") return live.effectiveStatus === "UPCOMING";
      return live.effectiveStatus !== "ENDED";
    });
  }, [detections, statusFilter, serverNowMs]);

  const totalActiveDetections = useMemo(
    () => categories.reduce((acc, c) => acc + c.activeDetectionCount, 0),
    [categories]
  );

  const totalWorldServers = useMemo(
    () => worlds.reduce((acc, w) => acc + w.serverCount, 0),
    [worlds]
  );

  const sortOptions: Array<{ id: SortMode; label: string }> = [
    { id: "ending_soonest", label: "Ending Soonest" },
    { id: "just_found", label: "Just Found" },
    { id: "most_recent", label: "Most Recent" },
    { id: "most_active", label: "Most Active" },
  ];

  const selectCategory = (slug: string) => {
    setSelectedCategory(slug);
    setActiveView("events");
    setSidebarOpen(false);
  };

  const selectWorld = (worldCode: string) => {
    setSelectedWorld(worldCode);
    setActiveView("events");
    setSidebarOpen(false);
  };

  const selectSystemView = (view: SystemView) => {
    setActiveView(view);
    setSidebarOpen(false);
  };

  return (
    <div className="flex min-h-screen bg-[#07090f] text-slate-100">
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Left Navigation Sidebar matching reference layout */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-60 shrink-0 flex-col border-r border-[#182138] bg-[#0a0e1a] transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between border-b border-[#182138] px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow">
              <Anchor className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-extrabold tracking-tight text-white">King Legacy</div>
              <div className="text-[10px] font-medium text-cyan-400">Global Event Tracker</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="text-slate-400 hover:text-white lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 space-y-5 overflow-y-auto px-3 py-4 text-xs">
          {/* EVENTS Section */}
          <div>
            <div className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              EVENTS
            </div>
            <div className="space-y-0.5">
              <button
                type="button"
                onClick={() => selectCategory("all")}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 font-medium transition ${
                  activeView === "events" && selectedCategory === "all"
                    ? "bg-[#1a2540] text-white border border-blue-500/30"
                    : "text-slate-300 hover:bg-[#131b30] hover:text-white"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Layers className="h-3.5 w-3.5 text-blue-400" />
                  All Events
                </span>
                <span className="rounded bg-[#111729] px-1.5 py-0.5 text-[10px] font-bold text-slate-300">
                  {totalActiveDetections}
                </span>
              </button>

              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => selectCategory(cat.slug)}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 font-medium transition ${
                    activeView === "events" && selectedCategory === cat.slug
                      ? "bg-[#1a2540] text-white border border-blue-500/30"
                      : "text-slate-300 hover:bg-[#131b30] hover:text-white"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-slate-400">{CATEGORY_ICONS[cat.slug] || <Layers className="h-3.5 w-3.5" />}</span>
                    {cat.name}
                  </span>
                  <span className="rounded bg-[#111729] px-1.5 py-0.5 text-[10px] font-bold text-slate-400">
                    {cat.activeDetectionCount}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* WORLDS Section */}
          <div>
            <div className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              WORLDS
            </div>
            <div className="space-y-0.5">
              <button
                type="button"
                onClick={() => selectWorld("all")}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 font-medium transition ${
                  activeView === "events" && selectedWorld === "all"
                    ? "bg-[#1a2540] text-white border border-cyan-500/30"
                    : "text-slate-300 hover:bg-[#131b30] hover:text-white"
                }`}
              >
                <span>All Seas</span>
                <span className="rounded bg-[#111729] px-1.5 py-0.5 text-[10px] font-bold text-slate-300">
                  {totalWorldServers}
                </span>
              </button>
              {worlds.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => selectWorld(w.worldCode)}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 font-medium transition ${
                    activeView === "events" && selectedWorld === w.worldCode
                      ? "bg-[#1a2540] text-white border border-cyan-500/30"
                      : "text-slate-300 hover:bg-[#131b30] hover:text-white"
                  }`}
                >
                  <span>{w.name}</span>
                  <span className="rounded bg-[#111729] px-1.5 py-0.5 text-[10px] font-bold text-slate-400">
                    {w.serverCount}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* SYSTEM Section */}
          <div>
            <div className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              SYSTEM
            </div>
            <div className="space-y-0.5">
              {[
                { id: "scanner" as const, label: "Global Scanner", icon: <Radar className="h-3.5 w-3.5 text-cyan-400" />, badge: coverage.activeServers },
                { id: "servers" as const, label: "Server Browser", icon: <ServerIcon className="h-3.5 w-3.5 text-blue-400" />, badge: coverage.totalDiscoveredServers },
                { id: "history" as const, label: "Event History", icon: <History className="h-3.5 w-3.5 text-purple-400" /> },
                { id: "notifications" as const, label: "Notifications", icon: <Bell className="h-3.5 w-3.5 text-amber-400" />, badge: unreadNotifications > 0 ? unreadNotifications : undefined },
                { id: "api-docs" as const, label: "API Documentation", icon: <Code2 className="h-3.5 w-3.5 text-emerald-400" /> },
                { id: "settings" as const, label: "Settings", icon: <Settings className="h-3.5 w-3.5 text-slate-400" /> },
                { id: "admin" as const, label: "Admin Dashboard", icon: <Shield className="h-3.5 w-3.5 text-rose-400" /> },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`nav-${item.id}`}
                  onClick={() => selectSystemView(item.id)}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 font-medium transition ${
                    activeView === item.id
                      ? "bg-[#1a2540] text-white border border-blue-500/30"
                      : "text-slate-300 hover:bg-[#131b30] hover:text-white"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {item.icon}
                    {item.label}
                  </span>
                  {item.badge !== undefined && (
                    <span className="rounded bg-[#111729] px-1.5 py-0.5 text-[10px] font-bold text-slate-300">
                      {item.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sticky Sidebar Footer: User Account & Discord Alerts CTA */}
        <div className="space-y-2 border-t border-[#182138] p-3 text-xs">
          {user ? (
            <div className="flex items-center justify-between rounded-lg border border-[#1d2842] bg-[#0e1425] px-2.5 py-2">
              <div className="min-w-0">
                <div className="truncate font-bold text-white">{user.username}</div>
                <div className="text-[10px] text-cyan-400">{user.role}</div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded p-1.5 text-slate-400 hover:bg-rose-600/20 hover:text-rose-300"
                title="Logout"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              data-testid="open-auth-btn"
              onClick={() => setAuthModalOpen(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#243252] bg-[#121a2e] py-2 font-semibold text-slate-200 hover:border-blue-500 hover:text-white"
            >
              <LogIn className="h-3.5 w-3.5" />
              Sign In / Register
            </button>
          )}

          <button
            type="button"
            onClick={() => selectSystemView("notifications")}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#2563eb] py-2 font-bold text-white shadow hover:bg-blue-500"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Discord Alerts
          </button>
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Sticky Header */}
        <header className="sticky top-0 z-30 border-b border-[#182138] bg-[#090d18]/95 px-4 py-3 backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="rounded-lg border border-[#222f4e] bg-[#11182c] p-2 text-slate-300 lg:hidden"
                aria-label="Open menu"
              >
                <Menu className="h-4 w-4" />
              </button>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-base font-extrabold tracking-wide text-white sm:text-lg">
                    KING LEGACY TRACKER
                  </h1>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                      sseConnected
                        ? "border-emerald-500/35 bg-emerald-500/15 text-emerald-300"
                        : "border-amber-500/35 bg-amber-500/15 text-amber-300"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        sseConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
                      }`}
                    />
                    {sseConnected ? "REAL-TIME SSE" : "CONNECTING"}
                  </span>
                  <span
                    className="hidden rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-300 md:inline-flex"
                    title={coverage.transparencyNotice}
                  >
                    Coverage: {coverage.scannedServers}/{coverage.totalDiscoveredServers} Scanned ({coverage.coveragePercent}%)
                  </span>
                  <span
                    data-testid="live-bangkok-clock"
                    className="inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 font-mono text-[10px] font-bold text-blue-200"
                    title="Calibrated Thailand Time (Asia/Bangkok UTC+7)"
                  >
                    <Clock className="h-3 w-3 text-blue-400" />
                    {formatBangkokClock(serverNowMs)} (UTC+7)
                  </span>
                </div>
              </div>
            </div>

            {/* Search Inputs + Quick Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  data-testid="search-events-input"
                  value={searchEvent}
                  onChange={(e) => {
                    setSearchEvent(e.target.value);
                    if (activeView !== "events") setActiveView("events");
                  }}
                  placeholder="Search Events..."
                  className="w-40 rounded-lg border border-[#202c4a] bg-[#101628] py-1.5 pl-8 pr-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500 sm:w-48"
                />
              </div>

              <div className="relative">
                <ServerIcon className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  data-testid="search-server-input"
                  value={searchServerId}
                  onChange={(e) => {
                    setSearchServerId(e.target.value);
                    if (activeView !== "events") setActiveView("events");
                  }}
                  placeholder="Search Server ID..."
                  className="w-36 rounded-lg border border-[#202c4a] bg-[#101628] py-1.5 pl-8 pr-2.5 font-mono text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500 sm:w-44"
                />
              </div>

              {/* Sort Tabs */}
              <div className="hidden items-center rounded-lg border border-[#1e2944] bg-[#0d1323] p-0.5 xl:flex">
                {sortOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setSortMode(opt.id);
                      if (activeView !== "events") setActiveView("events");
                    }}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                      sortMode === opt.id
                        ? "bg-[#1f2c4d] text-white shadow-sm"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                data-testid="report-event-btn"
                onClick={() => setReportModalState({ open: true })}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-600/20 px-2.5 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-600/35"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                Report
              </button>

              <button
                type="button"
                data-testid="scan-now-btn"
                onClick={handleTriggerScan}
                disabled={scanning}
                className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${scanning ? "animate-spin" : ""}`} />
                {scanning ? "Scanning..." : "Scan"}
              </button>
            </div>
          </div>

          {/* Mobile/Tablet Sort Pills + Status/Verification Filters */}
          {activeView === "events" && (
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-[#161f35] pt-2 text-[11px]">
              <div className="flex flex-wrap items-center gap-1 xl:hidden">
                {sortOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSortMode(opt.id)}
                    className={`rounded-md px-2 py-1 font-semibold ${
                      sortMode === opt.id
                        ? "bg-[#1f2c4d] text-white"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Filter by Status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-md border border-[#202c4a] bg-[#0e1424] px-2 py-1 text-xs text-slate-200"
                >
                  <option value="ALL_LIVE">Status: Active & Upcoming</option>
                  <option value="ACTIVE">Status: ACTIVE only</option>
                  <option value="UPCOMING">Status: UPCOMING only</option>
                  <option value="ENDED">Status: ENDED archive</option>
                </select>

                <select
                  aria-label="Filter by Verification"
                  value={verificationFilter}
                  onChange={(e) => setVerificationFilter(e.target.value)}
                  className="rounded-md border border-[#202c4a] bg-[#0e1424] px-2 py-1 text-xs text-slate-200"
                >
                  <option value="ALL">Verification: All</option>
                  <option value="VERIFIED">VERIFIED</option>
                  <option value="REPORTED">REPORTED</option>
                  <option value="ESTIMATED">ESTIMATED</option>
                  <option value="UNCHECKED">UNCHECKED</option>
                </select>
              </div>

              <div className="text-[11px] text-slate-400">
                Showing <strong className="text-white">{visibleDetections.length}</strong> tracked detections across{" "}
                <strong className="text-cyan-300">{coverage.totalDiscoveredServers}</strong> discovered public servers
              </div>
            </div>
          )}
        </header>

        {/* Main Workspace Canvas */}
        <main className="flex-1 p-4">
          {activeView === "events" && (
            <>
              {visibleDetections.length === 0 ? (
                <div className="rounded-2xl border border-[#1d2742] bg-[#0d1323] p-10 text-center">
                  <Radar className="mx-auto h-10 w-10 text-blue-400" />
                  <h2 className="mt-3 text-base font-bold text-white">No Matching Active Events Found</h2>
                  <p className="mt-1 text-xs text-slate-400">
                    Try clearing your search filters, switching Seas, or triggering a live public server scan / submitting an event report.
                  </p>
                </div>
              ) : (
                <div
                  data-testid="events-grid"
                  className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
                >
                  {visibleDetections.map((det) => (
                    <EventCard
                      key={det.id}
                      detection={det}
                      serverNowMs={serverNowMs}
                      onOpenDetails={(d) => setSelectedDetection(d)}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {activeView === "scanner" && (
            <GlobalScannerView
              serverNowMs={serverNowMs}
              onTriggerScan={handleTriggerScan}
              scanning={scanning}
              onReportServer={(jobId, placeId) =>
                setReportModalState({ open: true, jobId, placeId })
              }
            />
          )}

          {activeView === "servers" && (
            <ServerBrowserView
              onReportServer={(jobId, placeId) =>
                setReportModalState({ open: true, jobId, placeId })
              }
            />
          )}

          {activeView === "history" && <EventHistoryView />}

          {activeView === "notifications" && <NotificationsView user={user} />}

          {activeView === "api-docs" && <ApiDocsView user={user} />}

          {activeView === "settings" && (
            <SettingsView
              user={user}
              onUserUpdated={(u) => setUser(u)}
              onOpenAuth={() => setAuthModalOpen(true)}
            />
          )}

          {activeView === "admin" && (
            <AdminDashboardView
              user={user}
              onOpenAuth={() => setAuthModalOpen(true)}
              onTriggerScan={handleTriggerScan}
              onDataChanged={() => {
                void refreshFeed();
              }}
            />
          )}
        </main>
      </div>

      {/* Modals */}
      <EventDetailsModal
        detection={selectedDetection}
        serverNowMs={serverNowMs}
        onClose={() => setSelectedDetection(null)}
      />

      <ReportEventModal
        open={reportModalState.open}
        onClose={() => setReportModalState({ open: false })}
        events={initialCatalogEvents}
        defaultJobId={reportModalState.jobId}
        defaultPlaceId={reportModalState.placeId}
        onSubmitted={() => {
          void refreshFeed();
        }}
      />

      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onAuthenticated={(u) => setUser(u)}
      />
    </div>
  );
}
