import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { formatTZS, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/installments")({ component: InstallmentsPage });

function InstallmentsPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
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
      const { data: plan } = await supabase.from("installment_plans").select("paid_amount, total_amount").eq("id", pay.planId).single();
      if (!plan) throw new Error("Plan missing");
      const newPaid = Number(plan.paid_amount) + amt;
      await supabase.from("installment_payments").insert({
        installment_plan_id: pay.planId, amount: amt, paid_date: new Date().toISOString(), status: "paid",
      });
      await supabase.from("installment_plans").update({ paid_amount: newPaid }).eq("id", pay.planId);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["installments"] }); setPay({ open: false, planId: "", amount: "" }); toast.success(t("save")); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t("installments")}</h1>
      <Card className="p-4 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>{t("date")}</TableHead>
            <TableHead>{t("customer")}</TableHead>
            <TableHead>Item</TableHead>
            <TableHead className="text-right">{t("total")}</TableHead>
            <TableHead className="text-right">{t("paid")}</TableHead>
            <TableHead className="text-right">{t("balance")}</TableHead>
            <TableHead>{t("status")}</TableHead>
            <TableHead />
          </TableRow></TableHeader>
          <TableBody>
            {plans.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">{t("empty")}</TableCell></TableRow>}
            {plans.map((p) => {
              const it = p.sales?.inventory_items;
              const label = it ? (it.item_type === "phone" ? `${it.brand ?? ""} ${it.model ?? ""}`.trim() : it.name ?? "") : "—";
              const balance = Number(p.total_amount) - Number(p.paid_amount);
              const done = balance <= 0;
              const overdue = (p.installment_payments ?? []).some((pp: { status: string; due_date: string | null }) => pp.status === "pending" && pp.due_date && new Date(pp.due_date) < new Date());
              return (
                <TableRow key={p.id}>
                  <TableCell className="text-xs">{formatDate(p.created_at)}</TableCell>
                  <TableCell>{p.sales?.customers?.full_name ?? "—"}</TableCell>
                  <TableCell className="font-medium">{label}</TableCell>
                  <TableCell className="text-right">{formatTZS(p.total_amount)}</TableCell>
                  <TableCell className="text-right">{formatTZS(p.paid_amount)}</TableCell>
                  <TableCell className="text-right font-semibold">{formatTZS(balance)}</TableCell>
                  <TableCell><Badge variant={done ? "secondary" : overdue ? "destructive" : "outline"}>{done ? t("paid") : overdue ? t("overdue") : t("pending")}</Badge></TableCell>
                  <TableCell>
                    {!done && <Button size="sm" variant="outline" onClick={() => setPay({ open: true, planId: p.id, amount: "" })}>{t("recordPayment")}</Button>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
      <Dialog open={pay.open} onOpenChange={(v) => setPay({ ...pay, open: v })}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("recordPayment")}</DialogTitle></DialogHeader>
          <Input type="number" placeholder={t("amount")} value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPay({ open: false, planId: "", amount: "" })}>{t("cancel")}</Button>
            <Button onClick={() => record.mutate()} disabled={record.isPending}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
