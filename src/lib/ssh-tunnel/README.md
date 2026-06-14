# ssh-tunnel (in-process)

An in-process SSH **tunnel manager**. It runs inside the query-optimizer process
(no separate service, no separate container), holds persistent SSH connections,
and exposes a loopback `127.0.0.1:<port>` per tunnel that forwards to any target
(e.g. a database) reachable *from the SSH host*.

It is self-contained and knows nothing about MySQL. A consumer such as the
**mysql-runner** points its own `mysql2` pool at the returned host:port.

> 📖 **Full documentation:** [`docs/SSH_TUNNEL_SERVICE.md`](../../../docs/SSH_TUNNEL_SERVICE.md)
> — architecture, complete API reference, HTTP/dashboard usage, configuration,
> security model, lifecycle, and troubleshooting. This file is the quick reference.

## Why in-process

- **Single container.** Everything is one Node process — the tunnel is just a
  library import, not a network hop.
- **Persistent + pooled.** SSH handshakes are expensive. Identical (`ssh` + `target`)
  requests share one SSH connection, deduped by fingerprint and **refcounted**.
  Connections are kept alive with SSH keepalives and auto-reconnected on drop.
- **Secure by default.** Listeners bind to `127.0.0.1` only — nothing is exposed
  on the network. Credentials live in memory for the life of the tunnel and never
  hit logs (the manager only logs ids, endpoints, ports, counts).

## API

```ts
import { acquireTunnel, openTunnel, closeTunnel, listTunnels } from "@/lib/ssh-tunnel";
```

| Function | Purpose |
| --- | --- |
| `acquireTunnel(opts)` | Open/join a tunnel; returns `{ id, host, port, release() }`. Throws if SSH isn't ready. **Preferred entry point.** |
| `openTunnel(opts)` | Open/join and return full `TunnelInfo`. |
| `closeTunnel(id, force?)` | Release one reference; closes at refcount 0 (or immediately if `force`). |
| `getTunnel(id)` / `listTunnels()` | Inspect current tunnels (secret-free). |

`opts: OpenTunnelOptions`:

```ts
{
  ssh: {
    host, port?,            // port defaults to 22
    username,
    auth: { method: "password", password }
        | { method: "privateKey", privateKey, passphrase? },
    expectedHostKeySha256?, // optional host-key pinning
  },
  target: { host, port },   // host:port as seen FROM the ssh host (the DB)
  idleTimeoutMs?,           // 0 = persistent (default); >0 auto-closes when idle
  label?,
}
```

## How the mysql-runner will use it

Acquire a tunnel, build a pool against the loopback port, and tie the pool's
lifetime to the tunnel reference:

```ts
import mysql from "mysql2/promise";
import { acquireTunnel } from "@/lib/ssh-tunnel";

const tunnel = await acquireTunnel({
  ssh,                                   // SshConfig
  target: { host: "db.internal", port: 3306 },
});

const pool = mysql.createPool({
  host: tunnel.host,                     // 127.0.0.1
  port: tunnel.port,                     // ephemeral local port
  user, password, database,
  connectionLimit: 10,                   // mysql-runner owns DB pooling
});

// ... run queries via pool ...

// on teardown / idle cleanup:
await pool.end();
await tunnel.release();                  // tunnel closes when the last holder releases
```

Because the tunnel is refcounted, multiple runners targeting the same DB through
the same SSH host share one SSH connection — each keeps its own `mysql2` pool, and
the tunnel only tears down once every holder has released.

Tuning is via optional env vars (all have defaults) — see `config.ts`
(`SSH_TUNNEL_IDLE_TIMEOUT_MS`, `SSH_TUNNEL_KEEPALIVE_MS`, `SSH_TUNNEL_MAX`, ...).

## Test

```bash
npm run test:tunnel                       # uses mihir/test/config/ssh_tunnel.txt
npm run test:tunnel -- path/to/config.txt
# override the DB target probed:
SSH_TUNNEL_TEST_TARGET_HOST=127.0.0.1 SSH_TUNNEL_TEST_TARGET_PORT=3306 npm run test:tunnel
```
