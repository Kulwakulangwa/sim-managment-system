import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useShopId } from "@/hooks/use-role";
import { formatTZS, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { DollarSign, CheckCircle, Undo2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { returnWingaSale } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/winga")({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();
    // 🔥 Allow cashier as well
    if (role?.role !== "shop_admin" && role?.role !== "super_admin" && role?.role !== "cashier") {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: WingaPage,
});

function WingaPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const shopId = useShopId();
  const { theme } = useTheme();
  const [settleOpen, setSettleOpen] = useState(false);
  const [settleSaleId, setSettleSaleId] = useState<string | null>(null);
  const [settleAmount, setSettleAmount] = useState("");

  const returnWingaSaleFn = useServerFn(returnWingaSale);

  const { data: wingaSales = [] } = useQuery({
    queryKey: ["winga-sales"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select(`
          *,
          agents(name, phone),
          inventory_items(brand, model, name, item_type)
        `)
        .eq("shop_id", shopId)
        .not("agent_id", "is", null)
        .eq("winga_settled", false)
        .eq("winga_returned", false)
        .order("sale_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const settle = useMutation({
    mutationFn: async () => {
      if (!settleSaleId) throw new Error("No sale selected");
      const amt = Number(settleAmount);
      if (amt <= 0) throw new Error("Enter a valid amount");
      const { error } = await supabase
        .from("sales")
        .update({
          winga_settled: true,
          winga_settled_at: new Date().toISOString(),
        })
        .eq("id", settleSaleId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["winga-sales"] });
      setSettleOpen(false);
      setSettleSaleId(null);
      setSettleAmount("");
      toast.success("Winga sale settled");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ✅ Use server function for return (bypasses RLS)
  const returnItem = useMutation({
    mutationFn: async (saleId: string) => {
      await returnWingaSaleFn({ data: { sale_id: saleId } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["winga-sales"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["inventory-pos"] });
      toast.success("Phone returned to inventory");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalOutstanding = wingaSales.reduce((sum, s) => {
    const total = (Number(s.sell_price) - Number(s.discount)) * Number(s.quantity);
    return sum + total;
  }, 0);

  return (
    <div className={cn(
      "space-y-6 -m-4 sm:-m-6 p-4 sm:p-6 min-h-full rounded-3xl",
      theme === "dark" ? "bg-[#0f0a12]" : "bg-[#F7F5FA]"
    )}>
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-pink-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-20 h-24 w-24 rounded-full bg-rose-500/20 blur-2xl" />
        <div className="relative z-10">
          <h1 className="text-2xl font-bold">Winga (Agent) Sales</h1>
          <p className="mt-1 text-sm text-white/70">Track phones given to agents and record payments</p>
        </div>
        <div className="relative z-10 mt-4 flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 backdrop-blur-sm">
            <DollarSign className="h-4 w-4 text-white/60" />
            <span>Outstanding: {formatTZS(totalOutstanding)}</span>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 backdrop-blur-sm">
            <span>{wingaSales.length} items on winga</span>
          </div>
        </div>
      </div>

      <Card className={cn(
        "p-4 overflow-x-auto",
        theme === "dark" ? "bg-slate-800/90 border-slate-700" : "bg-white/80"
      )}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={theme === "dark" ? "text-slate-300" : ""}>Date</TableHead>
              <TableHead className={theme === "dark" ? "text-slate-300" : ""}>Item</TableHead>
              <TableHead className={theme === "dark" ? "text-slate-300" : ""}>IMEI</TableHead>
              <TableHead className={theme === "dark" ? "text-slate-300" : ""}>Agent</TableHead>
              <TableHead className={cn("text-right", theme === "dark" ? "text-slate-300" : "")}>Amount</TableHead>
              <TableHead className={cn("text-right", theme === "dark" ? "text-slate-300" : "")}>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {wingaSales.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className={cn("text-center py-6", theme === "dark" ? "text-slate-400" : "text-muted-foreground")}>
                  No outstanding winga sales.
                </TableCell>
              </TableRow>
            )}
            {wingaSales.map((s) => {
              const total = (Number(s.sell_price) - Number(s.discount)) * Number(s.quantity);
              const itemLabel = s.inventory_items
                ? (s.inventory_items.item_type === "phone"
                  ? `${s.inventory_items.brand ?? ""} ${s.inventory_items.model ?? ""}`.trim()
                  : s.inventory_items.name ?? "")
                : "—";
              return (
                <TableRow key={s.id} className={theme === "dark" ? "hover:bg-slate-700/50" : "hover:bg-muted/50"}>
                  <TableCell className={cn("text-xs", theme === "dark" ? "text-slate-300" : "")}>
                    {formatDate(s.sale_date)}
                  </TableCell>
                  <TableCell className={cn("font-medium", theme === "dark" ? "text-slate-200" : "")}>
                    {itemLabel}
                  </TableCell>
                  <TableCell className={cn("font-mono text-xs", theme === "dark" ? "text-slate-300" : "")}>
                    {s.imei || "—"}
                  </TableCell>
                  <TableCell className={theme === "dark" ? "text-slate-300" : ""}>
                    {s.agents?.name || "Unknown"}
                  </TableCell>
                  <TableCell className={cn("text-right font-semibold", theme === "dark" ? "text-white" : "")}>
                    {formatTZS(total)}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSettleSaleId(s.id);
                        setSettleAmount("");
                        setSettleOpen(true);
                      }}
                      className="border-pink-500/30 text-pink-500 hover:bg-pink-500/10"
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Settle
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (confirm("Return this phone to inventory? This will restore stock.")) {
                          returnItem.mutate(s.id);
                        }
                      }}
                      disabled={returnItem.isPending}
                      className="border-amber-500/30 text-amber-500 hover:bg-amber-500/10"
                    >
                      <Undo2 className="h-3 w-3 mr-1" />
                      Return
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={settleOpen} onOpenChange={setSettleOpen}>
        <DialogContent className={theme === "dark" ? "bg-slate-800 border-slate-700 text-white" : ""}>
          <DialogHeader>
            <DialogTitle className={theme === "dark" ? "text-white" : ""}>Settle Winga Sale</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label className={theme === "dark" ? "text-slate-300" : ""}>Amount Received</Label>
            <Input
              type="number"
              value={settleAmount}
              onChange={(e) => setSettleAmount(e.target.value)}
              placeholder="Enter amount"
              className={theme === "dark" ? "border-slate-700 bg-slate-900 text-white" : ""}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSettleOpen(false)} className={theme === "dark" ? "text-slate-300 hover:text-white hover:bg-slate-700" : ""}>Cancel</Button>
            <Button
              onClick={() => settle.mutate()}
              disabled={settle.isPending || !settleAmount}
              className="bg-gradient-to-r from-pink-500 to-rose-500 text-white"
            >
              {settle.isPending ? "Processing..." : "Settle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
