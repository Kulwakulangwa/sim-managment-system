import { createFileRoute } from "@tanstack/react-router";
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
import { Plus, Search, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/customers")({ component: CustomersPage });

function CustomersPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const shopId = useShopId();
  const { theme } = useTheme();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", phone: "" });

  const { data: rows = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => (await supabase.from("customers").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!form.full_name || !form.phone) throw new Error("Missing");
      if (!shopId) throw new Error("No shop context");
      const { error } = await supabase.from("customers").insert({ ...form, shop_id: shopId });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["customers"] }); setOpen(false); setForm({ full_name: "", phone: "" }); toast.success(t("save")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = rows.filter((r) => !q || `${r.full_name} ${r.phone}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className={cn(
      "space-y-6 -m-4 sm:-m-6 p-4 sm:p-6 min-h-full rounded-3xl",
      theme === "dark" ? "bg-[#0f0a12]" : "bg-[#F7F5FA]"
    )}>
      {/* Header with gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-pink-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-20 h-24 w-24 rounded-full bg-rose-500/20 blur-2xl" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{t("customers")}</h1>
            <p className="mt-1 text-sm text-white/70">Manage your customer database</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 backdrop-blur-sm">
              <Users className="h-4 w-4 text-white/60" />
              <span className="text-sm">{rows.length} customers</span>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-pink-500 to-rose-500 text-white hover:shadow-lg hover:shadow-pink-500/30 transition-all">
                  <Plus className="mr-2 h-4 w-4" /> {t("add")}
                </Button>
              </DialogTrigger>
              <DialogContent className={theme === "dark" ? "bg-slate-800 border-slate-700 text-white" : ""}>
                <DialogHeader><DialogTitle className={theme === "dark" ? "text-white" : ""}>{t("customer")}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label className={theme === "dark" ? "text-slate-300" : ""}>{t("fullName")}</Label>
                    <Input
                      value={form.full_name}
                      onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                      className={theme === "dark" ? "border-slate-700 bg-slate-900 text-white placeholder-slate-400" : ""}
                    />
                  </div>
                  <div>
                    <Label className={theme === "dark" ? "text-slate-300" : ""}>{t("phone")}</Label>
                    <Input
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className={theme === "dark" ? "border-slate-700 bg-slate-900 text-white placeholder-slate-400" : ""}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="ghost"
                    onClick={() => setOpen(false)}
                    className={theme === "dark" ? "text-slate-300 hover:text-white hover:bg-slate-700" : ""}
                  >
                    {t("cancel")}
                  </Button>
                  <Button
                    onClick={() => add.mutate()}
                    disabled={add.isPending}
                    className="bg-gradient-to-r from-pink-500 to-rose-500 text-white hover:shadow-lg hover:shadow-pink-500/30"
                  >
                    {t("save")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Search and table */}
      <Card className={cn(
        "border-0 shadow-sm backdrop-blur-sm p-4",
        theme === "dark"
          ? "bg-slate-800/90 border-slate-700"
          : "bg-white/80"
      )}>
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            className={cn(
              "pl-9 focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500",
              theme === "dark"
                ? "border-slate-700 bg-slate-900 text-white placeholder-slate-400"
                : "bg-white border-slate-200"
            )}
            placeholder={t("search")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={theme === "dark" ? "text-slate-300" : ""}>{t("fullName")}</TableHead>
                <TableHead className={theme === "dark" ? "text-slate-300" : ""}>{t("phone")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className={cn("text-center py-6", theme === "dark" ? "text-slate-400" : "text-muted-foreground")}>
                    {t("empty")}
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((c) => (
                <TableRow key={c.id} className={theme === "dark" ? "hover:bg-slate-700/50" : "hover:bg-muted/50"}>
                  <TableCell className={cn("font-medium", theme === "dark" ? "text-slate-200" : "")}>{c.full_name}</TableCell>
                  <TableCell className={theme === "dark" ? "text-slate-300" : ""}>{c.phone}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
