/**
 * Lightweight read-only guard. When a query is run with `readOnly: true`, every
 * statement must be a read. This is a defence-in-depth convenience, not a full
 * SQL parser — enforce real authorization at the database user level too.
 */

const READ_KEYWORDS = new Set(["select", "show", "describe", "desc", "explain", "with"]);

/** Strip line/block comments, then split on `;` into trimmed statements. */
function statements(sql: string): string[] {
  const noComments = sql
    .replace(/\/\*[\s\S]*?\*\//g, " ") // /* ... */
    .replace(/--[^\n]*/g, " ") // -- ...
    .replace(/#[^\n]*/g, " "); // # ...
  return noComments
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

function leadingKeyword(stmt: string): string {
  return (stmt.match(/^[a-zA-Z]+/)?.[0] ?? "").toLowerCase();
}

/** Throws if any statement isn't a read. */
export function assertReadOnly(sql: string): void {
  for (const stmt of statements(sql)) {
    const kw = leadingKeyword(stmt);
    if (!READ_KEYWORDS.has(kw)) {
      throw new Error(
        `Read-only mode: statement starting with "${kw || "?"}" is not allowed. ` +
          `Permitted: ${[...READ_KEYWORDS].join(", ").toUpperCase()}.`,
      );
    }
  }
}
