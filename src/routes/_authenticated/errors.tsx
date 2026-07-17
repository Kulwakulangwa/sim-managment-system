import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/errors")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    const isSuper = roles?.some((r) => r.role === "super_admin");
    if (!isSuper) throw redirect({ to: "/dashboard" });
  },
  component: ErrorsPage,
});

function ErrorsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["error_logs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("error_logs").select("*").order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const resolve = async (id: string, resolved: boolean) => {
    const { error } = await supabase.from("error_logs").update({ resolved: !resolved }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["error_logs"] });
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Error monitoring</h1>
        <p className="text-sm text-muted-foreground">Errors captured across the platform. Investigate patterns and mark them resolved.</p>
      </div>
      <div className="rounded-md border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>URL</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : !data || data.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No errors recorded. 🎉</TableCell></TableRow>
            ) : data.map((r) => (
              <TableRow key={r.id} className={r.resolved ? "opacity-60" : ""}>
                <TableCell className="text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</TableCell>
                <TableCell><Badge variant="outline">{r.source}</Badge></TableCell>
                <TableCell className="max-w-md truncate" title={r.message}>{r.message}</TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{r.url}</TableCell>
                <TableCell>
                  {r.resolved ? <Badge className="bg-emerald-500/15 text-emerald-700">Resolved</Badge> : <Badge variant="destructive">Open</Badge>}
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="outline" onClick={() => resolve(r.id, r.resolved)}>
                    {r.resolved ? "Reopen" : "Resolve"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
