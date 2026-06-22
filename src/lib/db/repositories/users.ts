import { db } from "../client";
import type { User } from "@/types/db";

export interface UserInput {
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  /** Pre-hashed password (never pass plaintext). */
  password?: string;
  status?: "pending" | "active" | "rejected" | "deleted";
}

export const usersRepository = {
  create(input: UserInput): User {
    const info = db
      .prepare(
        `INSERT INTO users (username, first_name, last_name, email, password, status)
         VALUES (@username, @first_name, @last_name, @email, @password, @status)`,
      )
      .run({
        username: input.username,
        first_name: input.firstName ?? null,
        last_name: input.lastName ?? null,
        email: input.email,
        password: input.password ?? null,
        status: input.status ?? "active",
      });
    return this.getById(Number(info.lastInsertRowid))!;
  },

  getById(id: number): User | undefined {
    return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as User | undefined;
  },

  getByEmail(email: string): User | undefined {
    return db.prepare("SELECT * FROM users WHERE email = ?").get(email) as User | undefined;
  },

  getByUsername(username: string): User | undefined {
    return db.prepare("SELECT * FROM users WHERE username = ?").get(username) as User | undefined;
  },

  /** Look up by email OR username (for login). */
  getByEmailOrUsername(identifier: string): User | undefined {
    return db
      .prepare("SELECT * FROM users WHERE email = ? OR username = ? LIMIT 1")
      .get(identifier, identifier) as User | undefined;
  },

  list(): User[] {
    return db.prepare("SELECT * FROM users ORDER BY username").all() as User[];
  },

  listByStatus(status: string): User[] {
    return db
      .prepare("SELECT * FROM users WHERE status = ? ORDER BY created_at DESC")
      .all(status) as User[];
  },

  count(): number {
    return (db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n;
  },

  /** Patch only the provided columns. Keys must be real column names. */
  update(
    id: number,
    patch: Partial<Pick<User, "username" | "email" | "first_name" | "last_name" | "status" | "password">>,
  ): User | undefined {
    const entries = Object.entries(patch).filter(([, v]) => v !== undefined);
    if (entries.length > 0) {
      const set = entries.map(([k]) => `${k} = @${k}`).join(", ");
      db.prepare(`UPDATE users SET ${set} WHERE id = @id`).run({ ...Object.fromEntries(entries), id });
    }
    return this.getById(id);
  },

  delete(id: number): void {
    db.prepare("DELETE FROM users WHERE id = ?").run(id);
  },
};
