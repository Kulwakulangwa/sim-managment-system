import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useShopId } from "@/hooks/use-role";
import { formatTZS, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { toast } from "sonner";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/installments")({ component: InstallmentsPage });

function InstallmentsPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const shopId = useShopId();
  const { theme } = useTheme();
  const [pay, setPay] = useState<{ open: boolean; planId: string; amount: string }>({ open: false, planId: "", amount: "" });

  const { data: plans = [] } = useQuery({
    queryKey: ["installments"],
    queryFn: async () => (await supabase
      .from("installment_plans")
      .select("*, sales(customers(full_name, phone), inventory_items(brand, model, name, item_type)), installment_payments(*)")
      .order("created_at", { ascending: false })).data ?? [],
  });

  const record = useMutation({
    mutationFn: async () => {
      const amt = Number(pay.amount || 0);
      if (amt <= 0) throw new Error("Enter amount");
      if (!shopId) throw new Error("No shop context");
      const { data: plan } = await supabase.from("installment_plans").select("paid_amount, total_amount").eq("id", pay.planId).single();
      if (!plan) throw new Error("Plan missing");
      const newPaid = Number(plan.paid_amount) + amt;
      await supabase.from("installment_payments").insert({
        installment_plan_id: pay.planId, amount: amt, paid_date: new Date().toISOString(), status: "paid", shop_id: shopId,
      });
      await supabase.from("installment_plans").update({ paid_amount: newPaid }).eq("id", pay.planId);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["installments"] }); setPay({ open: false, planId: "", amount: "" }); toast.success(t("save")); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className={cn(
      "space-y-6 -m-4 sm:-m-6 p-4 sm:p-6 min-h-full rounded-3xl",
      theme === "dark" ? "bg-[#0f0a12]" : "bg-[#F7F5FA]"
    )}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className={cn(
          "text-2xl font-bold",
          theme === "dark" ? "text-white" : "text-slate-800"
        )}>
          {t("installments")}
        </h1>
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-sm",
            theme === "dark" ? "text-slate-400" : "text-slate-500"
          )}>
            {plans.length} plans
          </span>
        </div>
      </div>

      <Card className={cn(
        "border-0 shadow-sm backdrop-blur-sm p-4",
        theme === "dark"
          ? "bg-slate-800/90 border-slate-700"
          : "bg-white/80"
      )}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={theme === "dark" ? "text-slate-300" : ""}>{t("date")}</TableHead>
                <TableHead className={theme === "dark" ? "text-slate-300" : ""}>{t("customer")}</TableHead>
                <TableHead className={theme === "dark" ? "text-slate-300" : ""}>Item</TableHead>
                <TableHead className={cn("text-right", theme === "dark" ? "text-slate-300" : "")}>{t("total")}</TableHead>
                <TableHead className={cn("text-right", theme === "dark" ? "text-slate-300" : "")}>{t("paid")}</TableHead>
                <TableHead className={cn("text-right", theme === "dark" ? "text-slate-300" : "")}>{t("balance")}</TableHead>
                <TableHead className={theme === "dark" ? "text-slate-300" : ""}>{t("status")}</TableHead>
                <TableHead className={theme === "dark" ? "text-slate-300" : ""} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className={cn("text-center py-6", theme === "dark" ? "text-slate-400" : "text-muted-foreground")}>
                    {t("empty")}
                  </TableCell>
                </TableRow>
              )}
              {plans.map((p) => {
                const it = p.sales?.inventory_items;
                const label = it ? (it.item_type === "phone" ? `${it.brand ?? ""} ${it.model ?? ""}`.trim() : it.name ?? "") : "—";
                const balance = Number(p.total_amount) - Number(p.paid_amount);
                const done = balance <= 0;
                const overdue = (p.installment_payments ?? []).some((pp: { status: string; due_date: string | null }) => pp.status === "pending" && pp.due_date && new Date(pp.due_date) < new Date());
                return (
                  <TableRow key={p.id} className={theme === "dark" ? "hover:bg-slate-700/50" : "hover:bg-muted/50"}>
                    <TableCell className={cn("text-xs", theme === "dark" ? "text-slate-300" : "")}>{formatDate(p.created_at)}</TableCell>
                    <TableCell className={theme === "dark" ? "text-slate-300" : ""}>{p.sales?.customers?.full_name ?? "—"}</TableCell>
                    <TableCell className={cn("font-medium", theme === "dark" ? "text-slate-200" : "")}>{label}</TableCell>
                    <TableCell className={cn("text-right", theme === "dark" ? "text-slate-300" : "")}>{formatTZS(p.total_amount)}</TableCell>
                    <TableCell className={cn("text-right", theme === "dark" ? "text-slate-300" : "")}>{formatTZS(p.paid_amount)}</TableCell>
                    <TableCell className={cn("text-right font-semibold", theme === "dark" ? "text-white" : "")}>{formatTZS(balance)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={done ? "secondary" : overdue ? "destructive" : "outline"}
                        className={theme === "dark" && !done && !overdue ? "border-slate-600 text-slate-300" : ""}
                      >
                        {done ? t("paid") : overdue ? t("overdue") : t("pending")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {!done && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPay({ open: true, planId: p.id, amount: "" })}
                          className={cn(
                            "border-pink-500/30 text-pink-500 hover:bg-pink-500/10",
                            theme === "dark" ? "border-pink-400/30 text-pink-400 hover:bg-pink-400/10" : ""
                          )}
                        >
                          {t("recordPayment")}
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

      {/* Record payment dialog */}
      <Dialog open={pay.open} onOpenChange={(v) => setPay({ ...pay, open: v })}>
        <DialogContent className={theme === "dark" ? "bg-slate-800 border-slate-700 text-white" : ""}>
          <DialogHeader>
            <DialogTitle className={theme === "dark" ? "text-white" : ""}>{t("recordPayment")}</DialogTitle>
          </DialogHeader>
          <Input
            type="number"
            placeholder={t("amount")}
            value={pay.amount}
            onChange={(e) => setPay({ ...pay, amount: e.target.value })}
            className={theme === "dark" ? "border-slate-700 bg-slate-900 text-white placeholder-slate-400" : ""}
          />
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setPay({ open: false, planId: "", amount: "" })}
              className={theme === "dark" ? "text-slate-300 hover:text-white hover:bg-slate-700" : ""}
            >
              {t("cancel")}
            </Button>
            <Button
              onClick={() => record.mutate()}
              disabled={record.isPending}
              className="bg-gradient-to-r from-pink-500 to-rose-500 text-white hover:shadow-lg hover:shadow-pink-500/30"
            >
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
