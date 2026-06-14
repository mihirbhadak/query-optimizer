import { db } from "../client";
import type { User } from "@/types/db";

export interface UserInput {
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  /** Pre-hashed password (never pass plaintext). */
  password?: string;
  status?: "active" | "disabled";
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

  list(): User[] {
    return db.prepare("SELECT * FROM users ORDER BY username").all() as User[];
  },

  delete(id: number): void {
    db.prepare("DELETE FROM users WHERE id = ?").run(id);
  },
};
