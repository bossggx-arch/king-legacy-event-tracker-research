"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Bell,
  CheckCheck,
  Code2,
  ExternalLink,
  History,
  KeyRound,
  Play,
  RefreshCw,
  Search,
  Send,
  Server as ServerIcon,
  Settings,
} from "lucide-react";
import type { ServerDTO, UserDTO } from "@/types/tracker";
import { formatTimeHms, verificationBadgeStyle } from "@/lib/client-time";

export function ServerBrowserView({
  onReportServer,
}: {
  onReportServer: (jobId: string, placeId: string) => void;
}) {
  const [servers, setServers] = useState<ServerDTO[]>([]);
  const [world, setWorld] = useState<string>("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "25" });
      if (world !== "all") params.set("world", world);
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/v1/servers?${params.toString()}`);
      const json = await res.json();
      setServers(json.data || []);
      setTotalPages(json.pagination?.totalPages || 1);
    } finally {
      setLoading(false);
    }
  }, [page, world, q]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div data-testid="server-browser-view" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#1d2742] bg-[#0d1323] p-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-white">
            <ServerIcon className="h-5 w-5 text-blue-400" />
            King Legacy Public Server Browser
          </h2>
          <p className="text-xs text-slate-400">
            Live Roblox Public Servers discovered via Place IDs 4520749081 (First Sea), 6381829480 (Second Sea), and 15759515082 (Third Sea).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={world}
            onChange={(e) => {
              setPage(1);
              setWorld(e.target.value);
            }}
            className="rounded-lg border border-[#243252] bg-[#121a2e] px-3 py-2 text-xs text-white"
          >
            <option value="all">All Seas</option>
            <option value="FIRST_SEA">First Sea (4520749081)</option>
            <option value="SECOND_SEA">Second Sea (6381829480)</option>
            <option value="THIRD_SEA">Third Sea (15759515082)</option>
          </select>

          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              value={q}
              onChange={(e) => {
                setPage(1);
                setQ(e.target.value);
              }}
              placeholder="Filter Job ID..."
              className="rounded-lg border border-[#243252] bg-[#121a2e] py-2 pl-8 pr-3 text-xs text-white outline-none focus:border-blue-500"
            />
          </div>
          <button
            type="button"
            onClick={load}
            className="rounded-lg border border-[#243252] bg-[#141d35] p-2 text-slate-200 hover:text-white"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#1d2742] bg-[#0d1323]">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[#1d2742] bg-[#0a0f1c] text-[11px] uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3">World / Sea</th>
              <th className="px-4 py-3">Server Job ID</th>
              <th className="px-4 py-3">Players</th>
              <th className="px-4 py-3">Ping / FPS</th>
              <th className="px-4 py-3">Scan & Verification</th>
              <th className="px-4 py-3">Active Events</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#172038]">
            {servers.map((srv) => {
              const vs = verificationBadgeStyle(srv.verificationStatus);
              return (
                <tr key={srv.id} className="hover:bg-[#121a2e]/70">
                  <td className="px-4 py-3">
                    <div className="font-bold text-cyan-300">{srv.world.name}</div>
                    <div className="font-mono text-[10px] text-slate-500">Place {srv.placeId}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-200">{srv.jobId}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        srv.playerCount >= srv.maxPlayers
                          ? "bg-rose-600/80 text-white"
                          : "bg-[#18233c] text-slate-200"
                      }`}
                    >
                      {srv.playerCount}/{srv.maxPlayers}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {srv.ping ?? "—"}ms / {srv.fps ? srv.fps.toFixed(0) : "—"} fps
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-200">
                        {srv.scanStatus}
                      </span>
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${vs.bg} ${vs.text} ${vs.border}`}>
                        {srv.verificationStatus}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {srv.detections.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {srv.detections.map((d) => (
                          <span
                            key={d.id}
                            className="rounded border border-blue-500/30 bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-blue-200"
                          >
                            {d.event.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-500">None reported</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => onReportServer(srv.jobId, srv.placeId)}
                        className="rounded border border-emerald-500/40 bg-emerald-600/20 px-2 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-600/35"
                      >
                        Report
                      </button>
                      {srv.joinUrl && (
                        <a
                          href={srv.joinUrl}
                          className="inline-flex items-center gap-1 rounded bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-500"
                        >
                          <ExternalLink className="h-3 w-3" /> Join
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>
          Page {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded border border-[#243252] bg-[#101729] px-3 py-1.5 disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded border border-[#243252] bg-[#101729] px-3 py-1.5 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

export function EventHistoryView() {
  const [items, setItems] = useState<
    Array<{
      id: string;
      eventName: string;
      eventCategory: string;
      worldName: string;
      serverJobId: string;
      status: string;
      verificationStatus: string;
      detectionSource: string;
      playerCount: number;
      detectedAt: string;
      endedAt: string | null;
      archivalNotes: string | null;
    }>
  >([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    const params = new URLSearchParams({ limit: "60" });
    if (q.trim()) params.set("q", q.trim());
    fetch(`/api/v1/events/history?${params.toString()}`)
      .then((r) => r.json())
      .then((j) => setItems(j.data || []));
  }, [q]);

  return (
    <div data-testid="event-history-view" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#1d2742] bg-[#0d1323] p-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-white">
            <History className="h-5 w-5 text-purple-400" />
            Event Detection History Archive
          </h2>
          <p className="text-xs text-slate-400">
            Persistent PostgreSQL audit log of past and active King Legacy event spawns per server.
          </p>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search event or Job ID..."
          className="rounded-lg border border-[#243252] bg-[#121a2e] px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#1d2742] bg-[#0d1323]">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[#1d2742] bg-[#0a0f1c] text-[11px] uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3">Event</th>
              <th className="px-4 py-3">World</th>
              <th className="px-4 py-3">Server Job ID</th>
              <th className="px-4 py-3">Status / Verification</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Detected</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#172038]">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-[#121a2e]/70">
                <td className="px-4 py-3 font-bold text-white">
                  {item.eventName}
                  <div className="text-[10px] font-normal text-slate-400">{item.eventCategory}</div>
                </td>
                <td className="px-4 py-3 text-cyan-300">{item.worldName}</td>
                <td className="px-4 py-3 font-mono text-slate-300">{item.serverJobId}</td>
                <td className="px-4 py-3">
                  <span className="mr-1 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-200">
                    {item.status}
                  </span>
                  <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-bold text-blue-300">
                    {item.verificationStatus}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-300">
                  {item.detectionSource}
                  {item.archivalNotes && (
                    <div className="text-[10px] text-fuchsia-300">{item.archivalNotes}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-400">{formatTimeHms(item.detectedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function NotificationsView({ user }: { user: UserDTO | null }) {
  const [items, setItems] = useState<
    Array<{
      id: string;
      title: string;
      message: string;
      notificationType: string;
      worldCode: string | null;
      channel: string;
      isRead: boolean;
      createdAt: string;
    }>
  >([]);
  const [webhookUrl, setWebhookUrl] = useState(user?.discordWebhookUrl || "");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/v1/notifications");
    const json = await res.json();
    setItems(json.data || []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const markAllRead = async () => {
    await fetch("/api/v1/notifications", { method: "PATCH", body: JSON.stringify({}) });
    await load();
  };

  const testWebhook = async () => {
    setStatusMsg(null);
    const res = await fetch("/api/v1/notifications/test-webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ webhookUrl }),
    });
    const json = await res.json();
    setStatusMsg(res.ok ? "Test embed sent to Discord Webhook!" : json.error || "Webhook failed");
  };

  return (
    <div data-testid="notifications-view" className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-3 rounded-xl border border-[#1d2742] bg-[#0d1323] p-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold text-white">
              <Bell className="h-5 w-5 text-amber-400" />
              Real-Time Event Alerts
            </h2>
            <button
              type="button"
              onClick={markAllRead}
              className="inline-flex items-center gap-1 rounded-lg border border-[#243252] bg-[#141d35] px-3 py-1.5 text-xs font-semibold text-slate-200 hover:text-white"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark All Read
            </button>
          </div>

          <div className="space-y-2">
            {items.length === 0 ? (
              <div className="rounded-lg border border-[#1a243d] bg-[#0a0f1d] p-4 text-xs text-slate-400">
                No notifications yet. New boss spawns, sea events, and report approvals appear here in real time.
              </div>
            ) : (
              items.map((n) => (
                <div
                  key={n.id}
                  className={`rounded-lg border p-3 text-xs ${
                    n.isRead
                      ? "border-[#1b243c] bg-[#0b101e] text-slate-300"
                      : "border-blue-500/40 bg-blue-950/25 text-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold">{n.title}</span>
                    <span className="text-[10px] text-slate-400">
                      {n.channel} • {formatTimeHms(n.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-slate-400">{n.message}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-[#1d2742] bg-[#0d1323] p-4">
          <h3 className="text-sm font-bold text-white">Discord Webhook Integration</h3>
          <p className="text-xs text-slate-400">
            Configure a Discord Webhook URL to receive instant embeds when Bosses, Sea Events, or Verified spawns appear.
          </p>
          <input
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://discord.com/api/webhooks/..."
            className="w-full rounded-lg border border-[#243252] bg-[#121a2e] px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
          />
          <button
            type="button"
            onClick={testWebhook}
            disabled={!webhookUrl}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 py-2 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-40"
          >
            <Send className="h-3.5 w-3.5" /> Test Discord Webhook
          </button>
          {statusMsg && <div className="text-xs text-cyan-300">{statusMsg}</div>}
        </div>
      </div>
    </div>
  );
}

export function ApiDocsView({ user }: { user: UserDTO | null }) {
  const [spec, setSpec] = useState<{
    info?: { title: string; version: string; description: string };
    paths?: Record<string, Record<string, { summary?: string; tags?: string[] }>>;
  } | null>(null);
  const [testPath, setTestPath] = useState("/api/v1/scanner/coverage");
  const [responseText, setResponseText] = useState<string>("");
  const [apiKeyInput, setApiKeyInput] = useState("kl_live_demo_key_2026_tracker");

  useEffect(() => {
    fetch("/api/v1/openapi")
      .then((r) => r.json())
      .then((j) => setSpec(j));
  }, []);

  const executeTest = async (path: string) => {
    setTestPath(path);
    const res = await fetch(path, {
      headers: apiKeyInput ? { "X-API-Key": apiKeyInput } : undefined,
    });
    const text = await res.text();
    try {
      setResponseText(JSON.stringify(JSON.parse(text), null, 2));
    } catch {
      setResponseText(text);
    }
  };

  const paths = Object.entries(spec?.paths || {});

  return (
    <div data-testid="api-docs-view" className="space-y-4">
      <div className="rounded-xl border border-[#1d2742] bg-[#0d1323] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-white">
              <Code2 className="h-5 w-5 text-cyan-400" />
              {spec?.info?.title || "REST API v1 & OpenAPI Specification"}
            </h2>
            <p className="mt-1 text-xs text-slate-400">{spec?.info?.description}</p>
          </div>
          <a
            href="/api/v1/openapi"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-[#243252] bg-[#141d35] px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:text-white"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Raw OpenAPI JSON
          </a>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-[#1d2842] bg-[#0a0f1d] p-2.5 text-xs">
          <KeyRound className="h-4 w-4 text-amber-400" />
          <span className="font-semibold text-slate-300">Demo API Key:</span>
          <input
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            className="min-w-[240px] flex-1 rounded border border-[#243252] bg-[#121a2e] px-2.5 py-1 font-mono text-white"
          />
          {user && <span className="text-slate-400">Signed in as {user.username}</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="max-h-[520px] space-y-2 overflow-y-auto rounded-xl border border-[#1d2742] bg-[#0d1323] p-3">
          {paths.map(([pathStr, methods]) =>
            Object.entries(methods).map(([method, meta]) => (
              <div
                key={`${method}-${pathStr}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-[#1b243c] bg-[#0b101e] p-2.5 text-xs"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase ${
                        method === "get"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : method === "post"
                          ? "bg-blue-500/20 text-blue-300"
                          : method === "put"
                          ? "bg-amber-500/20 text-amber-300"
                          : "bg-rose-500/20 text-rose-300"
                      }`}
                    >
                      {method}
                    </span>
                    <span className="truncate font-mono font-semibold text-white">{pathStr}</span>
                  </div>
                  <div className="mt-1 truncate text-[11px] text-slate-400">{meta.summary}</div>
                </div>
                {method === "get" && !pathStr.includes("{") && !pathStr.includes("stream") && (
                  <button
                    type="button"
                    onClick={() => executeTest(pathStr)}
                    className="inline-flex shrink-0 items-center gap-1 rounded bg-blue-600/85 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-500"
                  >
                    <Play className="h-3 w-3" /> Try
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        <div className="flex flex-col rounded-xl border border-[#1d2742] bg-[#0d1323] p-3">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-mono font-bold text-cyan-300">GET {testPath}</span>
            <button
              type="button"
              onClick={() => executeTest(testPath)}
              className="rounded bg-blue-600 px-2.5 py-1 font-semibold text-white"
            >
              Run Request
            </button>
          </div>
          <pre className="h-[460px] overflow-auto rounded-lg border border-[#1b243c] bg-[#070a12] p-3 font-mono text-[11px] text-emerald-300">
            {responseText || "// Click 'Try' on any GET endpoint to inspect live PostgreSQL JSON responses."}
          </pre>
        </div>
      </div>
    </div>
  );
}

export function SettingsView({
  user,
  onUserUpdated,
  onOpenAuth,
}: {
  user: UserDTO | null;
  onUserUpdated: (u: UserDTO) => void;
  onOpenAuth: () => void;
}) {
  const [username, setUsername] = useState(user?.username || "");
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState(user?.discordWebhookUrl || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  if (!user) {
    return (
      <div data-testid="settings-view" className="rounded-xl border border-[#1d2742] bg-[#0d1323] p-8 text-center">
        <Settings className="mx-auto h-8 w-8 text-slate-400" />
        <h3 className="mt-2 text-base font-bold text-white">Sign In Required for Profile Settings</h3>
        <p className="mt-1 text-xs text-slate-400">
          Log in or create an account to customize notification preferences, Discord Webhooks, and change your password.
        </p>
        <button
          type="button"
          onClick={onOpenAuth}
          className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500"
        >
          Sign In / Register
        </button>
      </div>
    );
  }

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const res = await fetch("/api/v1/auth/me", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, discordWebhookUrl }),
    });
    const json = await res.json();
    if (res.ok && json.user) {
      onUserUpdated(json.user);
      setMessage("Profile saved successfully.");
    } else {
      setMessage(json.error || "Failed to update profile");
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const res = await fetch("/api/v1/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const json = await res.json();
    setMessage(res.ok ? "Password updated!" : json.error || "Failed to change password");
    if (res.ok) {
      setCurrentPassword("");
      setNewPassword("");
    }
  };

  return (
    <div data-testid="settings-view" className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <form onSubmit={saveProfile} className="space-y-3 rounded-xl border border-[#1d2742] bg-[#0d1323] p-4 text-xs">
        <h3 className="text-sm font-bold text-white">Profile & Webhook Settings</h3>
        {message && <div className="rounded bg-blue-500/15 p-2 text-cyan-300">{message}</div>}
        <div>
          <label className="mb-1 block text-slate-400">Username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-lg border border-[#243252] bg-[#121a2e] px-3 py-2 text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-slate-400">Personal Discord Webhook URL</label>
          <input
            value={discordWebhookUrl}
            onChange={(e) => setDiscordWebhookUrl(e.target.value)}
            placeholder="https://discord.com/api/webhooks/..."
            className="w-full rounded-lg border border-[#243252] bg-[#121a2e] px-3 py-2 text-white"
          />
        </div>
        <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-500">
          Save Profile
        </button>
      </form>

      <form onSubmit={changePassword} className="space-y-3 rounded-xl border border-[#1d2742] bg-[#0d1323] p-4 text-xs">
        <h3 className="text-sm font-bold text-white">Change Password</h3>
        <div>
          <label className="mb-1 block text-slate-400">Current Password</label>
          <input
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full rounded-lg border border-[#243252] bg-[#121a2e] px-3 py-2 text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-slate-400">New Password (min 6 chars)</label>
          <input
            type="password"
            required
            minLength={6}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded-lg border border-[#243252] bg-[#121a2e] px-3 py-2 text-white"
          />
        </div>
        <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 font-bold text-white hover:bg-emerald-500">
          Update Password
        </button>
      </form>
    </div>
  );
}
