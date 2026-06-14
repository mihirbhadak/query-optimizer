# mysql-runner (in-process, pooled)

Connect to any MySQL database — directly or through an SSH tunnel — and run
queries, with **one persistent connection pool per unique database**. Many
databases can be active at once. Runs inside the query-optimizer process (single
container) and uses the [`ssh-tunnel`](../ssh-tunnel/README.md) library for the
SSH part.

> 📖 **Full documentation:** [`docs/MYSQL_RUNNER_SERVICE.md`](../../../docs/MYSQL_RUNNER_SERVICE.md)
> — architecture, complete API reference, HTTP/dashboard usage, configuration,
> security model, lifecycle, and troubleshooting. This file is the quick reference.

## Quick start

```ts
import { runQuery } from "@/lib/mysql-runner";

// Direct
const a = await runQuery({
  connection: { host: "127.0.0.1", user: "root", password, database: "shop" },
  query: "SELECT * FROM products WHERE id = ?",
  params: [42],
  readOnly: true,
});

// Through an SSH tunnel
const b = await runQuery({
  connection: { host: "replica.internal", user: "app", password },
  ssh: { host: "bastion", username: "ubuntu", auth: { method: "privateKey", privateKey: pem } },
  query: "SELECT VERSION() AS version",
  readOnly: true,
});
// b.tunneled === true
```

## API

| Function | Purpose |
| --- | --- |
| `runQuery(opts)` | Open/reuse a pool and run a query. |
| `runQueryOn(id, query, params?, readOnly?)` | Run on an already-open pool by id. |
| `ensureConnection(opts)` | Open/reuse a pool without querying (test/pre-warm). |
| `listConnections()` / `getConnection(id)` | Inspect pools (secret-free). |
| `closeConnection(id)` | Close a pool and release its tunnel. |

## Interfaces

- **HTTP:** `POST /api/db/query`, `GET|POST /api/db/connections`, `GET|DELETE /api/db/connections/[id]`
- **Dashboard:** `/test/databases`

## Test

```bash
npm run test:db                       # uses mihir/test/config/database.txt
npm run test:db -- path/to/config.txt
```

Key behaviours: pools are keyed by destination (incl. `database` + ssh path),
persist across queries, idle-reap after 60s (configurable), and fail fast on bad
credentials. Tuning is via `MYSQL_RUNNER_*` env vars — see `config.ts`.
