"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TunnelInfo } from "@/lib/ssh-tunnel";

const inputCls =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";
const labelCls = "mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400";
const btnCls =
  "rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      {children}
    </label>
  );
}

const STATUS_COLORS: Record<string, string> = {
  ready: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  connecting: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  reconnecting: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  closed: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  error: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
        STATUS_COLORS[status] ?? STATUS_COLORS.closed
      }`}
    >
      {status}
    </span>
  );
}

function ago(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function uptime(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

export default function TunnelDashboard() {
  const [tunnels, setTunnels] = useState<TunnelInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  // Re-render once a second so relative times tick even without refetch.
  const [, setTick] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/tunnels", { cache: "no-store" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Failed to load.");
      setTunnels(data.tunnels);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tunnels.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => void load(), 3000);
    return () => clearInterval(id);
  }, [autoRefresh, load]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const close = useCallback(
    async (id: string, force: boolean) => {
      setBusyId(id);
      try {
        await fetch(`/api/tunnels/${id}${force ? "?force=true" : ""}`, { method: "DELETE" });
        await load();
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">SSH Tunnels</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Temporary admin view of the in-process tunnel manager.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh (3s)
          </label>
          <button className={btnCls} onClick={() => void load()}>
            Refresh
          </button>
          <button
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            onClick={() => setShowCreate((s) => !s)}
          >
            {showCreate ? "Close form" : "+ New tunnel"}
          </button>
        </div>
      </header>

      <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
        ⚠ Temporary dashboard — no authentication. Credentials are sent to open tunnels and are held
        in memory only. Do not expose publicly; gate behind real admin auth before production.
      </div>

      {showCreate && <CreateForm onCreated={() => void load()} />}

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      <Stats tunnels={tunnels} />

      <div className="overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-zinc-100 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
            <tr>
              {["Status", "Label", "SSH", "Target", "Local", "Refs", "Conns (active/total)", "Reconn", "Uptime", "Last activity", ""].map(
                (h) => (
                  <th key={h} className="border-b border-zinc-200 px-3 py-2 font-medium dark:border-zinc-800">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {tunnels.length === 0 && (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-zinc-500 dark:text-zinc-400">
                  No active tunnels.
                </td>
              </tr>
            )}
            {tunnels.map((t) => (
              <tr key={t.id} className="even:bg-zinc-50 dark:even:bg-zinc-900/40">
                <td className="border-b border-zinc-100 px-3 py-2 dark:border-zinc-800/50">
                  <StatusBadge status={t.status} />
                  {t.lastError && (
                    <span className="ml-1 block text-[11px] text-red-500" title={t.lastError}>
                      {t.lastError.slice(0, 40)}
                    </span>
                  )}
                </td>
                <td className="border-b border-zinc-100 px-3 py-2 text-zinc-700 dark:border-zinc-800/50 dark:text-zinc-300">
                  {t.label ?? "—"}
                  <span className="block font-mono text-[11px] text-zinc-400">{t.id}</span>
                </td>
                <td className="border-b border-zinc-100 px-3 py-2 font-mono text-xs text-zinc-700 dark:border-zinc-800/50 dark:text-zinc-300">
                  {t.ssh.username}@{t.ssh.host}:{t.ssh.port}
                </td>
                <td className="border-b border-zinc-100 px-3 py-2 font-mono text-xs text-zinc-700 dark:border-zinc-800/50 dark:text-zinc-300">
                  {t.target.host}:{t.target.port}
                </td>
                <td className="border-b border-zinc-100 px-3 py-2 font-mono text-xs text-zinc-700 dark:border-zinc-800/50 dark:text-zinc-300">
                  {t.localHost}:{t.localPort}
                </td>
                <td className="border-b border-zinc-100 px-3 py-2 text-zinc-700 dark:border-zinc-800/50 dark:text-zinc-300">
                  {t.refCount}
                </td>
                <td className="border-b border-zinc-100 px-3 py-2 text-zinc-700 dark:border-zinc-800/50 dark:text-zinc-300">
                  {t.activeConnections}/{t.totalConnections}
                </td>
                <td className="border-b border-zinc-100 px-3 py-2 text-zinc-700 dark:border-zinc-800/50 dark:text-zinc-300">
                  {t.reconnects}
                </td>
                <td className="border-b border-zinc-100 px-3 py-2 text-zinc-700 dark:border-zinc-800/50 dark:text-zinc-300">
                  {uptime(t.createdAt)}
                </td>
                <td className="border-b border-zinc-100 px-3 py-2 text-zinc-500 dark:border-zinc-800/50 dark:text-zinc-400">
                  {ago(t.lastActivityAt)}
                </td>
                <td className="border-b border-zinc-100 px-3 py-2 dark:border-zinc-800/50">
                  <div className="flex gap-2">
                    <button
                      className={btnCls}
                      disabled={busyId === t.id}
                      onClick={() => void close(t.id, false)}
                      title="Decrement refcount; close at zero"
                    >
                      Release
                    </button>
                    <button
                      className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
                      disabled={busyId === t.id}
                      onClick={() => void close(t.id, true)}
                      title="Force-close regardless of refcount"
                    >
                      Force
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stats({ tunnels }: { tunnels: TunnelInfo[] }) {
  const ready = tunnels.filter((t) => t.status === "ready").length;
  const activeConns = tunnels.reduce((n, t) => n + t.activeConnections, 0);
  const totalConns = tunnels.reduce((n, t) => n + t.totalConnections, 0);
  const cards = [
    { label: "Tunnels", value: tunnels.length },
    { label: "Ready", value: ready },
    { label: "Active connections", value: activeConns },
    { label: "Total connections", value: totalConns },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
          <div className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{c.value}</div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">{c.label}</div>
        </div>
      ))}
    </div>
  );
}

function CreateForm({ onCreated }: { onCreated: () => void }) {
  const [label, setLabel] = useState("");
  const [sshHost, setSshHost] = useState("");
  const [sshPort, setSshPort] = useState("22");
  const [sshUser, setSshUser] = useState("");
  const [authMethod, setAuthMethod] = useState<"password" | "privateKey">("privateKey");
  const [password, setPassword] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [targetHost, setTargetHost] = useState("127.0.0.1");
  const [targetPort, setTargetPort] = useState("3306");
  const [idleTimeoutMs, setIdleTimeoutMs] = useState("0");

  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onKeyFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setPrivateKey(await file.text());
  }

  async function submit() {
    setSubmitting(true);
    setMsg(null);
    try {
      const body = {
        label: label.trim() || undefined,
        ssh: {
          host: sshHost.trim(),
          port: Number(sshPort) || 22,
          username: sshUser.trim(),
          auth:
            authMethod === "password"
              ? { method: "password", password }
              : { method: "privateKey", privateKey, passphrase: passphrase || undefined },
        },
        target: { host: targetHost.trim(), port: Number(targetPort) || 3306 },
        idleTimeoutMs: Number(idleTimeoutMs) || 0,
      };
      const res = await fetch("/api/tunnels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Failed.");
      setMsg({ ok: true, text: `Tunnel ready on ${data.tunnel.localHost}:${data.tunnel.localPort}` });
      onCreated();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Failed to open tunnel." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Open a tunnel</h2>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Field label="Label (optional)">
          <input className={inputCls} value={label} onChange={(e) => setLabel(e.target.value)} />
        </Field>
        <Field label="SSH host">
          <input className={inputCls} value={sshHost} onChange={(e) => setSshHost(e.target.value)} />
        </Field>
        <Field label="SSH port">
          <input className={inputCls} value={sshPort} onChange={(e) => setSshPort(e.target.value)} />
        </Field>
        <Field label="SSH user">
          <input className={inputCls} value={sshUser} onChange={(e) => setSshUser(e.target.value)} />
        </Field>
      </div>

      <div className="flex gap-4 text-sm text-zinc-700 dark:text-zinc-300">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="auth"
            checked={authMethod === "privateKey"}
            onChange={() => setAuthMethod("privateKey")}
          />
          Private key
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="auth"
            checked={authMethod === "password"}
            onChange={() => setAuthMethod("password")}
          />
          Password
        </label>
      </div>

      {authMethod === "password" ? (
        <Field label="SSH password">
          <input
            type="password"
            className={inputCls}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Private key (PEM)">
            <textarea
              className={`${inputCls} h-28 font-mono`}
              placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
            />
            <button className={`${btnCls} mt-1`} type="button" onClick={() => fileRef.current?.click()}>
              Load key file…
            </button>
            <input ref={fileRef} type="file" className="hidden" onChange={onKeyFile} />
          </Field>
          <Field label="Passphrase (optional)">
            <input
              type="password"
              className={inputCls}
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
            />
          </Field>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Target host (from SSH server)">
          <input className={inputCls} value={targetHost} onChange={(e) => setTargetHost(e.target.value)} />
        </Field>
        <Field label="Target port">
          <input className={inputCls} value={targetPort} onChange={(e) => setTargetPort(e.target.value)} />
        </Field>
        <Field label="Idle timeout ms (0 = persistent)">
          <input
            className={inputCls}
            value={idleTimeoutMs}
            onChange={(e) => setIdleTimeoutMs(e.target.value)}
          />
        </Field>
      </div>

      <div className="flex items-center gap-3">
        <button
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          onClick={() => void submit()}
          disabled={submitting}
        >
          {submitting ? "Opening…" : "Open tunnel"}
        </button>
        {msg && (
          <span className={msg.ok ? "text-sm text-green-600 dark:text-green-400" : "text-sm text-red-600 dark:text-red-400"}>
            {msg.ok ? "✓ " : "✕ "}
            {msg.text}
          </span>
        )}
      </div>
    </section>
  );
}
