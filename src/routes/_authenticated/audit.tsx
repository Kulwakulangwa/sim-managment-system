import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

// ─── Route Guard ──────────────────────────────────────────────
export const Route = createFileRoute("/_authenticated/audit")({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });

    // Check if user is super_admin
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    const role = roleData?.role;
    const isSuperAdminByEmail = user.email === "kulwakulangwa@gmail.com";
    const isSuperAdmin = role === "super_admin" || isSuperAdminByEmail;

    if (!isSuperAdmin) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: AuditPage,
});

// ─── Component ─────────────────────────────────────────────────
const ACTION_COLOR: Record<string, string> = {
  insert: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  update: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  delete: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  soft_delete: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  restore: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
};

function AuditPage() {
  const [q, setQ] = useState("");
  const [table, setTable] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["audit", table],
    queryFn: async () => {
      let query = supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(500);
      if (table) query = query.eq("table_name", table);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = (data ?? []).filter((r) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      r.user_name?.toLowerCase().includes(s) ||
      r.action?.toLowerCase().includes(s) ||
      r.table_name?.toLowerCase().includes(s) ||
      r.record_id?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Activity log</h1>
        <p className="text-sm text-muted-foreground">Every important action in your shop is recorded here for accountability and audits.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Input placeholder="Search user, action, record…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
        <select value={table} onChange={(e) => setTable(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
          <option value="">All tables</option>
          <option value="inventory_items">Products</option>
          <option value="sales">Sales</option>
          <option value="customers">Customers</option>
          <option value="repairs">Repairs</option>
          <option value="expenses">Expenses</option>
          <option value="user_roles">Users / roles</option>
          <option value="shops">Shops</option>
        </select>
      </div>
      <div className="rounded-md border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Table</TableHead>
              <TableHead>Record</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Loading…</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No activity yet.</TableCell></TableRow>
            ) : rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</TableCell>
                <TableCell className="text-sm">{r.user_name ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className={ACTION_COLOR[r.action] ?? ""}>{r.action}</Badge>
                </TableCell>
                <TableCell className="text-sm">{r.table_name}</TableCell>
                <TableCell className="text-xs font-mono text-muted-foreground">{r.record_id?.slice(0, 8)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
