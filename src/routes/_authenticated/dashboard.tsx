import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import { formatTZS } from "@/lib/format";
import { useMyRole } from "@/hooks/use-role";
import {
  ShoppingCart,
  TrendingUp,
  Wrench,
  AlertTriangle,
  CreditCard,
  DollarSign,
  Store,
  Users as UsersIcon,
  Package,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { t } = useI18n();
  const { data: myRole } = useMyRole();
  const isSuper = myRole?.isSuperAdmin ?? false;

  if (isSuper) {
    return <PlatformDashboard />;
  }

  return <ShopDashboard />;
}

function ShopDashboard() {
  const { t } = useI18n();
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
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

  const statCards = [
    { label: t("todaySales"), value: formatTZS(stats?.today ?? 0), icon: ShoppingCart, color: "bg-blue-500/20 text-blue-600", ring: "ring-blue-500/30" },
    { label: t("monthSales"), value: formatTZS(stats?.month ?? 0), icon: TrendingUp, color: "bg-emerald-500/20 text-emerald-600", ring: "ring-emerald-500/30" },
    { label: t("monthProfit"), value: formatTZS(stats?.monthProfit ?? 0), icon: DollarSign, color: "bg-violet-500/20 text-violet-600", ring: "ring-violet-500/30" },
    { label: t("lowStock"), value: String(stats?.lowStock ?? 0), icon: AlertTriangle, color: "bg-amber-500/20 text-amber-600", ring: "ring-amber-500/30" },
    { label: t("repairs"), value: String(stats?.openRepairs ?? 0), icon: Wrench, color: "bg-rose-500/20 text-rose-600", ring: "ring-rose-500/30" },
    { label: t("debtors"), value: formatTZS(stats?.debtors ?? 0), icon: CreditCard, color: "bg-cyan-500/20 text-cyan-600", ring: "ring-cyan-500/30" },
  ];

  // Greeting based on time
  const hour = new Date().getHours();
  let greeting = "Good morning";
  if (hour >= 12 && hour < 17) greeting = "Good afternoon";
  else if (hour >= 17) greeting = "Good evening";

  return (
    <div className="space-y-6">
      {/* Header with gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-20 h-24 w-24 rounded-full bg-emerald-500/20 blur-2xl" />
        <div className="relative z-10">
          <h1 className="text-2xl font-bold">
            {greeting} <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-300">Admin</span>
          </h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-white/70">
            <Sparkles className="h-4 w-4 text-emerald-400" />
            {t("tagline")}
          </p>
        </div>
        {/* Mini stats row inside header */}
        <div className="relative z-10 mt-4 flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 backdrop-blur-sm">
            <span className="text-white/60">Today</span>
            <span className="font-semibold">{formatTZS(stats?.today ?? 0)}</span>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 backdrop-blur-sm">
            <span className="text-white/60">Month</span>
            <span className="font-semibold">{formatTZS(stats?.month ?? 0)}</span>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 backdrop-blur-sm">
            <span className="text-white/60">Profit</span>
            <span className="font-semibold">{formatTZS(stats?.monthProfit ?? 0)}</span>
          </div>
        </div>
      </div>

      {/* Stat cards grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className="border-0 bg-white/80 shadow-sm backdrop-blur-sm transition hover:shadow-md dark:bg-slate-900/80">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className={`rounded-full p-2 ring-1 ${card.ring} ${card.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">{card.label}</span>
                </div>
                <p className="mt-2 text-xl font-bold truncate">{card.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Optional: Recent activity or chart placeholder */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="border-0 bg-white/80 shadow-sm backdrop-blur-sm dark:bg-slate-900/80">
          <CardContent className="p-4">
            <h3 className="text-sm font-medium text-muted-foreground">Recent Sales</h3>
            <p className="mt-2 text-sm text-muted-foreground">Coming soon…</p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-white/80 shadow-sm backdrop-blur-sm dark:bg-slate-900/80">
          <CardContent className="p-4">
            <h3 className="text-sm font-medium text-muted-foreground">Stock Alerts</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {stats?.lowStock ?? 0} items low in stock
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Platform Dashboard (Super Admin)
// ──────────────────────────────────────────────────────────────

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

  const statCards = [
    { label: t("totalShops"), value: String(stats?.totalShops ?? 0), icon: Store, color: "bg-blue-500/20 text-blue-600", ring: "ring-blue-500/30" },
    { label: t("activeShops"), value: String(stats?.activeShops ?? 0), icon: Store, color: "bg-emerald-500/20 text-emerald-600", ring: "ring-emerald-500/30" },
    { label: t("suspendedShops"), value: String(stats?.suspendedShops ?? 0), icon: Store, color: "bg-amber-500/20 text-amber-600", ring: "ring-amber-500/30" },
    { label: t("totalUsers"), value: String(stats?.totalUsers ?? 0), icon: UsersIcon, color: "bg-violet-500/20 text-violet-600", ring: "ring-violet-500/30" },
    { label: t("totalSales"), value: formatTZS(stats?.totalSales ?? 0), icon: TrendingUp, color: "bg-cyan-500/20 text-cyan-600", ring: "ring-cyan-500/30" },
    { label: t("totalRepairs"), value: String(stats?.totalRepairs ?? 0), icon: Wrench, color: "bg-rose-500/20 text-rose-600", ring: "ring-rose-500/30" },
  ];

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-20 h-24 w-24 rounded-full bg-emerald-500/20 blur-2xl" />
        <div className="relative z-10">
          <h1 className="text-2xl font-bold">
            {t("platformDashboard")}
          </h1>
          <p className="mt-1 text-sm text-white/70">Super Admin Overview</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className="border-0 bg-white/80 shadow-sm backdrop-blur-sm transition hover:shadow-md dark:bg-slate-900/80">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className={`rounded-full p-2 ring-1 ${card.ring} ${card.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">{card.label}</span>
                </div>
                <p className="mt-2 text-xl font-bold truncate">{card.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
