import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { formatTZS } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, DollarSign, Receipt, BarChart3, Package, ShoppingCart } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({ component: ReportsPage });

function ReportsPage() {
  const { t } = useI18n();

  const { data } = useQuery({
    queryKey: ["reports"],
    queryFn: async () => {
      const [salesRes, expRes, invRes] = await Promise.all([
        supabase.from("sales").select("sell_price, discount, quantity, profit, inventory_items(brand, model, item_type, name)"),
        supabase.from("expenses").select("amount"),
        supabase.from("inventory_items").select("*").order("quantity"),
      ]);
      const sales = salesRes.data ?? [];
      const totalRev = sales.reduce((s, r) => s + (Number(r.sell_price) - Number(r.discount)) * Number(r.quantity), 0);
      const totalProfit = sales.reduce((s, r) => s + Number(r.profit ?? 0), 0);
      const totalExp = (expRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0);
      // best sellers
      const bucket = new Map<string, number>();
      for (const s of sales) {
        const it = s.inventory_items;
        if (!it || it.item_type !== "phone") continue;
        const key = `${it.brand ?? ""} ${it.model ?? ""}`.trim() || "—";
        bucket.set(key, (bucket.get(key) ?? 0) + Number(s.quantity));
      }
      const best = Array.from(bucket.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
      return { totalRev, totalProfit, totalExp, netProfit: totalProfit - totalExp, best, inv: invRes.data ?? [] };
    },
  });

  const stats = [
    { label: t("monthSales"), value: formatTZS(data?.totalRev ?? 0), icon: ShoppingCart, color: "text-emerald-400" },
    { label: t("monthProfit"), value: formatTZS(data?.totalProfit ?? 0), icon: TrendingUp, color: "text-blue-400" },
    { label: t("expenses"), value: formatTZS(data?.totalExp ?? 0), icon: Receipt, color: "text-amber-400" },
    { label: `${t("profit")} (net)`, value: formatTZS(data?.netProfit ?? 0), icon: DollarSign, color: "text-rose-400" },
  ];

  return (
    <div className="space-y-6">
      {/* Header with gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-20 h-24 w-24 rounded-full bg-emerald-500/20 blur-2xl" />
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

      {/* Stats cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="border-0 bg-white/80 shadow-sm backdrop-blur-sm dark:bg-slate-900/80 transition hover:shadow-md">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</p>
                <p className="text-lg font-bold">{s.value}</p>
              </div>
              <div className={`rounded-full p-2 bg-white/10 ring-1 ring-white/20 ${s.color}`}>
                <s.icon className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tables grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Best Sellers */}
        <Card className="border-0 bg-white/80 shadow-sm backdrop-blur-sm dark:bg-slate-900/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              {t("bestSellers")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">{t("unitsSold")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.best ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center py-4 text-muted-foreground">
                      {t("empty")}
                    </TableCell>
                  </TableRow>
                )}
                {(data?.best ?? []).map(([k, v]) => (
                  <TableRow key={k} className="hover:bg-muted/50 transition">
                    <TableCell className="font-medium">{k}</TableCell>
                    <TableCell className="text-right">{v}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Stock Report */}
        <Card className="border-0 bg-white/80 shadow-sm backdrop-blur-sm dark:bg-slate-900/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4 text-amber-500" />
              {t("stockReport")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">{t("stock")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.inv ?? []).slice(0, 15).map((i) => {
                  const label = i.item_type === "phone" ? `${i.brand ?? ""} ${i.model ?? ""}`.trim() : i.name;
                  const low = i.quantity <= i.low_stock_threshold;
                  return (
                    <TableRow key={i.id} className="hover:bg-muted/50 transition">
                      <TableCell className="font-medium">{label}</TableCell>
                      <TableCell className="text-right">
                        {low ? <Badge variant="destructive">{i.quantity}</Badge> : i.quantity}
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
