import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useShopId } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/agents")({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();
    // 🔥 Allow cashier as well
    if (role?.role !== "shop_admin" && role?.role !== "super_admin" && role?.role !== "cashier") {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: AgentsPage,
});

function AgentsPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const shopId = useShopId();
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "" });

  const { data: agents = [] } = useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agents")
        .select("*")
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!form.name) throw new Error("Name required");
      const { error } = await supabase.from("agents").insert({
        name: form.name,
        phone: form.phone || null,
        shop_id: shopId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      setOpen(false);
      setForm({ name: "", phone: "" });
      toast.success("Agent added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("agents").delete().eq("id").eq("shop_id", shopId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      toast.success("Agent removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className={cn(
      "space-y-6 -m-4 sm:-m-6 p-4 sm:p-6 min-h-full rounded-3xl",
      theme === "dark" ? "bg-[#0f0a12]" : "bg-[#F7F5FA]"
    )}>
      <div className="flex items-center justify-between">
        <h1 className={cn("text-2xl font-bold", theme === "dark" ? "text-white" : "text-slate-800")}>
          Agents (Winga)
        </h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-pink-500 to-rose-500 text-white">
              <Plus className="mr-2 h-4 w-4" /> Add Agent
            </Button>
          </DialogTrigger>
          <DialogContent className={theme === "dark" ? "bg-slate-800 border-slate-700 text-white" : ""}>
            <DialogHeader>
              <DialogTitle className={theme === "dark" ? "text-white" : ""}>Add Agent</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className={theme === "dark" ? "text-slate-300" : ""}>Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={theme === "dark" ? "border-slate-700 bg-slate-900 text-white" : ""}
                />
              </div>
              <div>
                <Label className={theme === "dark" ? "text-slate-300" : ""}>Phone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className={theme === "dark" ? "border-slate-700 bg-slate-900 text-white" : ""}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)} className={theme === "dark" ? "text-slate-300 hover:text-white hover:bg-slate-700" : ""}>Cancel</Button>
              <Button onClick={() => add.mutate()} disabled={add.isPending} className="bg-gradient-to-r from-pink-500 to-rose-500 text-white">Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className={cn(
        "p-4 overflow-x-auto",
        theme === "dark" ? "bg-slate-800/90 border-slate-700" : "bg-white/80"
      )}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={theme === "dark" ? "text-slate-300" : ""}>Name</TableHead>
              <TableHead className={theme === "dark" ? "text-slate-300" : ""}>Phone</TableHead>
              <TableHead className={cn("text-right", theme === "dark" ? "text-slate-300" : "")}>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agents.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className={cn("text-center py-6", theme === "dark" ? "text-slate-400" : "text-muted-foreground")}>
                  No agents yet.
                </TableCell>
              </TableRow>
            )}
            {agents.map((a) => (
              <TableRow key={a.id} className={theme === "dark" ? "hover:bg-slate-700/50" : "hover:bg-muted/50"}>
                <TableCell className={cn("font-medium", theme === "dark" ? "text-slate-200" : "")}>{a.name}</TableCell>
                <TableCell className={theme === "dark" ? "text-slate-300" : ""}>{a.phone || "—"}</TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (confirm("Remove this agent?")) remove.mutate(a.id);
                    }}
                    className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:text-rose-300 dark:hover:bg-rose-950/20"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
