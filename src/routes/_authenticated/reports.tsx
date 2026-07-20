import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { formatTZS } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, DollarSign, Receipt, BarChart3, Package, ShoppingCart, Wrench, Calendar } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/reports")({ component: ReportsPage });

// ─── Colored badge mapping ────────────────────────────────────
const TILE_GRADIENTS: Record<string, string> = {
  ember: "bg-gradient-to-br from-[#F2994A] to-[#F2C94C]",
  wine: "bg-gradient-to-br from-[#6B2338] to-[#3C1524]",
  crimson: "bg-gradient-to-br from-[#E63965] to-[#A81F49]",
  slate: "bg-gradient-to-br from-[#4A4458] to-[#2E2A38]",
  pink: "bg-gradient-to-br from-pink-500 to-rose-500",
};

function StatCard({
  label,
  value,
  icon: Icon,
  badge,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  badge: keyof typeof TILE_GRADIENTS;
}) {
  return (
    <div className="rounded-2xl bg-white/80 backdrop-blur-sm border border-black/5 shadow-sm hover:shadow-md transition-shadow p-4 flex flex-col gap-3 dark:bg-slate-800/90 dark:border-slate-700/50">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground dark:text-slate-400">{label}</p>
        <span
          className={`inline-flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-sm ${TILE_GRADIENTS[badge]}`}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div>
        <p className="text-lg sm:text-xl font-semibold text-slate-800 dark:text-white truncate">{value}</p>
      </div>
    </div>
  );
}

function ReportsPage() {
  const { t } = useI18n();
  const { theme } = useTheme();

  // ─── Date range state ────────────────────────────────────────
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const formatDateInput = (d: Date) => d.toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(formatDateInput(startOfMonth));
  const [endDate, setEndDate] = useState(formatDateInput(today));

  // ─── Preset handlers ────────────────────────────────────────
  const setPreset = (preset: "today" | "week" | "month" | "year") => {
    const now = new Date();
    let start = new Date();
    let end = new Date(now);
    switch (preset) {
      case "today":
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "week":
        const day = now.getDay();
        start = new Date(now);
        start.setDate(now.getDate() - day + (day === 0 ? -6 : 1)); // Monday
        end = new Date(now);
        break;
      case "month":
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now);
        break;
      case "year":
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now);
        break;
    }
    setStartDate(formatDateInput(start));
    setEndDate(formatDateInput(end));
  };

  // ─── Data fetching with date filters ──────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ["reports", startDate, endDate],
    queryFn: async () => {
      const start = startDate ? new Date(startDate).toISOString() : null;
      const end = endDate ? new Date(endDate + "T23:59:59").toISOString() : null;

      // ── Sales ──
      let salesQuery = supabase
        .from("sales")
        .select("sell_price, discount, quantity, profit, inventory_items(brand, model, item_type, name)");
      if (start) salesQuery = salesQuery.gte("sale_date", start);
      if (end) salesQuery = salesQuery.lte("sale_date", end);
      const salesRes = await salesQuery;

      // ── Expenses ──
      let expQuery = supabase.from("expenses").select("amount");
      if (start) expQuery = expQuery.gte("expense_date", start);
      if (end) expQuery = expQuery.lte("expense_date", end);
      const expRes = await expQuery;

      // ── Repairs (uses received_date) ──
      let repairsQuery = supabase
        .from("repairs")
        .select("repair_cost, paid_amount, payment_status, status");
      if (start) repairsQuery = repairsQuery.gte("received_date", start);
      if (end) repairsQuery = repairsQuery.lte("received_date", end);
      const repairsRes = await repairsQuery;

      // ── Inventory ──
      const invRes = await supabase
        .from("inventory_items")
        .select("*")
        .order("quantity");

      // ── Winga revenue (settled winga sales) ──
      let wingaQuery = supabase
        .from("sales")
        .select("sell_price, discount, quantity")
        .eq("winga_settled", true);
      if (start) wingaQuery = wingaQuery.gte("sale_date", start);
      if (end) wingaQuery = wingaQuery.lte("sale_date", end);
      const wingaRes = await wingaQuery;
      const wingaRevenue = (wingaRes.data ?? []).reduce(
        (s, r) => s + (Number(r.sell_price) - Number(r.discount)) * Number(r.quantity),
        0
      );

      const sales = salesRes.data ?? [];
      const totalRev = sales.reduce((s, r) => s + (Number(r.sell_price) - Number(r.discount)) * Number(r.quantity), 0);
      const totalProfit = sales.reduce((s, r) => s + Number(r.profit ?? 0), 0);
      const totalExp = (expRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0);

      const repairs = repairsRes.data ?? [];
      const repairIncome = repairs
        .filter((r) => r.status === "completed" && r.payment_status === "paid")
        .reduce((sum, r) => sum + Number(r.paid_amount || 0), 0);

      // Best sellers
      const bucket = new Map<string, number>();
      for (const s of sales) {
        const it = s.inventory_items;
        if (!it || it.item_type !== "phone") continue;
        const key = `${it.brand ?? ""} ${it.model ?? ""}`.trim() || "—";
        bucket.set(key, (bucket.get(key) ?? 0) + Number(s.quantity));
      }
      const best = Array.from(bucket.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);

      return {
        totalRev,
        totalProfit,
        totalExp,
        netProfit: totalProfit - totalExp,
        best,
        inv: invRes.data ?? [],
        repairIncome,
        wingaRevenue,
      };
    },
  });

  const stats = [
    { label: "Sales Revenue", value: formatTZS(data?.totalRev ?? 0), icon: ShoppingCart, badge: "ember" },
    { label: "Repair Income", value: formatTZS(data?.repairIncome ?? 0), icon: Wrench, badge: "pink" },
    { label: "Winga Revenue", value: formatTZS(data?.wingaRevenue ?? 0), icon: DollarSign, badge: "crimson" },
    { label: "Expenses", value: formatTZS(data?.totalExp ?? 0), icon: Receipt, badge: "wine" },
    { label: "Net Profit", value: formatTZS(data?.netProfit ?? 0), icon: DollarSign, badge: "slate" },
  ];

  return (
    <div className={cn(
      "space-y-6 -m-4 sm:-m-6 p-4 sm:p-6 min-h-full rounded-3xl",
      theme === "dark" ? "bg-[#0f0a12]" : "bg-[#F7F5FA]"
    )}>
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-pink-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-20 h-24 w-24 rounded-full bg-rose-500/20 blur-2xl" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{t("reports")}</h1>
            <p className="mt-1 text-sm text-white/70">Business performance and analytics</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 backdrop-blur-sm">
              <BarChart3 className="h-4 w-4 text-white/60" />
              <span className="text-sm">Overview</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Date range picker ────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-3 bg-white/80 dark:bg-slate-800/90 p-4 rounded-xl backdrop-blur-sm border border-black/5 dark:border-slate-700/50">
        <div>
          <Label className="text-xs font-medium text-muted-foreground dark:text-slate-400">From</Label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={cn(
              "w-40",
              theme === "dark" ? "border-slate-700 bg-slate-900 text-white" : ""
            )}
          />
        </div>
        <div>
          <Label className="text-xs font-medium text-muted-foreground dark:text-slate-400">To</Label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={cn(
              "w-40",
              theme === "dark" ? "border-slate-700 bg-slate-900 text-white" : ""
            )}
          />
        </div>
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="outline" onClick={() => setPreset("today")} className="text-xs">Today</Button>
          <Button size="sm" variant="outline" onClick={() => setPreset("week")} className="text-xs">This Week</Button>
          <Button size="sm" variant="outline" onClick={() => setPreset("month")} className="text-xs">This Month</Button>
          <Button size="sm" variant="outline" onClick={() => setPreset("year")} className="text-xs">This Year</Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* Tables */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className={cn(
          "border-0 shadow-sm backdrop-blur-sm",
          theme === "dark"
            ? "bg-slate-800/90 border-slate-700"
            : "bg-white/80"
        )}>
          <CardHeader className="pb-2">
            <CardTitle className={cn(
              "text-base flex items-center gap-2",
              theme === "dark" ? "text-slate-200" : ""
            )}>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              {t("bestSellers")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={theme === "dark" ? "text-slate-300" : ""}>Model</TableHead>
                  <TableHead className={cn("text-right", theme === "dark" ? "text-slate-300" : "")}>{t("unitsSold")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.best ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2} className={cn("text-center py-4", theme === "dark" ? "text-slate-400" : "text-muted-foreground")}>
                      {t("empty")}
                    </TableCell>
                  </TableRow>
                )}
                {(data?.best ?? []).map(([k, v]) => (
                  <TableRow key={k} className={cn(
                    "transition",
                    theme === "dark" ? "hover:bg-slate-700/50" : "hover:bg-muted/50"
                  )}>
                    <TableCell className={cn("font-medium", theme === "dark" ? "text-slate-200" : "")}>{k}</TableCell>
                    <TableCell className={cn("text-right", theme === "dark" ? "text-slate-300" : "")}>{v}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className={cn(
          "border-0 shadow-sm backdrop-blur-sm",
          theme === "dark"
            ? "bg-slate-800/90 border-slate-700"
            : "bg-white/80"
        )}>
          <CardHeader className="pb-2">
            <CardTitle className={cn(
              "text-base flex items-center gap-2",
              theme === "dark" ? "text-slate-200" : ""
            )}>
              <Package className="h-4 w-4 text-amber-500" />
              {t("stockReport")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={theme === "dark" ? "text-slate-300" : ""}>Item</TableHead>
                  <TableHead className={cn("text-right", theme === "dark" ? "text-slate-300" : "")}>{t("stock")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.inv ?? []).slice(0, 15).map((i) => {
                  const label = i.item_type === "phone" ? `${i.brand ?? ""} ${i.model ?? ""}`.trim() : i.name;
                  const low = i.quantity <= i.low_stock_threshold;
                  return (
                    <TableRow key={i.id} className={cn(
                      "transition",
                      theme === "dark" ? "hover:bg-slate-700/50" : "hover:bg-muted/50"
                    )}>
                      <TableCell className={cn("font-medium", theme === "dark" ? "text-slate-200" : "")}>{label}</TableCell>
                      <TableCell className="text-right">
                        {low ? (
                          <Badge variant="destructive">{i.quantity}</Badge>
                        ) : (
                          <span className={theme === "dark" ? "text-slate-300" : ""}>{i.quantity}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
