import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { formatTZS, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/repairs")({ component: RepairsPage });

type Status = "received" | "in_progress" | "completed";

function RepairsPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ customer_id: "none", device_description: "", issue_description: "", repair_cost: "0" });

  const { data: rows = [] } = useQuery({
    queryKey: ["repairs"],
    queryFn: async () => (await supabase.from("repairs").select("*, customers(full_name, phone)").order("received_date", { ascending: false })).data ?? [],
  });
  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => (await supabase.from("customers").select("*").order("full_name")).data ?? [],
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!form.device_description) throw new Error("Device required");
      const { error } = await supabase.from("repairs").insert({
        customer_id: form.customer_id !== "none" ? form.customer_id : null,
        device_description: form.device_description,
        issue_description: form.issue_description || null,
        repair_cost: Number(form.repair_cost || 0),
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["repairs"] }); setOpen(false); setForm({ customer_id: "none", device_description: "", issue_description: "", repair_cost: "0" }); toast.success(t("save")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => {
      const patch: { status: Status; completed_date?: string } = { status };
      if (status === "completed") patch.completed_date = new Date().toISOString();
      const { error } = await supabase.from("repairs").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["repairs"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const statusLabel = (s: Status) => s === "received" ? t("received") : s === "in_progress" ? t("inProgress") : t("completed");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("repairs")}</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />{t("add")}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("repairs")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>{t("customer")}</Label>
                <Select value={form.customer_id} onValueChange={(v) => setForm({ ...form, customer_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name} · {c.phone}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>{t("device")}</Label><Input value={form.device_description} onChange={(e) => setForm({ ...form, device_description: e.target.value })} /></div>
              <div><Label>{t("issue")}</Label><Textarea value={form.issue_description} onChange={(e) => setForm({ ...form, issue_description: e.target.value })} /></div>
              <div><Label>{t("repairCost")}</Label><Input type="number" value={form.repair_cost} onChange={(e) => setForm({ ...form, repair_cost: e.target.value })} /></div>
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
            <TableHead>{t("date")}</TableHead>
            <TableHead>{t("customer")}</TableHead>
            <TableHead>{t("device")}</TableHead>
            <TableHead>{t("issue")}</TableHead>
            <TableHead className="text-right">{t("repairCost")}</TableHead>
            <TableHead>{t("status")}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">{t("empty")}</TableCell></TableRow>}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs">{formatDate(r.received_date)}</TableCell>
                <TableCell>{r.customers?.full_name ?? "—"}</TableCell>
                <TableCell className="font-medium">{r.device_description}</TableCell>
                <TableCell className="max-w-xs truncate">{r.issue_description ?? "—"}</TableCell>
                <TableCell className="text-right">{formatTZS(r.repair_cost)}</TableCell>
                <TableCell>
                  <Select value={r.status} onValueChange={(v) => update.mutate({ id: r.id, status: v as Status })}>
                    <SelectTrigger className="w-40"><SelectValue><Badge variant={r.status === "completed" ? "secondary" : "outline"}>{statusLabel(r.status as Status)}</Badge></SelectValue></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="received">{t("received")}</SelectItem>
                      <SelectItem value="in_progress">{t("inProgress")}</SelectItem>
                      <SelectItem value="completed">{t("completed")}</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
