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
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t("warranties")}</h1>
      <Card className="p-4 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>{t("customer")}</TableHead>
            <TableHead>Item</TableHead>
            <TableHead>{t("startDate")}</TableHead>
            <TableHead>{t("endDate")}</TableHead>
            <TableHead>{t("warrantyPeriod")}</TableHead>
            <TableHead>{t("status")}</TableHead>
            <TableHead />
          </TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">{t("empty")}</TableCell></TableRow>}
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
                  <TableCell><Badge variant={status === "active" ? "secondary" : status === "claimed" ? "outline" : "destructive"}>{statusLabel(status)}</Badge></TableCell>
                  <TableCell>
                    {w.status === "active" && !expired && (
                      <Button size="sm" variant="outline" onClick={() => setClaim({ id: w.id, open: true, note: "" })}>{t("fileClaim")}</Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
      <Dialog open={claim.open} onOpenChange={(v) => setClaim({ ...claim, open: v })}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("fileClaim")}</DialogTitle></DialogHeader>
          <Textarea value={claim.note} onChange={(e) => setClaim({ ...claim, note: e.target.value })} placeholder={t("issue")} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setClaim({ id: "", open: false, note: "" })}>{t("cancel")}</Button>
            <Button onClick={() => fileClaim.mutate()} disabled={fileClaim.isPending}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
