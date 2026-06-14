import { db } from "../client";
import type { Workspace } from "@/types/db";

/**
 * Workspace data access. All workspace reads/writes go through here
 * (architecture rule: database access only through repositories).
 */
export const workspacesRepository = {
  create(input: { name: string; slug: string; description?: string }): Workspace {
    const info = db
      .prepare("INSERT INTO workspaces (name, slug, description) VALUES (@name, @slug, @description)")
      .run({ description: null, ...input });
    return this.getById(Number(info.lastInsertRowid))!;
  },

  getById(id: number): Workspace | undefined {
    return db.prepare("SELECT * FROM workspaces WHERE id = ?").get(id) as Workspace | undefined;
  },

  getBySlug(slug: string): Workspace | undefined {
    return db.prepare("SELECT * FROM workspaces WHERE slug = ?").get(slug) as Workspace | undefined;
  },

  list(): Workspace[] {
    return db.prepare("SELECT * FROM workspaces ORDER BY name").all() as Workspace[];
  },

  delete(id: number): void {
    db.prepare("DELETE FROM workspaces WHERE id = ?").run(id);
  },
};
