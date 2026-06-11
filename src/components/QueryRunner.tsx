"use client";

import { useState } from "react";
import type {
  RunQueryRequest,
  RunQueryResult,
  TestTunnelRequest,
  TestTunnelResult,
} from "@/lib/mysql/types";

type ApiResponse =
  | ({ ok: true } & RunQueryResult)
  | { ok: false; error: string };

type TunnelResponse =
  | ({ ok: true } & TestTunnelResult)
  | { ok: false; error: string };

const inputCls =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";
const labelCls = "mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      {children}
    </label>
  );
}

export default function QueryRunner() {
  // ---- MySQL connection ----
  const [host, setHost] = useState("127.0.0.1");
  const [port, setPort] = useState("3306");
  const [user, setUser] = useState("root");
  const [password, setPassword] = useState("");
  const [database, setDatabase] = useState("");

  // ---- options ----
  const [multipleStatements, setMultipleStatements] = useState(false);
  const [useSsl, setUseSsl] = useState(false);
  const [sslRejectUnauthorized, setSslRejectUnauthorized] = useState(true);
  const [connectTimeout, setConnectTimeout] = useState("10000");

  // ---- SSH tunnel ----
  const [useSsh, setUseSsh] = useState(false);
  const [sshHost, setSshHost] = useState("");
  const [sshPort, setSshPort] = useState("22");
  const [sshUser, setSshUser] = useState("");
  const [sshAuthMethod, setSshAuthMethod] = useState<"password" | "privateKey">("password");
  const [sshPassword, setSshPassword] = useState("");
  const [sshPrivateKey, setSshPrivateKey] = useState("");
  const [sshPrivateKeyFileName, setSshPrivateKeyFileName] = useState("");
  const [sshPassphrase, setSshPassphrase] = useState("");

  // ---- query ----
  const [query, setQuery] = useState("SELECT 1 AS ok;");

  // ---- run state ----
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RunQueryResult | null>(null);

  // ---- tunnel-test state ----
  const [testingTunnel, setTestingTunnel] = useState(false);
  const [tunnelStatus, setTunnelStatus] = useState<
    { ok: boolean; message: string } | null
  >(null);

  function buildSshConfig(): NonNullable<RunQueryRequest["ssh"]> {
    return {
      host: sshHost.trim(),
      port: Number(sshPort) || 22,
      username: sshUser.trim(),
      auth:
        sshAuthMethod === "password"
          ? { method: "password", password: sshPassword }
          : {
              method: "privateKey",
              privateKey: sshPrivateKey,
              passphrase: sshPassphrase || undefined,
            },
    };
  }

  function buildRequest(): RunQueryRequest {
    const req: RunQueryRequest = {
      connection: {
        host: host.trim(),
        port: Number(port) || 3306,
        user: user.trim(),
        password,
        database: database.trim() || undefined,
        multipleStatements,
        connectTimeout: Number(connectTimeout) || undefined,
        ssl: useSsl ? { rejectUnauthorized: sslRejectUnauthorized } : undefined,
      },
      query,
    };

    if (useSsh) req.ssh = buildSshConfig();

    return req;
  }

  async function handleTestTunnel() {
    setTestingTunnel(true);
    setTunnelStatus(null);
    try {
      const payload: TestTunnelRequest = {
        ssh: buildSshConfig(),
      };
      const res = await fetch("/api/test-tunnel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data: TunnelResponse = await res.json();
      setTunnelStatus(
        data.ok ? { ok: true, message: data.message } : { ok: false, message: data.error },
      );
    } catch (err) {
      setTunnelStatus({
        ok: false,
        message: err instanceof Error ? err.message : "Request failed.",
      });
    } finally {
      setTestingTunnel(false);
    }
  }

  async function handleKeyFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSshPrivateKeyFileName(file.name);
    setSshPrivateKey(await file.text());
  }

  async function handleRun() {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildRequest()),
      });
      const data: ApiResponse = await res.json();
      if (!data.ok) {
        setError(data.error);
      } else {
        setResult(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          MySQL Query Runner
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Connect to any MySQL server — directly or through an SSH tunnel — and run a query.
        </p>
      </header>

      {/* Connection */}
      <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Connection
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            <input
              className={inputCls}
              value={database}
              onChange={(e) => setDatabase(e.target.value)}
            />
          </Field>
          <Field label="Connect timeout (ms)">
            <input
              className={inputCls}
              value={connectTimeout}
              onChange={(e) => setConnectTimeout(e.target.value)}
            />
          </Field>
        </div>

        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-zinc-700 dark:text-zinc-300">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={multipleStatements}
              onChange={(e) => setMultipleStatements(e.target.checked)}
            />
            Allow multiple statements
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={useSsl} onChange={(e) => setUseSsl(e.target.checked)} />
            Use TLS/SSL
          </label>
          {useSsl && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={sslRejectUnauthorized}
                onChange={(e) => setSslRejectUnauthorized(e.target.checked)}
              />
              Reject unauthorized certs
            </label>
          )}
        </div>
      </section>

      {/* SSH tunnel */}
      <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <label className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          <input type="checkbox" checked={useSsh} onChange={(e) => setUseSsh(e.target.checked)} />
          Connect via SSH tunnel
        </label>

        {useSsh && (
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="SSH host">
                <input
                  className={inputCls}
                  value={sshHost}
                  onChange={(e) => setSshHost(e.target.value)}
                />
              </Field>
              <Field label="SSH port">
                <input
                  className={inputCls}
                  value={sshPort}
                  onChange={(e) => setSshPort(e.target.value)}
                />
              </Field>
              <Field label="SSH user">
                <input
                  className={inputCls}
                  value={sshUser}
                  onChange={(e) => setSshUser(e.target.value)}
                />
              </Field>
            </div>

            <div className="flex gap-4 text-sm text-zinc-700 dark:text-zinc-300">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="sshAuth"
                  checked={sshAuthMethod === "password"}
                  onChange={() => setSshAuthMethod("password")}
                />
                Password
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="sshAuth"
                  checked={sshAuthMethod === "privateKey"}
                  onChange={() => setSshAuthMethod("privateKey")}
                />
                Private key
              </label>
            </div>

            {sshAuthMethod === "password" ? (
              <Field label="SSH password">
                <input
                  type="password"
                  className={inputCls}
                  value={sshPassword}
                  onChange={(e) => setSshPassword(e.target.value)}
                />
              </Field>
            ) : (
              <div className="space-y-3">
                <Field label="Private key (PEM)">
                  <div className="mb-2 flex items-center gap-3">
                    <label className="cursor-pointer rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
                      Choose key file…
                      <input
                        type="file"
                        className="hidden"
                        onChange={handleKeyFile}
                      />
                    </label>
                    {sshPrivateKeyFileName && (
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {sshPrivateKeyFileName}
                      </span>
                    )}
                  </div>
                  <textarea
                    className={`${inputCls} h-32 font-mono`}
                    placeholder="-----BEGIN OPENSSH PRIVATE KEY----- (or choose a file above)"
                    value={sshPrivateKey}
                    onChange={(e) => {
                      setSshPrivateKey(e.target.value);
                      if (sshPrivateKeyFileName) setSshPrivateKeyFileName("");
                    }}
                  />
                </Field>
                <Field label="Key passphrase (optional)">
                  <input
                    type="password"
                    className={inputCls}
                    value={sshPassphrase}
                    onChange={(e) => setSshPassphrase(e.target.value)}
                  />
                </Field>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleTestTunnel}
                disabled={testingTunnel}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {testingTunnel ? "Testing…" : "Test SSH connection"}
              </button>
              {tunnelStatus && (
                <span
                  className={`text-sm ${
                    tunnelStatus.ok
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {tunnelStatus.ok ? "✓ " : "✕ "}
                  {tunnelStatus.message}
                </span>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Query */}
      <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <Field label="SQL query">
          <textarea
            className={`${inputCls} h-32 font-mono`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </Field>
        <button
          onClick={handleRun}
          disabled={running}
          className="mt-3 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {running ? "Running…" : "Run query"}
        </button>
      </section>

      {/* Results */}
      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {result && (
        <section className="space-y-2">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {result.rowCount} row(s) · {result.durationMs} ms
            {result.tunneled ? " · via SSH tunnel" : ""}
          </p>
          <ResultTable result={result} />
        </section>
      )}
    </div>
  );
}

function ResultTable({ result }: { result: RunQueryResult }) {
  const { rows } = result;

  // Non-SELECT (INSERT/UPDATE/DDL): mysql2 returns a result-header object.
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
    <div className="overflow-auto rounded-md border border-zinc-200 dark:border-zinc-800">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-zinc-100 dark:bg-zinc-900">
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
