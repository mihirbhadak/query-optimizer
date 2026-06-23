"use client";

import { useState, useTransition } from "react";

import { cn } from "@/lib/utils";
import {
  DB_ENGINES,
  SSH_AUTH_METHODS,
  SSL_MODES,
  type ConnectionConfig,
  type TestResult,
} from "@/lib/databases/types";
import type { SafeDatabase } from "@/lib/db";
import type { DbEngine, SshAuthMethod, SslMode } from "@/types/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { createDatabase, testConnection, testTunnel, updateDatabase } from "./actions";

const SSL_LABELS: Record<SslMode, string> = {
  disabled: "Disabled",
  require: "Require (verify cert)",
  require_no_verify: "Require (skip verify)",
};

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function ResultBanner({ result }: { result: TestResult | null }) {
  if (!result) return null;
  return (
    <p
      className={cn(
        "rounded-md border px-3 py-2 text-sm",
        result.ok
          ? "border-green-300 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300"
          : "border-destructive/30 bg-destructive/10 text-destructive",
      )}
    >
      {result.ok ? "✓ " : "✗ "}
      {result.message}
      {result.durationMs != null ? ` (${result.durationMs}ms)` : ""}
    </p>
  );
}

const initial = {
  name: "",
  engine: "mysql",
  host: "",
  port: "3306",
  username: "",
  password: "",
  dbName: "",
  sslMode: "disabled",
  useSsh: false,
  sshHost: "",
  sshPort: "22",
  sshUsername: "",
  sshAuthMethod: "password",
  sshPassword: "",
  sshPrivateKey: "",
  sshPrivateKeyFile: "",
  sshPassphrase: "",
};

function initialState(database?: SafeDatabase): typeof initial {
  if (!database) return initial;
  return {
    name: database.name,
    engine: database.engine,
    host: database.host,
    port: String(database.port),
    username: database.username,
    password: "",
    dbName: database.db_name ?? "",
    sslMode: database.ssl_mode,
    useSsh: database.connection_method === "ssh",
    sshHost: database.ssh_host ?? "",
    sshPort: String(database.ssh_port ?? 22),
    sshUsername: database.ssh_username ?? "",
    sshAuthMethod: database.ssh_auth_method ?? "password",
    sshPassword: "",
    sshPrivateKey: "",
    sshPrivateKeyFile: "",
    sshPassphrase: "",
  };
}

export function DatabaseForm({ slug, database }: { slug: string; database?: SafeDatabase }) {
  const isEdit = !!database;
  const [f, setF] = useState(() => initialState(database));
  const set = <K extends keyof typeof initial>(k: K, v: (typeof initial)[K]) =>
    setF((prev) => ({ ...prev, [k]: v }));

  const [error, setError] = useState<string | null>(null);
  const [tunnelResult, setTunnelResult] = useState<TestResult | null>(null);
  const [connResult, setConnResult] = useState<TestResult | null>(null);
  const [busy, setBusy] = useState<"save" | "tunnel" | "conn" | null>(null);
  const [, startTransition] = useTransition();

  function config(): ConnectionConfig {
    const ssh = f.useSsh;
    const isKey = f.sshAuthMethod === "privateKey";
    return {
      name: f.name.trim(),
      engine: f.engine as DbEngine,
      host: f.host.trim(),
      port: Number(f.port) || 3306,
      username: f.username.trim(),
      password: f.password || undefined,
      dbName: f.dbName.trim() || undefined,
      sslMode: f.sslMode as SslMode,
      connectionMethod: ssh ? "ssh" : "direct",
      sshHost: ssh ? f.sshHost.trim() : undefined,
      sshPort: ssh ? Number(f.sshPort) || 22 : undefined,
      sshUsername: ssh ? f.sshUsername.trim() : undefined,
      sshAuthMethod: ssh ? (f.sshAuthMethod as SshAuthMethod) : undefined,
      sshPassword: ssh && !isKey ? f.sshPassword : undefined,
      sshPrivateKey: ssh && isKey ? f.sshPrivateKey : undefined,
      sshPassphrase: ssh && isKey ? f.sshPassphrase || undefined : undefined,
    };
  }

  function runTest(which: "tunnel" | "conn") {
    setBusy(which);
    if (which === "tunnel") setTunnelResult(null);
    else setConnResult(null);
    startTransition(async () => {
      const fn = which === "tunnel" ? testTunnel : testConnection;
      const r = await fn(config());
      if (which === "tunnel") setTunnelResult(r);
      else setConnResult(r);
      setBusy(null);
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy("save");
    startTransition(async () => {
      const r = isEdit
        ? await updateDatabase(slug, database!.id, config())
        : await createDatabase(slug, config());
      if (r?.error) {
        setError(r.error);
        setBusy(null);
      }
    });
  }

  async function onKeyFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      set("sshPrivateKey", await file.text());
      set("sshPrivateKeyFile", file.name);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-6">
      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {/* Connection details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connection</CardTitle>
          <CardDescription>How to reach the database server.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Database name" htmlFor="name">
              <Input id="name" value={f.name} onChange={(e) => set("name", e.target.value)} required placeholder="Production replica" />
            </Field>
            <Field label="Connection type">
              <Select value={f.engine} onValueChange={(v) => set("engine", v)}>
                <SelectTrigger className="capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DB_ENGINES.map((e) => (
                    <SelectItem key={e} value={e} className="capitalize">
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Field label="Host" htmlFor="host">
                <Input id="host" value={f.host} onChange={(e) => set("host", e.target.value)} required placeholder="db.internal" />
              </Field>
            </div>
            <Field label="Port" htmlFor="port">
              <Input id="port" value={f.port} onChange={(e) => set("port", e.target.value)} inputMode="numeric" />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="User" htmlFor="username">
              <Input id="username" value={f.username} onChange={(e) => set("username", e.target.value)} required autoComplete="off" />
            </Field>
            <Field label="Password" htmlFor="password">
              <Input
                id="password"
                type="password"
                value={f.password}
                onChange={(e) => set("password", e.target.value)}
                autoComplete="new-password"
                placeholder={isEdit && database?.has_password ? "Leave blank to keep current" : undefined}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Default database (optional)" htmlFor="dbName">
              <Input id="dbName" value={f.dbName} onChange={(e) => set("dbName", e.target.value)} />
            </Field>
            <Field label="TLS / SSL">
              <Select value={f.sslMode} onValueChange={(v) => set("sslMode", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SSL_MODES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {SSL_LABELS[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* SSH tunnel */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Checkbox id="useSsh" checked={f.useSsh} onCheckedChange={(c) => set("useSsh", c === true)} />
            <Label htmlFor="useSsh" className="text-base font-semibold">
              Connect via SSH tunnel
            </Label>
          </div>
          <CardDescription>Reach the database through a bastion / jump host.</CardDescription>
        </CardHeader>
        {f.useSsh ? (
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <Field label="SSH host" htmlFor="sshHost">
                  <Input id="sshHost" value={f.sshHost} onChange={(e) => set("sshHost", e.target.value)} placeholder="bastion.example.com" />
                </Field>
              </div>
              <Field label="SSH port" htmlFor="sshPort">
                <Input id="sshPort" value={f.sshPort} onChange={(e) => set("sshPort", e.target.value)} inputMode="numeric" />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="SSH user" htmlFor="sshUsername">
                <Input id="sshUsername" value={f.sshUsername} onChange={(e) => set("sshUsername", e.target.value)} autoComplete="off" />
              </Field>
              <Field label="SSH authentication">
                <Select value={f.sshAuthMethod} onValueChange={(v) => set("sshAuthMethod", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SSH_AUTH_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m === "password" ? "Password" : "Private key"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {f.sshAuthMethod === "password" ? (
              <Field label="SSH password" htmlFor="sshPassword">
                <Input id="sshPassword" type="password" value={f.sshPassword} onChange={(e) => set("sshPassword", e.target.value)} autoComplete="new-password" />
              </Field>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Private key (PEM)">
                  <Textarea
                    className="h-28 font-mono text-xs"
                    placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                    value={f.sshPrivateKey}
                    onChange={(e) => set("sshPrivateKey", e.target.value)}
                  />
                  <label className="mt-1 inline-flex cursor-pointer items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
                    <input type="file" className="hidden" onChange={onKeyFile} />
                    <span className="underline">Load key file…</span>
                    {f.sshPrivateKeyFile ? <span>{f.sshPrivateKeyFile}</span> : null}
                  </label>
                </Field>
                <Field label="Key passphrase (optional)" htmlFor="sshPassphrase">
                  <Input id="sshPassphrase" type="password" value={f.sshPassphrase} onChange={(e) => set("sshPassphrase", e.target.value)} autoComplete="new-password" />
                </Field>
              </div>
            )}

            <div className="space-y-2">
              <Button type="button" variant="outline" size="sm" disabled={busy !== null} onClick={() => runTest("tunnel")}>
                {busy === "tunnel" ? "Testing tunnel…" : "Test tunnel"}
              </Button>
              <ResultBanner result={tunnelResult} />
            </div>
          </CardContent>
        ) : null}
      </Card>

      {/* Actions */}
      <div className="space-y-3">
        <ResultBanner result={connResult} />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={busy !== null} onClick={() => runTest("conn")}>
            {busy === "conn" ? "Testing connection…" : "Test database connection"}
          </Button>
          <Button type="submit" disabled={busy !== null}>
            {busy === "save" ? "Saving…" : isEdit ? "Save changes" : "Save database"}
          </Button>
        </div>
      </div>
    </form>
  );
}
