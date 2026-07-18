import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useShopId } from "@/hooks/use-role";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, AlertCircle, CheckCircle, FileText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/warranties")({ component: WarrantiesPage });

function WarrantiesPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const shopId = useShopId();
  const [claim, setClaim] = useState<{ id: string; open: boolean; note: string }>({ id: "", open: false, note: "" });

  const { data: rows = [] } = useQuery({
    queryKey: ["warranties"],
    queryFn: async () => (await supabase
      .from("warranties")
      .select("*, sales(inventory_item_id, inventory_items(brand, model, name, item_type), customers(full_name, phone))")
      .order("start_date", { ascending: false })).data ?? [],
  });

  // Calculate stats
  const total = rows.length;
  const active = rows.filter((w) => w.status === "active" && new Date(w.end_date) >= new Date()).length;
  const expired = rows.filter((w) => new Date(w.end_date) < new Date() && w.status === "active").length;
  const claimed = rows.filter((w) => w.status === "claimed").length;

  const fileClaim = useMutation({
    mutationFn: async () => {
      if (!shopId) throw new Error("No shop context");
      const { error } = await supabase.from("warranty_claims").insert({ warranty_id: claim.id, issue_description: claim.note, shop_id: shopId });
      if (error) throw error;
      await supabase.from("warranties").update({ status: "claimed" }).eq("id", claim.id);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["warranties"] }); setClaim({ id: "", open: false, note: "" }); toast.success(t("save")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusLabel = (s: string) => s === "active" ? t("active") : s === "expired" ? t("expired") : t("claimed");

  return (
    <div className="space-y-6">
      {/* Header with gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-20 h-24 w-24 rounded-full bg-emerald-500/20 blur-2xl" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{t("warranties")}</h1>
            <p className="mt-1 text-sm text-white/70">Track warranty coverage and claims</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 backdrop-blur-sm">
              <ShieldCheck className="h-4 w-4 text-white/60" />
              <span className="text-sm">{total} warranties</span>
            </div>
          </div>
        </div>
        {/* Quick stats row */}
        <div className="relative z-10 mt-4 flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 backdrop-blur-sm">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>Active: {active}</span>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 backdrop-blur-sm">
            <AlertCircle className="h-4 w-4 text-amber-400" />
            <span>Expired: {expired}</span>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 backdrop-blur-sm">
            <FileText className="h-4 w-4 text-rose-400" />
            <span>Claimed: {claimed}</span>
          </div>
        </div>
      </div>

      {/* Table card */}
      <Card className="border-0 bg-white/80 shadow-sm backdrop-blur-sm dark:bg-slate-900/80 p-4">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("customer")}</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>{t("startDate")}</TableHead>
                <TableHead>{t("endDate")}</TableHead>
                <TableHead>{t("warrantyPeriod")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                    {t("empty")}
                  </TableCell>
                </TableRow>
              )}
              {rows.map((w) => {
                const it = w.sales?.inventory_items;
                const label = it ? (it.item_type === "phone" ? `${it.brand ?? ""} ${it.model ?? ""}`.trim() : it.name ?? "") : "—";
                const expired = new Date(w.end_date) < new Date();
                const status = expired && w.status === "active" ? "expired" : w.status;
                return (
                  <TableRow key={w.id}>
                    <TableCell>{w.sales?.customers?.full_name ?? "—"}</TableCell>
                    <TableCell className="font-medium">{label}</TableCell>
                    <TableCell className="text-xs">{formatDate(w.start_date)}</TableCell>
                    <TableCell className="text-xs">{formatDate(w.end_date)}</TableCell>
                    <TableCell>{w.period_months} mo</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          status === "active"
                            ? "secondary"
                            : status === "claimed"
                            ? "outline"
                            : "destructive"
                        }
                        className="capitalize"
                      >
                        {statusLabel(status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {w.status === "active" && !expired && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setClaim({ id: w.id, open: true, note: "" })}
                          className="border-[#C45BA0]/30 text-[#C45BA0] hover:bg-[#C45BA0]/10"
                        >
                          {t("fileClaim")}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Claim dialog */}
      <Dialog open={claim.open} onOpenChange={(v) => setClaim({ ...claim, open: v })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("fileClaim")}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={claim.note}
            onChange={(e) => setClaim({ ...claim, note: e.target.value })}
            placeholder={t("issue")}
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setClaim({ id: "", open: false, note: "" })}>
              {t("cancel")}
            </Button>
            <Button
              onClick={() => fileClaim.mutate()}
              disabled={fileClaim.isPending || !claim.note.trim()}
              className="bg-gradient-to-r from-[#C45BA0] to-[#8B3A8F] text-white hover:shadow-lg hover:shadow-[#C45BA0]/30 transition-all"
            >
              {fileClaim.isPending ? "Filing…" : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
