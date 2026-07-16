import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { formatTZS } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

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
    { label: t("monthSales"), value: formatTZS(data?.totalRev ?? 0) },
    { label: t("monthProfit"), value: formatTZS(data?.totalProfit ?? 0) },
    { label: t("expenses"), value: formatTZS(data?.totalExp ?? 0) },
    { label: `${t("profit")} (net)`, value: formatTZS(data?.netProfit ?? 0) },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("reports")}</h1>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2"><p className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</p></CardHeader>
            <CardContent><p className="text-xl font-bold">{s.value}</p></CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t("bestSellers")}</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Model</TableHead><TableHead className="text-right">{t("unitsSold")}</TableHead></TableRow></TableHeader>
              <TableBody>
                {(data?.best ?? []).length === 0 && <TableRow><TableCell colSpan={2} className="text-center py-4 text-muted-foreground">{t("empty")}</TableCell></TableRow>}
                {(data?.best ?? []).map(([k, v]) => (
                  <TableRow key={k}><TableCell className="font-medium">{k}</TableCell><TableCell className="text-right">{v}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t("stockReport")}</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Item</TableHead><TableHead className="text-right">{t("stock")}</TableHead></TableRow></TableHeader>
              <TableBody>
                {(data?.inv ?? []).slice(0, 15).map((i) => {
                  const label = i.item_type === "phone" ? `${i.brand ?? ""} ${i.model ?? ""}`.trim() : i.name;
                  const low = i.quantity <= i.low_stock_threshold;
                  return (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{label}</TableCell>
                      <TableCell className="text-right">{low ? <Badge variant="destructive">{i.quantity}</Badge> : i.quantity}</TableCell>
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
