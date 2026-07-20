import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  Plus,
  Package,
  Receipt,
  CalendarClock,
} from "lucide-react";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/dashboard")({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    const role = roleData?.role;
    // Salespersons go to sales page
    if (role === "salesperson") {
      throw redirect({ to: "/sales" });
    }
    // Technicians go to repairs page
    if (role === "technician") {
      throw redirect({ to: "/repairs" });
    }
    // For shop_admin, cashier, super_admin – allow dashboard
  },
  component: Dashboard,
});

// ─── Theme tokens ──────────────────────────────────────────
const TILE_GRADIENTS: Record<string, string> = {
  ember: "bg-gradient-to-br from-[#F2994A] to-[#F2C94C]",
  wine: "bg-gradient-to-br from-[#6B2338] to-[#3C1524]",
  crimson: "bg-gradient-to-br from-[#E63965] to-[#A81F49]",
  slate: "bg-gradient-to-br from-[#4A4458] to-[#2E2A38]",
};

// ─── Stat Card ────────────────────────────────────────────
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
    <div className="rounded-2xl bg-white dark:bg-slate-800/90 border border-black/5 dark:border-slate-700/50 shadow-sm hover:shadow-md transition-shadow p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span
          className={`inline-flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-sm ${TILE_GRADIENTS[badge]}`}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-400">{label}</p>
        <p className="text-lg sm:text-xl font-semibold text-slate-800 dark:text-white truncate mt-0.5">{value}</p>
      </div>
    </div>
  );
}

// ─── Progress Ring ────────────────────────────────────────
function ProgressRing({ percent, label }: { percent: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const radius = 72;
  const stroke = 14;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative h-44 w-44 sm:h-52 sm:w-52 mx-auto">
      <svg height="100%" width="100%" viewBox={`0 0 ${radius * 2} ${radius * 2}`} className="-rotate-90">
        <defs>
          <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#C45BA0" />
            <stop offset="100%" stopColor="#8B3A8F" />
          </linearGradient>
        </defs>
        <circle
          stroke="rgba(255,255,255,0.08)"
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        <circle
          stroke="url(#ringGradient)"
          fill="transparent"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl sm:text-4xl font-bold text-white">{clamped.toFixed(0)}%</span>
        <span className="text-[11px] uppercase tracking-wide text-white/50 mt-1">{label}</span>
      </div>
    </div>
  );
}

// ─── Quick Action Button ──────────────────────────────────
function QuickAction({
  label,
  icon: Icon,
  tone,
}: {
  label: string;
  icon: React.ElementType;
  tone: keyof typeof TILE_GRADIENTS;
}) {
  return (
    <button
      type="button"
      className={`w-full rounded-2xl p-4 flex items-center gap-3 text-left text-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all ${TILE_GRADIENTS[tone]}`}
    >
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

// ─── Main Dashboard ────────────────────────────────────────
function Dashboard() {
  const { t } = useI18n();
  const { data: myRole, error: roleError } = useMyRole();
  const { theme } = useTheme();
  const isSuper = myRole?.isSuperAdmin ?? false;

  console.log("[Dashboard] myRole:", myRole);
  console.log("[Dashboard] roleError:", roleError);
  console.log("[Dashboard] isSuper:", isSuper);

  // ── Fetch current user's expiry for self-view (shop admins only) ──
  const { data: userRole } = useQuery({
    queryKey: ["user-role-expiry"],
    enabled: !isSuper, // only for non-super admins
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from("user_roles")
        .select("expires_at, role")
        .eq("user_id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // ── Shop dashboard stats ──────────────────────────────────
  const { data: stats, error: statsError, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    enabled: !isSuper,
    queryFn: async () => {
      try {
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
        const month = sum(monthRes.data);
        const monthProfit = sumProfit(monthRes.data);

        return {
          today: sum(todayRes.data),
          month,
          monthProfit,
          marginPct: month > 0 ? (monthProfit / month) * 100 : 0,
          lowStock: low,
          openRepairs: (repairsRes.data ?? []).length,
          debtors: debt,
        };
      } catch (err) {
        console.error("[Dashboard] Query error:", err);
        throw err;
      }
    },
  });

  if (isSuper) return <PlatformDashboard />;

  // ── Shop admin cards ──────────────────────────────────────
  const cards: { label: string; value: string; icon: React.ElementType; badge: keyof typeof TILE_GRADIENTS }[] = [
    { label: t("todaySales"), value: formatTZS(stats?.today ?? 0), icon: ShoppingCart, badge: "ember" },
    { label: t("monthSales"), value: formatTZS(stats?.month ?? 0), icon: TrendingUp, badge: "slate" },
    { label: t("monthProfit"), value: formatTZS(stats?.monthProfit ?? 0), icon: DollarSign, badge: "crimson" },
    { label: t("lowStock"), value: String(stats?.lowStock ?? 0), icon: AlertTriangle, badge: "ember" },
    { label: t("repairs"), value: String(stats?.openRepairs ?? 0), icon: Wrench, badge: "slate" },
    { label: t("debtors"), value: formatTZS(stats?.debtors ?? 0), icon: CreditCard, badge: "wine" },
  ];

  // ── Expiry self-view ──────────────────────────────────────
  const expiryCard = userRole ? (
    <Card className="border-0 bg-white/80 shadow-sm backdrop-blur-sm dark:bg-slate-800/90 p-4 col-span-full">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-gradient-to-br from-pink-500/20 to-rose-500/10 p-2 ring-1 ring-pink-500/20">
            <CalendarClock className="h-5 w-5 text-pink-500" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground dark:text-slate-400">Account Expiry</p>
            <p className="text-lg font-semibold text-slate-800 dark:text-white">
              {userRole.expires_at ? (
                new Date(userRole.expires_at) < new Date() ? (
                  <span className="text-red-500">Expired</span>
                ) : (
                  new Date(userRole.expires_at).toLocaleDateString()
                )
              ) : (
                "Never"
              )}
            </p>
          </div>
        </div>
        {userRole.expires_at && new Date(userRole.expires_at) > new Date() && (
          <div className="text-sm text-muted-foreground dark:text-slate-400">
            {Math.ceil((new Date(userRole.expires_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days remaining
          </div>
        )}
      </div>
    </Card>
  ) : null;

  return (
    <div className={cn(
      "space-y-6 -m-4 sm:-m-6 p-4 sm:p-6 min-h-full rounded-3xl",
      theme === "dark" ? "bg-[#0f0a12]" : "bg-[#F7F5FA]"
    )}>
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{t("dashboard")}</h1>
        <p className="text-sm text-slate-400 dark:text-slate-400">{t("tagline")}</p>
      </div>

      {expiryCard}

      <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => (
          <StatCard key={c.label} {...c} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-3xl bg-gradient-to-br from-[#3A1442] to-[#1F0A28] p-6 flex flex-col sm:flex-row items-center gap-6">
          <ProgressRing percent={stats?.marginPct ?? 0} label={t("monthProfit")} />
          <div className="text-white/90 space-y-2 text-center sm:text-left">
            <p className="text-xs uppercase tracking-wide text-white/40">{t("monthSales")}</p>
            <p className="text-2xl font-bold">{formatTZS(stats?.month ?? 0)}</p>
            <p className="text-sm text-white/60">
              {formatTZS(stats?.monthProfit ?? 0)} {t("monthProfit").toLowerCase()}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
          <QuickAction label={t("todaySales")} icon={Plus} tone="crimson" />
          <QuickAction label={t("lowStock")} icon={Package} tone="ember" />
          <QuickAction label={t("repairs")} icon={Wrench} tone="wine" />
          <QuickAction label={t("debtors")} icon={Receipt} tone="slate" />
        </div>
      </div>
    </div>
  );
}

// ─── Platform Dashboard (Super Admin) ──────────────────────
function PlatformDashboard() {
  const { t } = useI18n();
  const { theme } = useTheme();
  const { data: stats, error: statsError } = useQuery({
    queryKey: ["platform-stats"],
    queryFn: async () => {
      try {
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
      } catch (err) {
        console.error("[PlatformDashboard] Query error:", err);
        throw err;
      }
    },
  });

  console.log("[PlatformDashboard] stats:", stats);
  console.log("[PlatformDashboard] statsError:", statsError);

  const cards: { label: string; value: string; icon: React.ElementType; badge: keyof typeof TILE_GRADIENTS }[] = [
    { label: t("totalShops"), value: String(stats?.totalShops ?? 0), icon: Store, badge: "slate" },
    { label: t("activeShops"), value: String(stats?.activeShops ?? 0), icon: Store, badge: "ember" },
    { label: t("suspendedShops"), value: String(stats?.suspendedShops ?? 0), icon: Store, badge: "wine" },
    { label: t("totalUsers"), value: String(stats?.totalUsers ?? 0), icon: UsersIcon, badge: "slate" },
    { label: t("totalSales"), value: formatTZS(stats?.totalSales ?? 0), icon: TrendingUp, badge: "crimson" },
    { label: t("totalRepairs"), value: String(stats?.totalRepairs ?? 0), icon: Wrench, badge: "ember" },
  ];

  return (
    <div className={cn(
      "space-y-6 -m-4 sm:-m-6 p-4 sm:p-6 min-h-full rounded-3xl",
      theme === "dark" ? "bg-[#0f0a12]" : "bg-[#F7F5FA]"
    )}>
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{t("platformDashboard")}</h1>
      </div>
      <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => (
          <StatCard key={c.label} {...c} />
        ))}
      </div>
    </div>
  );
}
