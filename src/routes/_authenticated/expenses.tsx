import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useShopId } from "@/hooks/use-role";
import { formatTZS, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/expenses")({ component: ExpensesPage });

type Cat = "rent" | "electricity" | "salaries" | "other";

function ExpensesPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const shopId = useShopId();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ category: Cat; amount: string; note: string; expense_date: string }>({
    category: "rent", amount: "", note: "", expense_date: new Date().toISOString().slice(0, 10),
  });

  const { data: rows = [] } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => (await supabase.from("expenses").select("*").order("expense_date", { ascending: false })).data ?? [],
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!form.amount) throw new Error("Amount required");
      if (!shopId) throw new Error("No shop context");
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase.from("expenses").insert({
        category: form.category, amount: Number(form.amount), note: form.note || null,
        expense_date: form.expense_date, created_by: user.user?.id ?? null, shop_id: shopId,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["expenses"] }); setOpen(false); setForm({ category: "rent", amount: "", note: "", expense_date: new Date().toISOString().slice(0, 10) }); toast.success(t("save")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const catLabel = (c: Cat) => c === "rent" ? t("rent") : c === "electricity" ? t("electricity") : c === "salaries" ? t("salaries") : t("other");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("expenses")}</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />{t("add")}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("expenses")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>{t("category")}</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as Cat })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rent">{t("rent")}</SelectItem>
                    <SelectItem value="electricity">{t("electricity")}</SelectItem>
                    <SelectItem value="salaries">{t("salaries")}</SelectItem>
                    <SelectItem value="other">{t("other")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>{t("amount")}</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
              <div><Label>{t("date")}</Label><Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} /></div>
              <div><Label>{t("note")}</Label><Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>{t("cancel")}</Button>
              <Button onClick={() => add.mutate()} disabled={add.isPending}>{t("save")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Card className="p-4 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>{t("date")}</TableHead><TableHead>{t("category")}</TableHead><TableHead className="text-right">{t("amount")}</TableHead><TableHead>{t("note")}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">{t("empty")}</TableCell></TableRow>}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs">{formatDate(r.expense_date)}</TableCell>
                <TableCell>{catLabel(r.category as Cat)}</TableCell>
                <TableCell className="text-right font-semibold">{formatTZS(r.amount)}</TableCell>
                <TableCell className="text-muted-foreground">{r.note ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
