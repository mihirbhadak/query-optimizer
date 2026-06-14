"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ConnectionInfo, QueryResult } from "@/lib/mysql-runner";

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
  error: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  closed: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

function ago(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

type AuthMethod = "password" | "privateKey";

export default function DatabaseDashboard() {
  // ---- DB connection ----
  const [host, setHost] = useState("");
  const [port, setPort] = useState("3306");
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [database, setDatabase] = useState("");

  // ---- SSH tunnel ----
  const [useSsh, setUseSsh] = useState(false);
  const [sshHost, setSshHost] = useState("");
  const [sshPort, setSshPort] = useState("22");
  const [sshUser, setSshUser] = useState("");
  const [authMethod, setAuthMethod] = useState<AuthMethod>("privateKey");
  const [sshPassword, setSshPassword] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const keyFileRef = useRef<HTMLInputElement>(null);

  // ---- query ----
  const [query, setQuery] = useState("SELECT VERSION() AS version, NOW() AS now;");
  const [readOnly, setReadOnly] = useState(true);

  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QueryResult | null>(null);

  // ---- connections list ----
  const [connections, setConnections] = useState<ConnectionInfo[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadConnections = useCallback(async () => {
    try {
      const res = await fetch("/api/db/connections", { cache: "no-store" });
      const data = await res.json();
      if (data.ok) setConnections(data.connections);
    } catch {
      /* ignore transient refresh errors */
    }
  }, []);

  useEffect(() => {
    void loadConnections();
    const id = setInterval(() => void loadConnections(), 3000);
    return () => clearInterval(id);
  }, [loadConnections]);

  async function onKeyFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setPrivateKey(await file.text());
  }

  function buildBody() {
    const body: Record<string, unknown> = {
      connection: {
        host: host.trim(),
        port: Number(port) || 3306,
        user: user.trim(),
        password,
        database: database.trim() || undefined,
      },
      query,
      readOnly,
      label: `${user.trim()}@${host.trim()}`,
    };
    if (useSsh) {
      body.ssh = {
        host: sshHost.trim(),
        port: Number(sshPort) || 22,
        username: sshUser.trim(),
        auth:
          authMethod === "password"
            ? { method: "password", password: sshPassword }
            : { method: "privateKey", privateKey, passphrase: passphrase || undefined },
      };
    }
    return body;
  }

  async function run() {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/db/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody()),
      });
      const data = await res.json();
      if (!data.ok) setError(data.error);
      else setResult(data as QueryResult);
      void loadConnections();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setRunning(false);
    }
  }

  async function closeConn(id: string) {
    setBusyId(id);
    try {
      await fetch(`/api/db/connections/${id}`, { method: "DELETE" });
      await loadConnections();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Databases</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Temporary admin view of the pooled MySQL runner — connect (directly or via SSH) and run queries.
        </p>
      </header>

      <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
        ⚠ Temporary dashboard — no authentication. Credentials are used to open pools and are held in
        memory only. Gate behind real admin auth before production.
      </div>

      {/* Connection */}
      <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Database</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Host">
            <input className={inputCls} value={host} onChange={(e) => setHost(e.target.value)} />
          </Field>
          <Field label="Port">
            <input className={inputCls} value={port} onChange={(e) => setPort(e.target.value)} />
          </Field>
          <Field label="User">
            <input className={inputCls} value={user} onChange={(e) => setUser(e.target.value)} />
          </Field>
          <Field label="Password">
            <input
              type="password"
              className={inputCls}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Field label="Database (optional)">
            <input className={inputCls} value={database} onChange={(e) => setDatabase(e.target.value)} />
          </Field>
        </div>
      </section>

      {/* SSH */}
      <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <label className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          <input type="checkbox" checked={useSsh} onChange={(e) => setUseSsh(e.target.checked)} />
          Connect via SSH tunnel
        </label>
        {useSsh && (
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
                  value={sshPassword}
                  onChange={(e) => setSshPassword(e.target.value)}
                />
              </Field>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Private key (PEM)">
                  <textarea
                    className={`${inputCls} h-24 font-mono`}
                    placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                    value={privateKey}
                    onChange={(e) => setPrivateKey(e.target.value)}
                  />
                  <button className={`${btnCls} mt-1`} type="button" onClick={() => keyFileRef.current?.click()}>
                    Load key file…
                  </button>
                  <input ref={keyFileRef} type="file" className="hidden" onChange={onKeyFile} />
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
          </div>
        )}
      </section>

      {/* Query */}
      <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <Field label="SQL query">
          <textarea
            className={`${inputCls} h-28 font-mono`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </Field>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <button
            onClick={() => void run()}
            disabled={running || !host || !user}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {running ? "Running…" : "Run query"}
          </button>
          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input type="checkbox" checked={readOnly} onChange={(e) => setReadOnly(e.target.checked)} />
            Read-only (block writes/DDL)
          </label>
        </div>
      </section>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {result && (
        <section className="space-y-2">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {result.rowCount} row(s) · {result.durationMs} ms
            {result.tunneled ? " · via SSH tunnel" : ""} · pool {result.connectionId}
          </p>
          <ResultTable result={result} />
        </section>
      )}

      {/* Connections */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Active connections ({connections.length})
        </h2>
        <div className="overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-zinc-100 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                {["Status", "Database", "Tunnel", "Pool", "Queries", "Errors", "Last activity", ""].map((h) => (
                  <th key={h} className="border-b border-zinc-200 px-3 py-2 font-medium dark:border-zinc-800">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {connections.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-zinc-500 dark:text-zinc-400">
                    No active connections.
                  </td>
                </tr>
              )}
              {connections.map((c) => (
                <tr key={c.id} className="even:bg-zinc-50 dark:even:bg-zinc-900/40">
                  <td className="border-b border-zinc-100 px-3 py-2 dark:border-zinc-800/50">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        STATUS_COLORS[c.status] ?? STATUS_COLORS.closed
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="border-b border-zinc-100 px-3 py-2 font-mono text-xs text-zinc-700 dark:border-zinc-800/50 dark:text-zinc-300">
                    {c.db.user}@{c.db.host}:{c.db.port}
                    {c.db.database ? `/${c.db.database}` : ""}
                    <span className="block text-[11px] text-zinc-400">{c.id}</span>
                  </td>
                  <td className="border-b border-zinc-100 px-3 py-2 text-xs text-zinc-700 dark:border-zinc-800/50 dark:text-zinc-300">
                    {c.tunneled ? `yes (${c.localEndpoint?.host}:${c.localEndpoint?.port})` : "no"}
                  </td>
                  <td className="border-b border-zinc-100 px-3 py-2 text-zinc-700 dark:border-zinc-800/50 dark:text-zinc-300">
                    {c.activeQueries} active / {c.connectionLimit} max
                  </td>
                  <td className="border-b border-zinc-100 px-3 py-2 text-zinc-700 dark:border-zinc-800/50 dark:text-zinc-300">
                    {c.totalQueries}
                  </td>
                  <td className="border-b border-zinc-100 px-3 py-2 text-zinc-700 dark:border-zinc-800/50 dark:text-zinc-300">
                    {c.errors}
                  </td>
                  <td className="border-b border-zinc-100 px-3 py-2 text-zinc-500 dark:border-zinc-800/50 dark:text-zinc-400">
                    {ago(c.lastActivityAt)}
                  </td>
                  <td className="border-b border-zinc-100 px-3 py-2 dark:border-zinc-800/50">
                    <button
                      className={btnCls}
                      disabled={busyId === c.id}
                      onClick={() => void closeConn(c.id)}
                    >
                      Close
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ResultTable({ result }: { result: QueryResult }) {
  const { rows } = result;

  if (!Array.isArray(rows)) {
    return (
      <pre className="overflow-auto rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
        {JSON.stringify(rows, null, 2)}
      </pre>
    );
  }
  if (rows.length === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">No rows returned.</p>;
  }

  const columns =
    result.fields.length > 0
      ? result.fields.map((f) => f.name)
      : Object.keys(rows[0] as Record<string, unknown>);

  return (
    <div className="max-h-[28rem] overflow-auto rounded-md border border-zinc-200 dark:border-zinc-800">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="sticky top-0 bg-zinc-100 dark:bg-zinc-900">
          <tr>
            {columns.map((col) => (
              <th
                key={col}
                className="border-b border-zinc-200 px-3 py-2 font-medium text-zinc-700 dark:border-zinc-800 dark:text-zinc-300"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(rows as Record<string, unknown>[]).map((row, i) => (
            <tr key={i} className="even:bg-zinc-50 dark:even:bg-zinc-900/50">
              {columns.map((col) => (
                <td
                  key={col}
                  className="border-b border-zinc-100 px-3 py-2 text-zinc-800 dark:border-zinc-800/50 dark:text-zinc-200"
                >
                  {formatCell(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
