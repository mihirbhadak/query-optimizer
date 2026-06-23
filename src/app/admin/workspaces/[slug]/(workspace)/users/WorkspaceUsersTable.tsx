"use client";

import { useMemo, useState, useTransition } from "react";
import { Search } from "lucide-react";

import { WORKSPACE_ROLES } from "@/lib/workspaces/constants";
import type { WorkspaceRole } from "@/types/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { removeMembers, setMembersRole } from "../../../actions";

export interface UserRow {
  id: number;
  username: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: WorkspaceRole | null;
}

export function WorkspaceUsersTable({
  workspaceId,
  rows,
}: {
  workspaceId: number;
  rows: UserRow[];
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkRole, setBulkRole] = useState<WorkspaceRole>("member");
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.username, r.email, r.first_name ?? "", r.last_name ?? ""].some((v) =>
        v.toLowerCase().includes(q),
      ),
    );
  }, [rows, search]);

  const allSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));
  const someSelected = filtered.some((r) => selected.has(r.id));
  const selectedIds = [...selected];

  const setMany = (ids: number[], add: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (add ? next.add(id) : next.delete(id)));
      return next;
    });

  const run = (fn: () => Promise<void>) =>
    startTransition(async () => {
      await fn();
      setSelected(new Set());
    });

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, username…"
            className="pl-8"
          />
        </div>
        {selected.size > 0 ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{selected.size} selected</span>
            <Select value={bulkRole} onValueChange={(v) => setBulkRole(v as WorkspaceRole)}>
              <SelectTrigger className="h-9 w-32 capitalize">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WORKSPACE_ROLES.map((r) => (
                  <SelectItem key={r} value={r} className="capitalize">
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={pending}
              onClick={() => run(() => setMembersRole(workspaceId, selectedIds, bulkRole))}
            >
              Assign role
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive"
              disabled={pending}
              onClick={() => run(() => removeMembers(workspaceId, selectedIds))}
            >
              Remove
            </Button>
          </div>
        ) : null}
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={(c) => setMany(filtered.map((r) => r.id), c === true)}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead className="w-16">ID</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>First name</TableHead>
              <TableHead>Last name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.id} data-state={selected.has(r.id) ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(r.id)}
                      onCheckedChange={(c) => setMany([r.id], c === true)}
                      aria-label={`Select ${r.username}`}
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.id}</TableCell>
                  <TableCell className="font-medium">{r.username}</TableCell>
                  <TableCell>{r.first_name || "—"}</TableCell>
                  <TableCell>{r.last_name || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{r.email}</TableCell>
                  <TableCell>
                    {r.role ? (
                      <Badge variant="secondary" className="capitalize">
                        {r.role}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not a member</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.role ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        disabled={pending}
                        onClick={() =>
                          startTransition(() => removeMembers(workspaceId, [r.id]))
                        }
                      >
                        Remove
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
