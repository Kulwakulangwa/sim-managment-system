import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useShopId, useMyRole } from "@/hooks/use-role";
import { formatTZS, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, TrendingUp, DollarSign, Receipt } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/expenses")({ component: ExpensesPage });

type Cat = "rent" | "electricity" | "salaries" | "other";

function ExpensesPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const shopId = useShopId();
  const { data: myRole } = useMyRole();
  const role = myRole?.role;
  // Both shop_admin and super_admin can delete
  const isAdmin = role === "shop_admin" || role === "super_admin";

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ category: Cat; amount: string; note: string; expense_date: string }>({
    category: "rent", amount: "", note: "", expense_date: new Date().toISOString().slice(0, 10),
  });

  const { data: rows = [] } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => (await supabase.from("expenses").select("*").order("expense_date", { ascending: false })).data ?? [],
  });

  // Compute stats
  const totalExpenses = rows.reduce((sum, r) => sum + Number(r.amount), 0);
  const rentTotal = rows.filter(r => r.category === "rent").reduce((s, r) => s + Number(r.amount), 0);
  const electricityTotal = rows.filter(r => r.category === "electricity").reduce((s, r) => s + Number(r.amount), 0);
  const salariesTotal = rows.filter(r => r.category === "salaries").reduce((s, r) => s + Number(r.amount), 0);
  const otherTotal = rows.filter(r => r.category === "other").reduce((s, r) => s + Number(r.amount), 0);

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

  // Delete mutation – allowed for shop_admin and super_admin
  const del = useMutation({
    mutationFn: async (id: string) => {
      if (!isAdmin) throw new Error("Only admins can delete expenses");
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["expenses"] }); toast.success(t("deleteSuccess")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const catLabel = (c: Cat) => c === "rent" ? t("rent") : c === "electricity" ? t("electricity") : c === "salaries" ? t("salaries") : t("other");

  const handleDelete = (id: string) => {
    if (confirm(t("confirmDelete"))) del.mutate(id);
  };

  return (
    <div className="space-y-6">
      {/* Header with gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-20 h-24 w-24 rounded-full bg-emerald-500/20 blur-2xl" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{t("expenses")}</h1>
            <p className="mt-1 text-sm text-white/70">Track and manage your shop expenses</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 backdrop-blur-sm">
              <Receipt className="h-4 w-4 text-white/60" />
              <span className="text-sm">{rows.length} entries</span>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-[#C45BA0] to-[#8B3A8F] text-white hover:shadow-lg hover:shadow-[#C45BA0]/30 transition-all">
                  <Plus className="mr-2 h-4 w-4" /> {t("add")}
                </Button>
              </DialogTrigger>
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
        </div>
        {/* Quick stats row */}
        <div className="relative z-10 mt-4 flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 backdrop-blur-sm">
            <DollarSign className="h-4 w-4 text-emerald-400" />
            <span>Total: {formatTZS(totalExpenses)}</span>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 backdrop-blur-sm">
            <TrendingUp className="h-4 w-4 text-blue-400" />
            <span>Rent: {formatTZS(rentTotal)}</span>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 backdrop-blur-sm">
            <TrendingUp className="h-4 w-4 text-amber-400" />
            <span>Electricity: {formatTZS(electricityTotal)}</span>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 backdrop-blur-sm">
            <TrendingUp className="h-4 w-4 text-purple-400" />
            <span>Salaries: {formatTZS(salariesTotal)}</span>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 backdrop-blur-sm">
            <TrendingUp className="h-4 w-4 text-rose-400" />
            <span>Other: {formatTZS(otherTotal)}</span>
          </div>
        </div>
      </div>

      {/* Table card */}
      <Card className="border-0 bg-white/80 shadow-sm backdrop-blur-sm dark:bg-slate-900/80 p-4">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("date")}</TableHead>
                <TableHead>{t("category")}</TableHead>
                <TableHead className="text-right">{t("amount")}</TableHead>
                <TableHead>{t("note")}</TableHead>
                {isAdmin && <TableHead className="text-right">{t("actions")}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 5 : 4} className="text-center py-6 text-muted-foreground">
                    {t("empty")}
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{formatDate(r.expense_date)}</TableCell>
                  <TableCell>{catLabel(r.category as Cat)}</TableCell>
                  <TableCell className="text-right font-semibold">{formatTZS(r.amount)}</TableCell>
                  <TableCell className="text-muted-foreground">{r.note ?? "—"}</TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(r.id)}
                        disabled={del.isPending}
                        className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
