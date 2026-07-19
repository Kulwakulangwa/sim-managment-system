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
import { Badge } from "@/components/ui/badge";
import { Plus, Wrench, CheckCircle, Clock, AlertCircle, DollarSign } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/repairs")({ component: RepairsPage });

type Status = "received" | "in_progress" | "completed";

function RepairsPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const shopId = useShopId();
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ customer_id: "none", device_description: "", issue_description: "", repair_cost: "0" });

  // Payment dialog state
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentRepairId, setPaymentRepairId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");

  const { data: rows = [] } = useQuery({
    queryKey: ["repairs"],
    queryFn: async () => (await supabase.from("repairs").select("*, customers(full_name, phone)").order("received_date", { ascending: false })).data ?? [],
  });
  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => (await supabase.from("customers").select("*").order("full_name")).data ?? [],
  });

  const total = rows.length;
  const pending = rows.filter((r) => r.status === "received" || r.status === "in_progress").length;
  const completed = rows.filter((r) => r.status === "completed").length;
  const inProgress = rows.filter((r) => r.status === "in_progress").length;

  const add = useMutation({
    mutationFn: async () => {
      if (!form.device_description) throw new Error("Device required");
      if (!shopId) throw new Error("No shop context");
      const { error } = await supabase.from("repairs").insert({
        customer_id: form.customer_id !== "none" ? form.customer_id : null,
        device_description: form.device_description,
        issue_description: form.issue_description || null,
        repair_cost: Number(form.repair_cost || 0),
        shop_id: shopId,
        paid_amount: 0,
        payment_status: "pending",
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

  const recordPayment = useMutation({
    mutationFn: async () => {
      if (!paymentRepairId) throw new Error("No repair selected");
      const amt = Number(paymentAmount);
      if (amt <= 0) throw new Error("Enter a valid amount");
      if (!shopId) throw new Error("No shop context");

      const { data: repair } = await supabase.from("repairs").select("repair_cost, paid_amount").eq("id", paymentRepairId).single();
      if (!repair) throw new Error("Repair not found");
      const newPaid = Number(repair.paid_amount) + amt;
      const totalCost = Number(repair.repair_cost);
      const status = newPaid >= totalCost ? "paid" : "partial";

      const { error: e1 } = await supabase.from("repairs").update({ paid_amount: newPaid, payment_status: status }).eq("id", paymentRepairId);
      if (e1) throw e1;

      const { error: e2 } = await supabase.from("repair_payments").insert({
        repair_id: paymentRepairId,
        amount: amt,
        shop_id: shopId,
      });
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success("Payment recorded");
      qc.invalidateQueries({ queryKey: ["repairs"] });
      setPaymentOpen(false);
      setPaymentRepairId(null);
      setPaymentAmount("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusLabel = (s: Status) => s === "received" ? t("received") : s === "in_progress" ? t("inProgress") : t("completed");

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
            <h1 className="text-2xl font-bold">{t("repairs")}</h1>
            <p className="mt-1 text-sm text-white/70">Track and manage repair jobs</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 backdrop-blur-sm">
              <Wrench className="h-4 w-4 text-white/60" />
              <span className="text-sm">{total} repairs</span>
            </div>
            {pending > 0 && (
              <div className="flex items-center gap-2 rounded-full bg-amber-500/20 px-3 py-1 backdrop-blur-sm">
                <Clock className="h-4 w-4 text-amber-400" />
                <span className="text-sm">{pending} pending</span>
              </div>
            )}
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-pink-500 to-rose-500 text-white hover:shadow-lg hover:shadow-pink-500/30 transition-all">
                  <Plus className="mr-2 h-4 w-4" /> {t("add")}
                </Button>
              </DialogTrigger>
              <DialogContent className={theme === "dark" ? "bg-slate-800 border-slate-700 text-white" : ""}>
                <DialogHeader><DialogTitle className={theme === "dark" ? "text-white" : ""}>{t("repairs")}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label className={theme === "dark" ? "text-slate-300" : ""}>{t("customer")}</Label>
                    <Select value={form.customer_id} onValueChange={(v) => setForm({ ...form, customer_id: v })}>
                      <SelectTrigger className={theme === "dark" ? "border-slate-700 bg-slate-900 text-white" : ""}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name} · {c.phone}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className={theme === "dark" ? "text-slate-300" : ""}>{t("device")}</Label>
                    <Input
                      value={form.device_description}
                      onChange={(e) => setForm({ ...form, device_description: e.target.value })}
                      className={theme === "dark" ? "border-slate-700 bg-slate-900 text-white placeholder-slate-400" : ""}
                    />
                  </div>
                  <div>
                    <Label className={theme === "dark" ? "text-slate-300" : ""}>{t("issue")}</Label>
                    <Textarea
                      value={form.issue_description}
                      onChange={(e) => setForm({ ...form, issue_description: e.target.value })}
                      className={theme === "dark" ? "border-slate-700 bg-slate-900 text-white placeholder-slate-400" : ""}
                    />
                  </div>
                  <div>
                    <Label className={theme === "dark" ? "text-slate-300" : ""}>{t("repairCost")}</Label>
                    <Input
                      type="number"
                      value={form.repair_cost}
                      onChange={(e) => setForm({ ...form, repair_cost: e.target.value })}
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
        {/* Quick stats */}
        <div className="relative z-10 mt-4 flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 backdrop-blur-sm">
            <AlertCircle className="h-4 w-4 text-amber-400" />
            <span>Received: {rows.filter((r) => r.status === "received").length}</span>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 backdrop-blur-sm">
            <Clock className="h-4 w-4 text-blue-400" />
            <span>In progress: {inProgress}</span>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 backdrop-blur-sm">
            <CheckCircle className="h-4 w-4 text-emerald-400" />
            <span>Completed: {completed}</span>
          </div>
        </div>
      </div>

      {/* Table card */}
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
                <TableHead className={theme === "dark" ? "text-slate-300" : ""}>{t("device")}</TableHead>
                <TableHead className={theme === "dark" ? "text-slate-300" : ""}>{t("issue")}</TableHead>
                <TableHead className={cn("text-right", theme === "dark" ? "text-slate-300" : "")}>{t("repairCost")}</TableHead>
                <TableHead className={cn("text-right", theme === "dark" ? "text-slate-300" : "")}>Paid</TableHead>
                <TableHead className={theme === "dark" ? "text-slate-300" : ""}>Payment Status</TableHead>
                <TableHead className={theme === "dark" ? "text-slate-300" : ""}>{t("status")}</TableHead>
                <TableHead className={theme === "dark" ? "text-slate-300" : ""} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className={cn("text-center py-6", theme === "dark" ? "text-slate-400" : "text-muted-foreground")}>
                    {t("empty")}
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => {
                const paid = Number(r.paid_amount || 0);
                const totalCost = Number(r.repair_cost || 0);
                const balance = totalCost - paid;
                const isFullyPaid = balance <= 0;
                return (
                  <TableRow key={r.id} className={theme === "dark" ? "hover:bg-slate-700/50" : "hover:bg-muted/50"}>
                    <TableCell className={cn("text-xs", theme === "dark" ? "text-slate-300" : "")}>{formatDate(r.received_date)}</TableCell>
                    <TableCell className={theme === "dark" ? "text-slate-300" : ""}>{r.customers?.full_name ?? "—"}</TableCell>
                    <TableCell className={cn("font-medium", theme === "dark" ? "text-slate-200" : "")}>{r.device_description}</TableCell>
                    <TableCell className={cn("max-w-xs truncate", theme === "dark" ? "text-slate-300" : "")}>{r.issue_description ?? "—"}</TableCell>
                    <TableCell className={cn("text-right", theme === "dark" ? "text-slate-300" : "")}>{formatTZS(r.repair_cost)}</TableCell>
                    <TableCell className={cn("text-right", theme === "dark" ? "text-slate-300" : "")}>{formatTZS(paid)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={isFullyPaid ? "secondary" : "outline"}
                        className={cn(
                          isFullyPaid ? "bg-emerald-500/20 text-emerald-700" : "bg-amber-500/20 text-amber-700",
                          theme === "dark" && !isFullyPaid && "border-slate-600 text-slate-300"
                        )}
                      >
                        {isFullyPaid ? "Paid" : r.payment_status === "partial" ? "Partial" : "Pending"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select value={r.status} onValueChange={(v) => update.mutate({ id: r.id, status: v as Status })}>
                        <SelectTrigger className={cn(
                          "w-40",
                          theme === "dark" ? "border-slate-700 bg-slate-900 text-white" : ""
                        )}>
                          <SelectValue>
                            <Badge variant={r.status === "completed" ? "secondary" : "outline"} className={theme === "dark" && r.status !== "completed" ? "border-slate-600 text-slate-300" : ""}>
                              {statusLabel(r.status as Status)}
                            </Badge>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="received">{t("received")}</SelectItem>
                          <SelectItem value="in_progress">{t("inProgress")}</SelectItem>
                          <SelectItem value="completed">{t("completed")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {!isFullyPaid && r.status === "completed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setPaymentRepairId(r.id);
                            setPaymentAmount("");
                            setPaymentOpen(true);
                          }}
                          className="border-pink-500/30 text-pink-500 hover:bg-pink-500/10"
                        >
                          <DollarSign className="h-3 w-3 mr-1" />
                          Record Payment
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

      {/* Record Payment Dialog */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className={theme === "dark" ? "bg-slate-800 border-slate-700 text-white" : ""}>
          <DialogHeader>
            <DialogTitle className={theme === "dark" ? "text-white" : ""}>Record Repair Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label className={theme === "dark" ? "text-slate-300" : ""}>Amount</Label>
            <Input
              type="number"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder="Enter payment amount"
              className={theme === "dark" ? "border-slate-700 bg-slate-900 text-white" : ""}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPaymentOpen(false)} className={theme === "dark" ? "text-slate-300 hover:text-white hover:bg-slate-700" : ""}>
              Cancel
            </Button>
            <Button
              onClick={() => recordPayment.mutate()}
              disabled={recordPayment.isPending || !paymentAmount}
              className="bg-gradient-to-r from-pink-500 to-rose-500 text-white"
            >
              {recordPayment.isPending ? "Recording..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
