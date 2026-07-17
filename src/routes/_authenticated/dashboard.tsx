import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import { formatTZS } from "@/lib/format";
import { useMyRole } from "@/hooks/use-role";
import { ShoppingCart, TrendingUp, Wrench, AlertTriangle, CreditCard, DollarSign, Store, Users as UsersIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { t } = useI18n();
  const { data: myRole } = useMyRole();
  const isSuper = myRole?.isSuperAdmin ?? false;

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    enabled: !isSuper,
    queryFn: async () => {
      const now = new Date();
      const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [todayRes, monthRes, lowStockRes, repairsRes, debtorsRes] = await Promise.all([
        supabase.from("sales").select("sell_price, discount, quantity, profit").gte("sale_date", startToday),
        supabase.from("sales").select("sell_price, discount, quantity, profit").gte("sale_date", startMonth),
        supabase.from("inventory_items").select("id, quantity, low_stock_threshold"),
        supabase.from("repairs").select("id").in("status", ["received", "in_progress"]),
        supabase.from("installment_plans").select("balance"),
      ]);

      type SaleRow = { sell_price: number; discount: number; quantity: number; profit: number | null };
      const sum = (rows: SaleRow[] | null) =>
        (rows ?? []).reduce((s, r) => s + (Number(r.sell_price) - Number(r.discount)) * Number(r.quantity), 0);
      const sumProfit = (rows: SaleRow[] | null) =>
        (rows ?? []).reduce((s, r) => s + Number(r.profit ?? 0), 0);

      const low = (lowStockRes.data ?? []).filter((i) => (i.quantity ?? 0) <= (i.low_stock_threshold ?? 1)).length;
      const debt = (debtorsRes.data ?? []).reduce((s, r) => s + Number(r.balance ?? 0), 0);

      return {
        today: sum(todayRes.data),
        month: sum(monthRes.data),
        monthProfit: sumProfit(monthRes.data),
        lowStock: low,
        openRepairs: (repairsRes.data ?? []).length,
        debtors: debt,
      };
    },
  });

  if (isSuper) return <PlatformDashboard />;

  const cards = [
    { label: t("todaySales"), value: formatTZS(stats?.today ?? 0), icon: ShoppingCart, color: "text-primary" },
    { label: t("monthSales"), value: formatTZS(stats?.month ?? 0), icon: TrendingUp, color: "text-success" },
    { label: t("monthProfit"), value: formatTZS(stats?.monthProfit ?? 0), icon: DollarSign, color: "text-success" },
    { label: t("lowStock"), value: String(stats?.lowStock ?? 0), icon: AlertTriangle, color: "text-warning" },
    { label: t("repairs"), value: String(stats?.openRepairs ?? 0), icon: Wrench, color: "text-primary" },
    { label: t("debtors"), value: formatTZS(stats?.debtors ?? 0), icon: CreditCard, color: "text-destructive" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("dashboard")}</h1>
        <p className="text-sm text-muted-foreground">{t("tagline")}</p>
      </div>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">{c.label}</p>
                  <Icon className={`h-4 w-4 ${c.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-lg lg:text-xl font-bold truncate">{c.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function PlatformDashboard() {
  const { t } = useI18n();
  const { data: stats } = useQuery({
    queryKey: ["platform-stats"],
    queryFn: async () => {
      const [shopsRes, usersRes, salesRes, repairsRes] = await Promise.all([
        supabase.from("shops").select("id, status"),
        supabase.from("user_roles").select("user_id"),
        supabase.from("sales").select("sell_price, discount, quantity"),
        supabase.from("repairs").select("id"),
      ]);
      const shops = shopsRes.data ?? [];
      const totalSales = (salesRes.data ?? []).reduce(
        (s, r) => s + (Number(r.sell_price) - Number(r.discount)) * Number(r.quantity), 0,
      );
      return {
        totalShops: shops.length,
        activeShops: shops.filter((s) => s.status === "active").length,
        suspendedShops: shops.filter((s) => s.status === "suspended").length,
        totalUsers: new Set((usersRes.data ?? []).map((r) => r.user_id)).size,
        totalSales,
        totalRepairs: (repairsRes.data ?? []).length,
      };
    },
  });
  const cards = [
    { label: t("totalShops"), value: String(stats?.totalShops ?? 0), icon: Store, color: "text-primary" },
    { label: t("activeShops"), value: String(stats?.activeShops ?? 0), icon: Store, color: "text-success" },
    { label: t("suspendedShops"), value: String(stats?.suspendedShops ?? 0), icon: Store, color: "text-warning" },
    { label: t("totalUsers"), value: String(stats?.totalUsers ?? 0), icon: UsersIcon, color: "text-primary" },
    { label: t("totalSales"), value: formatTZS(stats?.totalSales ?? 0), icon: TrendingUp, color: "text-success" },
    { label: t("totalRepairs"), value: String(stats?.totalRepairs ?? 0), icon: Wrench, color: "text-primary" },
  ];
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">{t("platformDashboard")}</h1></div>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label}>
              <CardHeader className="pb-2"><div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{c.label}</p>
                <Icon className={`h-4 w-4 ${c.color}`} />
              </div></CardHeader>
              <CardContent><p className="text-lg lg:text-xl font-bold truncate">{c.value}</p></CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
