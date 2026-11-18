"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  KeyRound,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
  XCircle,
} from "lucide-react";
import type { UserDTO } from "@/types/tracker";
import { formatTimeHms } from "@/lib/client-time";

interface AdminDashboardViewProps {
  user: UserDTO | null;
  onOpenAuth: () => void;
  onTriggerScan: () => Promise<void>;
  onDataChanged: () => void;
}

type AdminTab =
  | "events"
  | "servers"
  | "scanner"
  | "providers"
  | "reports"
  | "users"
  | "apiKeys"
  | "logs";

export function AdminDashboardView({
  user,
  onOpenAuth,
  onTriggerScan,
  onDataChanged,
}: AdminDashboardViewProps) {
  const [tab, setTab] = useState<AdminTab>("reports");
  const [overview, setOverview] = useState<{
    metrics: Record<string, number>;
    health: Record<string, string | null>;
    recentJobs: Array<{
      id: string;
      jobName: string;
      status: string;
      serversDiscovered: number;
      serversUpdated: number;
      detectionsProcessed: number;
      durationMs: number;
      startedAt: string;
    }>;
    recentLogs: Array<{
      id: string;
      adminUsername: string;
      action: string;
      targetType: string;
      targetId: string | null;
      createdAt: string;
    }>;
  } | null>(null);
  const [events, setEvents] = useState<
    Array<{
      id: string;
      slug: string;
      name: string;
      eventType: string;
      spawnLocation: string;
      currentStatus: string;
      verificationStatus: string;
      world: { name: string; worldCode: string };
      category: { name: string; slug: string };
    }>
  >([]);
  const [servers, setServers] = useState<
    Array<{
      id: string;
      jobId: string;
      placeId: string;
      playerCount: number;
      maxPlayers: number;
      serverStatus: string;
      scanStatus: string;
      world: { name: string };
    }>
  >([]);
  const [providers, setProviders] = useState<
    Array<{
      id: string;
      code: string;
      name: string;
      providerType: string;
      isEnabled: boolean;
      isTestProvider: boolean;
      trustWeight: number;
      totalDetections: number;
    }>
  >([]);
  const [reports, setReports] = useState<
    Array<{
      id: string;
      serverJobId: string;
      reporterName: string;
      status: string;
      verificationAssigned: string;
      notes: string | null;
      createdAt: string;
      event: { name: string };
      world: { name: string };
    }>
  >([]);
  const [users, setUsers] = useState<UserDTO[]>([]);
  const [apiKeys, setApiKeys] = useState<
    Array<{
      id: string;
      name: string;
      keyPrefix: string;
      rateLimitPerMin: number;
      isActive: boolean;
      createdAt: string;
    }>
  >([]);
  const [newKeySecret, setNewKeySecret] = useState<string | null>(null);

  // Create Event Form
  const [newSlug, setNewSlug] = useState("");
  const [newName, setNewName] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newCategory, setNewCategory] = useState("boss");
  const [newWorld, setNewWorld] = useState<"FIRST_SEA" | "SECOND_SEA" | "THIRD_SEA">("SECOND_SEA");
  const [newDesc, setNewDesc] = useState("");
  const [newKeyName, setNewKeyName] = useState("");

  const loadAll = useCallback(async () => {
    if (!user || user.role !== "ADMIN") return;
    const [ovRes, evRes, srRes, prRes, rpRes, usRes, akRes] = await Promise.all([
      fetch("/api/v1/admin/overview"),
      fetch("/api/v1/events?limit=100"),
      fetch("/api/v1/servers?limit=40"),
      fetch("/api/v1/admin/providers"),
      fetch("/api/v1/admin/reports"),
      fetch("/api/v1/admin/users"),
      fetch("/api/v1/admin/api-keys"),
    ]);

    if (ovRes.ok) setOverview(await ovRes.json());
    if (evRes.ok) setEvents((await evRes.json()).data || []);
    if (srRes.ok) setServers((await srRes.json()).data || []);
    if (prRes.ok) setProviders((await prRes.json()).data || []);
    if (rpRes.ok) setReports((await rpRes.json()).data || []);
    if (usRes.ok) setUsers((await usRes.json()).data || []);
    if (akRes.ok) setApiKeys((await akRes.json()).data || []);
  }, [user]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  if (!user || user.role !== "ADMIN") {
    return (
      <div
        data-testid="admin-auth-gate"
        className="rounded-2xl border border-[#1d2742] bg-[#0d1323] p-8 text-center"
      >
        <Shield className="mx-auto h-10 w-10 text-amber-400" />
        <h2 className="mt-3 text-lg font-bold text-white">Administrator Access Required</h2>
        <p className="mt-1 text-xs text-slate-400">
          Sign in with an Admin account (demo: <code>admin@kinglegacy.gg</code> / <code>Admin123!</code>) to manage events, servers, detection providers, reports, users, and API keys.
        </p>
        <button
          type="button"
          onClick={onOpenAuth}
          className="mt-4 rounded-lg bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-500"
        >
          Sign In as Admin
        </button>
      </div>
    );
  }

  const createEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/v1/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: newSlug.trim(),
        name: newName.trim(),
        eventType: newCategory === "boss" ? "BOSS" : newCategory === "sea-events" ? "SEA_EVENT" : "SPECIAL_EVENT",
        categorySlug: newCategory,
        worldCode: newWorld,
        description: newDesc.trim() || "Admin registered King Legacy event.",
        spawnLocation: newLocation.trim() || "Sea Coordinates",
      }),
    });
    if (res.ok) {
      setNewSlug("");
      setNewName("");
      setNewLocation("");
      setNewDesc("");
      await loadAll();
      onDataChanged();
    }
  };

  const deleteEvent = async (id: string) => {
    await fetch(`/api/v1/events/${id}`, { method: "DELETE" });
    await loadAll();
    onDataChanged();
  };

  const moderateReport = async (reportId: string, action: "APPROVE" | "REJECT") => {
    await fetch("/api/v1/admin/reports", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportId, action }),
    });
    await loadAll();
    onDataChanged();
  };

  const toggleProvider = async (id: string, currentEnabled: boolean) => {
    await fetch("/api/v1/admin/providers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isEnabled: !currentEnabled }),
    });
    await loadAll();
  };

  const createApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/v1/admin/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newKeyName.trim(), rateLimitPerMin: 240 }),
    });
    const json = await res.json();
    if (res.ok && json.data?.rawKey) {
      setNewKeySecret(json.data.rawKey);
      setNewKeyName("");
      await loadAll();
    }
  };

  const revokeApiKey = async (id: string) => {
    await fetch(`/api/v1/admin/api-keys?id=${id}`, { method: "DELETE" });
    await loadAll();
  };

  const metricsList = [
    { label: "Total Users", value: overview?.metrics.totalUsers ?? 0 },
    { label: "Total Servers", value: overview?.metrics.totalServers ?? 0 },
    { label: "Total Events", value: overview?.metrics.totalEvents ?? 0 },
    { label: "Active Events", value: overview?.metrics.activeEvents ?? 0 },
    { label: "Verified Events", value: overview?.metrics.verifiedEvents ?? 0 },
    { label: "Community Reports", value: overview?.metrics.totalReports ?? 0 },
    { label: "Scanner Status", value: overview?.health.scannerStatus ?? "ONLINE" },
    { label: "API Status", value: overview?.health.apiStatus ?? "HEALTHY" },
    { label: "Database Status", value: overview?.health.databaseStatus ?? "CONNECTED" },
    { label: "Background Jobs", value: overview?.health.backgroundJobsStatus ?? "RUNNING" },
    { label: "System Errors", value: overview?.metrics.systemErrors ?? 0 },
  ];

  const tabs: Array<{ id: AdminTab; label: string }> = [
    { id: "reports", label: `Report Moderation (${reports.filter((r) => r.status === "PENDING").length})` },
    { id: "events", label: "Event Management" },
    { id: "servers", label: "Server Management" },
    { id: "scanner", label: "Scanner Management" },
    { id: "providers", label: "Detection Providers" },
    { id: "users", label: "User Management" },
    { id: "apiKeys", label: "API Key Management" },
    { id: "logs", label: "System Logs" },
  ];

  return (
    <div data-testid="admin-dashboard-view" className="space-y-4">
      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
        {metricsList.map((m) => (
          <div key={m.label} className="rounded-xl border border-[#1d2742] bg-[#0f1526] p-3">
            <div className="text-[10px] font-medium text-slate-400">{m.label}</div>
            <div className="mt-1 text-base font-extrabold text-white">{String(m.value)}</div>
          </div>
        ))}
      </div>

      {/* Tab Bar */}
      <div className="flex flex-wrap gap-1.5 rounded-xl border border-[#1d2742] bg-[#0c111e] p-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              tab === t.id
                ? "bg-blue-600 text-white"
                : "text-slate-300 hover:bg-[#141d35] hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "reports" && (
        <div className="space-y-2 rounded-xl border border-[#1d2742] bg-[#0d1323] p-4">
          <h3 className="text-sm font-bold text-white">Community Event Reports Queue</h3>
          {reports.length === 0 ? (
            <div className="text-xs text-slate-400">No community reports submitted yet.</div>
          ) : (
            reports.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#1c2640] bg-[#0a0f1d] p-3 text-xs"
              >
                <div>
                  <div className="font-bold text-white">
                    {r.event.name} • {r.world.name}
                  </div>
                  <div className="font-mono text-[11px] text-slate-400">
                    Server: {r.serverJobId} • By {r.reporterName} • {formatTimeHms(r.createdAt)}
                  </div>
                  {r.notes && <div className="mt-1 text-slate-300">{r.notes}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-200">
                    {r.status} ({r.verificationAssigned})
                  </span>
                  {r.status === "PENDING" && (
                    <>
                      <button
                        type="button"
                        onClick={() => moderateReport(r.id, "APPROVE")}
                        className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-1 font-bold text-white hover:bg-emerald-500"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => moderateReport(r.id, "REJECT")}
                        className="inline-flex items-center gap-1 rounded bg-rose-600 px-2.5 py-1 font-bold text-white hover:bg-rose-500"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "events" && (
        <div className="space-y-4 rounded-xl border border-[#1d2742] bg-[#0d1323] p-4">
          <form onSubmit={createEvent} className="grid grid-cols-1 gap-2 rounded-lg border border-[#1d2842] bg-[#0a0f1d] p-3 text-xs md:grid-cols-6">
            <input
              required
              placeholder="slug (e.g. sea-beast-raid)"
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              className="rounded border border-[#243252] bg-[#121a2e] px-2.5 py-1.5 text-white"
            />
            <input
              required
              placeholder="Event Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="rounded border border-[#243252] bg-[#121a2e] px-2.5 py-1.5 text-white"
            />
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="rounded border border-[#243252] bg-[#121a2e] px-2.5 py-1.5 text-white"
            >
              <option value="boss">Boss</option>
              <option value="sea-events">Sea Events</option>
              <option value="island-events">Island Events</option>
              <option value="special-events">Special Events</option>
              <option value="limited-events">Limited Events</option>
              <option value="other-events">Other Events</option>
            </select>
            <select
              value={newWorld}
              onChange={(e) => setNewWorld(e.target.value as "FIRST_SEA" | "SECOND_SEA" | "THIRD_SEA")}
              className="rounded border border-[#243252] bg-[#121a2e] px-2.5 py-1.5 text-white"
            >
              <option value="FIRST_SEA">First Sea</option>
              <option value="SECOND_SEA">Second Sea</option>
              <option value="THIRD_SEA">Third Sea</option>
            </select>
            <input
              required
              placeholder="Spawn Location"
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
              className="rounded border border-[#243252] bg-[#121a2e] px-2.5 py-1.5 text-white"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1 rounded bg-blue-600 px-3 py-1.5 font-bold text-white hover:bg-blue-500"
            >
              <Plus className="h-3.5 w-3.5" /> Add Event
            </button>
            <input
              placeholder="Description..."
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="rounded border border-[#243252] bg-[#121a2e] px-2.5 py-1.5 text-white md:col-span-6"
            />
          </form>

          <div className="space-y-1.5 text-xs">
            {events.map((ev) => (
              <div
                key={ev.id}
                className="flex items-center justify-between rounded-lg border border-[#1b243c] bg-[#0a0f1d] px-3 py-2"
              >
                <div>
                  <span className="font-bold text-white">{ev.name}</span>{" "}
                  <span className="text-slate-400">
                    ({ev.category.name} • {ev.world.name} • {ev.spawnLocation})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => deleteEvent(ev.id)}
                  className="text-rose-400 hover:text-rose-300"
                  title="Delete event"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "servers" && (
        <div className="space-y-2 rounded-xl border border-[#1d2742] bg-[#0d1323] p-4 text-xs">
          <h3 className="text-sm font-bold text-white">Discovered Servers ({servers.length} shown)</h3>
          {servers.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg border border-[#1b243c] bg-[#0a0f1d] px-3 py-2">
              <div>
                <span className="font-semibold text-cyan-300">{s.world.name}</span>{" "}
                <span className="font-mono text-slate-300">{s.jobId}</span>{" "}
                <span className="text-slate-400">
                  ({s.playerCount}/{s.maxPlayers}) • {s.scanStatus}
                </span>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await fetch(`/api/v1/admin/servers?id=${s.id}`, { method: "DELETE" });
                  await loadAll();
                }}
                className="text-rose-400 hover:text-rose-300"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === "scanner" && (
        <div className="space-y-3 rounded-xl border border-[#1d2742] bg-[#0d1323] p-4 text-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Scanner Worker Jobs</h3>
            <button
              type="button"
              onClick={async () => {
                await onTriggerScan();
                await loadAll();
              }}
              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 font-bold text-white"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Run Discovery Now
            </button>
          </div>
          {(overview?.recentJobs || []).map((j) => (
            <div key={j.id} className="flex items-center justify-between rounded-lg border border-[#1b243c] bg-[#0a0f1d] px-3 py-2">
              <div>
                <span className="font-bold text-white">{j.jobName}</span>{" "}
                <span className="text-slate-400">({formatTimeHms(j.startedAt)})</span>
              </div>
              <div className="text-slate-300">
                Discovered: {j.serversDiscovered} • Updated: {j.serversUpdated} • Detections: {j.detectionsProcessed} •{" "}
                <span className="font-bold text-emerald-400">{j.status}</span> ({j.durationMs}ms)
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "providers" && (
        <div className="space-y-2 rounded-xl border border-[#1d2742] bg-[#0d1323] p-4 text-xs">
          <h3 className="text-sm font-bold text-white">Detection Providers & Adapters</h3>
          {providers.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg border border-[#1b243c] bg-[#0a0f1d] p-3">
              <div>
                <div className="font-bold text-white">
                  {p.name}{" "}
                  {p.isTestProvider && (
                    <span className="ml-1 rounded bg-fuchsia-500/20 px-1.5 py-0.5 text-[10px] text-fuchsia-300">
                      TEST_PROVIDER
                    </span>
                  )}
                </div>
                <div className="text-slate-400">
                  Code: <code>{p.code}</code> • Trust: {Math.round(p.trustWeight * 100)}% • Detections: {p.totalDetections}
                </div>
              </div>
              <button
                type="button"
                onClick={() => toggleProvider(p.id, p.isEnabled)}
                className={`rounded-lg px-3 py-1.5 font-bold ${
                  p.isEnabled
                    ? "bg-emerald-600/25 text-emerald-300 border border-emerald-500/40"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {p.isEnabled ? "Enabled" : "Disabled"}
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === "users" && (
        <div className="space-y-2 rounded-xl border border-[#1d2742] bg-[#0d1323] p-4 text-xs">
          <h3 className="text-sm font-bold text-white">Registered Users</h3>
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between rounded-lg border border-[#1b243c] bg-[#0a0f1d] px-3 py-2">
              <div>
                <span className="font-bold text-white">{u.username}</span>{" "}
                <span className="text-slate-400">({u.email})</span>
              </div>
              <select
                value={u.role}
                onChange={async (e) => {
                  await fetch("/api/v1/admin/users", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userId: u.id, role: e.target.value }),
                  });
                  await loadAll();
                }}
                className="rounded border border-[#243252] bg-[#121a2e] px-2 py-1 text-white"
              >
                <option value="USER">USER</option>
                <option value="MODERATOR">MODERATOR</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>
          ))}
        </div>
      )}

      {tab === "apiKeys" && (
        <div className="space-y-3 rounded-xl border border-[#1d2742] bg-[#0d1323] p-4 text-xs">
          <form onSubmit={createApiKey} className="flex gap-2">
            <input
              required
              placeholder="New API Key Name (e.g. Discord Bot)"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              className="flex-1 rounded-lg border border-[#243252] bg-[#121a2e] px-3 py-2 text-white"
            />
            <button type="submit" className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 font-bold text-white">
              <KeyRound className="h-3.5 w-3.5" /> Generate Key
            </button>
          </form>
          {newKeySecret && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 p-3 font-mono text-emerald-300">
              Save this key now (shown once): <strong>{newKeySecret}</strong>
            </div>
          )}
          {apiKeys.map((k) => (
            <div key={k.id} className="flex items-center justify-between rounded-lg border border-[#1b243c] bg-[#0a0f1d] px-3 py-2">
              <div>
                <span className="font-bold text-white">{k.name}</span>{" "}
                <span className="font-mono text-slate-400">({k.keyPrefix}...)</span>{" "}
                <span className="text-slate-500">{k.isActive ? "Active" : "Revoked"}</span>
              </div>
              {k.isActive && (
                <button
                  type="button"
                  onClick={() => revokeApiKey(k.id)}
                  className="text-rose-400 hover:text-rose-300"
                >
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "logs" && (
        <div className="space-y-1.5 rounded-xl border border-[#1d2742] bg-[#0d1323] p-4 text-xs">
          <h3 className="mb-2 text-sm font-bold text-white">Admin Audit Logs</h3>
          {(overview?.recentLogs || []).map((log) => (
            <div key={log.id} className="flex items-center justify-between rounded border border-[#1b243c] bg-[#0a0f1d] px-3 py-2">
              <div>
                <span className="font-bold text-cyan-300">{log.action}</span>{" "}
                <span className="text-slate-300">by {log.adminUsername}</span>{" "}
                <span className="text-slate-500">({log.targetType})</span>
              </div>
              <span className="text-slate-400">{formatTimeHms(log.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
