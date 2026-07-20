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
import { ShieldCheck, AlertCircle, FileText, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/warranties")({ component: WarrantiesPage });

function WarrantiesPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const shopId = useShopId();
  const { theme } = useTheme();
  const [claim, setClaim] = useState<{ id: string; open: boolean; note: string }>({ id: "", open: false, note: "" });

  // ─── Fetch warranties ──────────────────────────────────────
  const { data: rows = [] } = useQuery({
    queryKey: ["warranties"],
    queryFn: async () => (await supabase
      .from("warranties")
      .select("*, sales(inventory_item_id, inventory_items(brand, model, name, item_type), customers(full_name, phone))")
      .order("start_date", { ascending: false })).data ?? [],
  });

  // ─── Fetch claims ──────────────────────────────────────────
  const { data: claims = [] } = useQuery({
    queryKey: ["warranty-claims"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warranty_claims")
        .select(`
          *,
          warranties!inner(
            id,
            period_months,
            sales!inner(
              customers(full_name, phone),
              inventory_items(brand, model, name, item_type)
            )
          )
        `)
        .eq("shop_id", shopId)
        .order("claim_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // ─── Stats ──────────────────────────────────────────────────
  const total = rows.length;
  const active = rows.filter((w) => w.status === "active" && new Date(w.end_date) >= new Date()).length;
  const expired = rows.filter((w) => new Date(w.end_date) < new Date() && w.status === "active").length;
  const claimed = rows.filter((w) => w.status === "claimed").length;

  // ─── File claim ─────────────────────────────────────────────
  const fileClaim = useMutation({
    mutationFn: async () => {
      if (!shopId) throw new Error("No shop context");
      const { error } = await supabase.from("warranty_claims").insert({
        warranty_id: claim.id,
        issue_description: claim.note,
        shop_id: shopId,
        status: "pending",
      });
      if (error) throw error;
      await supabase.from("warranties").update({ status: "claimed" }).eq("id", claim.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["warranties"] });
      qc.invalidateQueries({ queryKey: ["warranty-claims"] });
      setClaim({ id: "", open: false, note: "" });
      toast.success("Claim filed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ─── Resolve claim ──────────────────────────────────────────
  const resolveClaim = useMutation({
    mutationFn: async (claimId: string) => {
      const { error } = await supabase
        .from("warranty_claims")
        .update({ status: "resolved" })
        .eq("id", claimId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["warranty-claims"] });
      toast.success("Claim resolved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusLabel = (s: string) => s === "active" ? t("active") : s === "expired" ? t("expired") : t("claimed");

  return (
    <div className={cn(
      "space-y-6 -m-4 sm:-m-6 p-4 sm:p-6 min-h-full rounded-3xl",
      theme === "dark" ? "bg-[#0f0a12]" : "bg-[#F7F5FA]"
    )}>
      {/* ─── Header ────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-pink-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-20 h-24 w-24 rounded-full bg-rose-500/20 blur-2xl" />
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
        {/* Quick stats */}
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

      {/* ─── Warranties Table ────────────────────────────────── */}
      <Card className={cn(
        "border-0 shadow-sm backdrop-blur-sm p-4",
        theme === "dark"
          ? "bg-slate-800/90 border-slate-700"
          : "bg-white/80"
      )}>
        <h2 className="text-lg font-semibold mb-3 text-slate-800 dark:text-white">Warranties</h2>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={theme === "dark" ? "text-slate-300" : ""}>{t("customer")}</TableHead>
                <TableHead className={theme === "dark" ? "text-slate-300" : ""}>Item</TableHead>
                <TableHead className={theme === "dark" ? "text-slate-300" : ""}>{t("startDate")}</TableHead>
                <TableHead className={theme === "dark" ? "text-slate-300" : ""}>{t("endDate")}</TableHead>
                <TableHead className={theme === "dark" ? "text-slate-300" : ""}>{t("warrantyPeriod")}</TableHead>
                <TableHead className={theme === "dark" ? "text-slate-300" : ""}>{t("status")}</TableHead>
                <TableHead className={theme === "dark" ? "text-slate-300" : ""} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className={cn("text-center py-6", theme === "dark" ? "text-slate-400" : "text-muted-foreground")}>
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
                  <TableRow key={w.id} className={theme === "dark" ? "hover:bg-slate-700/50" : "hover:bg-muted/50"}>
                    <TableCell className={theme === "dark" ? "text-slate-300" : ""}>
                      {w.sales?.customers?.full_name ?? "—"}
                    </TableCell>
                    <TableCell className={cn("font-medium", theme === "dark" ? "text-slate-200" : "")}>{label}</TableCell>
                    <TableCell className={cn("text-xs", theme === "dark" ? "text-slate-300" : "")}>{formatDate(w.start_date)}</TableCell>
                    <TableCell className={cn("text-xs", theme === "dark" ? "text-slate-300" : "")}>{formatDate(w.end_date)}</TableCell>
                    <TableCell className={theme === "dark" ? "text-slate-300" : ""}>{w.period_months} mo</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          status === "active"
                            ? "secondary"
                            : status === "claimed"
                            ? "outline"
                            : "destructive"
                        }
                        className={cn("capitalize", theme === "dark" && status !== "active" && status !== "claimed" ? "border-red-700 text-red-300" : "")}
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
                          className={cn(
                            "border-pink-500/30 text-pink-500 hover:bg-pink-500/10",
                            theme === "dark" ? "border-pink-400/30 text-pink-400 hover:bg-pink-400/10" : ""
                          )}
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

      {/* ─── Claims Table ────────────────────────────────────── */}
      <Card className={cn(
        "border-0 shadow-sm backdrop-blur-sm p-4",
        theme === "dark"
          ? "bg-slate-800/90 border-slate-700"
          : "bg-white/80"
      )}>
        <h2 className="text-lg font-semibold mb-3 text-slate-800 dark:text-white">Filed Claims</h2>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={theme === "dark" ? "text-slate-300" : ""}>Warranty</TableHead>
                <TableHead className={theme === "dark" ? "text-slate-300" : ""}>Customer</TableHead>
                <TableHead className={theme === "dark" ? "text-slate-300" : ""}>Item</TableHead>
                <TableHead className={theme === "dark" ? "text-slate-300" : ""}>Issue</TableHead>
                <TableHead className={theme === "dark" ? "text-slate-300" : ""}>Claimed</TableHead>
                <TableHead className={theme === "dark" ? "text-slate-300" : ""}>Status</TableHead>
                <TableHead className={theme === "dark" ? "text-slate-300" : ""} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {claims.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className={cn("text-center py-6", theme === "dark" ? "text-slate-400" : "text-muted-foreground")}>
                    No claims filed yet.
                  </TableCell>
                </TableRow>
              )}
              {claims.map((c) => {
                const warranty = c.warranties;
                const sale = warranty?.sales;
                const item = sale?.inventory_items;
                const label = item ? (item.item_type === "phone" ? `${item.brand ?? ""} ${item.model ?? ""}`.trim() : item.name ?? "") : "—";
                return (
                  <TableRow key={c.id} className={theme === "dark" ? "hover:bg-slate-700/50" : "hover:bg-muted/50"}>
                    <TableCell className={cn("text-xs", theme === "dark" ? "text-slate-300" : "")}>
                      {warranty?.id?.slice(0, 8) || "—"}
                    </TableCell>
                    <TableCell className={theme === "dark" ? "text-slate-300" : ""}>
                      {sale?.customers?.full_name || "—"}
                    </TableCell>
                    <TableCell className={cn("font-medium", theme === "dark" ? "text-slate-200" : "")}>
                      {label}
                    </TableCell>
                    <TableCell className={cn("max-w-xs truncate", theme === "dark" ? "text-slate-300" : "")}>
                      {c.issue_description || "—"}
                    </TableCell>
                    <TableCell className={cn("text-xs", theme === "dark" ? "text-slate-300" : "")}>
                      {formatDate(c.claim_date)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={c.status === "resolved" ? "secondary" : "outline"}
                        className={cn(
                          c.status === "resolved" ? "bg-emerald-500/20 text-emerald-700" : "",
                          theme === "dark" && c.status !== "resolved" ? "border-slate-600 text-slate-300" : ""
                        )}
                      >
                        {c.status === "resolved" ? "Resolved" : "Pending"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {c.status === "pending" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (confirm("Mark this claim as resolved? This will not affect sales automatically.")) {
                              resolveClaim.mutate(c.id);
                            }
                          }}
                          disabled={resolveClaim.isPending}
                          className="border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Resolve
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground dark:text-slate-400">
          Resolving a claim does not automatically reverse the sale. Use this to track manual decisions like refund or replacement.
        </p>
      </Card>

      {/* ─── File Claim Dialog ────────────────────────────────── */}
      <Dialog open={claim.open} onOpenChange={(v) => setClaim({ ...claim, open: v })}>
        <DialogContent className={theme === "dark" ? "bg-slate-800 border-slate-700 text-white" : ""}>
          <DialogHeader>
            <DialogTitle className={theme === "dark" ? "text-white" : ""}>{t("fileClaim")}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={claim.note}
            onChange={(e) => setClaim({ ...claim, note: e.target.value })}
            placeholder={t("issue")}
            className={cn(
              "min-h-[100px]",
              theme === "dark" ? "border-slate-700 bg-slate-900 text-white placeholder-slate-400" : ""
            )}
          />
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setClaim({ id: "", open: false, note: "" })}
              className={theme === "dark" ? "text-slate-300 hover:text-white hover:bg-slate-700" : ""}
            >
              {t("cancel")}
            </Button>
            <Button
              onClick={() => fileClaim.mutate()}
              disabled={fileClaim.isPending || !claim.note.trim()}
              className="bg-gradient-to-r from-pink-500 to-rose-500 text-white hover:shadow-lg hover:shadow-pink-500/30 transition-all"
            >
              {fileClaim.isPending ? "Filing…" : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
