import { createFileRoute, Link, Outlet, redirect, useLocation, useNavigate, useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useMyRole, type AppRole } from "@/hooks/use-role";
import {
  LayoutDashboard,
  Boxes,
  ShoppingCart,
  Users,
  Wrench,
  ShieldCheck,
  CreditCard,
  Receipt,
  BarChart3,
  UserCog,
  Smartphone,
  Building2,
  LogOut,
  Menu,
  Trash2,
  History,
  BookOpen,
  ShieldAlert,
} from "lucide-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";
// Import the theme hook
import { useTheme } from "@/lib/theme";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    return { userId: data.user.id };
  },
  component: Layout,
});

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }>; roles?: AppRole[] };

function Layout() {
  const { t, lang, setLang } = useI18n();
  const { data: myRole } = useMyRole();
  const role = myRole?.role ?? null;
  const isSuperFromHook = myRole?.isSuperAdmin ?? false;

  // Hard‑coded super admin fallback (by email)
  const { data: user } = useQuery({
    queryKey: ["authUser"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user;
    },
    staleTime: 5 * 60 * 1000,
  });

  const isSuperAdminByEmail = user?.email === "kulwakulangwa@gmail.com";
  const isSuper = isSuperFromHook || isSuperAdminByEmail;

  const navigate = useNavigate();
  const router = useRouter();
  const qc = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Theme hook for dark mode toggle
  const { theme, toggleTheme } = useTheme();

  const items: NavItem[] = isSuper
    ? [
        { to: "/dashboard", label: "platformDashboard", icon: LayoutDashboard },
        { to: "/shops", label: "shops", icon: Building2 },
        { to: "/audit", label: "auditLog", icon: History },
        { to: "/errors", label: "errorMonitoring", icon: ShieldAlert },
        { to: "/help", label: "helpCenter", icon: BookOpen },
      ]
    : [
        { to: "/dashboard", label: "dashboard", icon: LayoutDashboard },
        { to: "/sales", label: "sales", icon: ShoppingCart },
        { to: "/inventory", label: "inventory", icon: Boxes, roles: ["shop_admin"] },
        { to: "/customers", label: "customers", icon: Users },
        { to: "/repairs", label: "repairs", icon: Wrench, roles: ["shop_admin", "technician"] },
        { to: "/warranties", label: "warranties", icon: ShieldCheck },
        { to: "/installments", label: "installments", icon: CreditCard, roles: ["shop_admin", "cashier"] },
        { to: "/expenses", label: "expenses", icon: Receipt, roles: ["shop_admin"] },
        { to: "/reports", label: "reports", icon: BarChart3, roles: ["shop_admin"] },
        { to: "/users", label: "staff", icon: UserCog, roles: ["shop_admin"] },
        { to: "/trash", label: "trash", icon: Trash2, roles: ["shop_admin"] },
        { to: "/help", label: "helpCenter", icon: BookOpen },
      ];

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
    router.invalidate();
  };

  const visible = items.filter((it) => !it.roles || (role && it.roles.includes(role)));

  const roleLabel = role ? t(role) : "…";

  const nav = (
    <nav className="flex flex-col gap-0.5 p-3">
      {visible.map((it) => {
        const active = location.pathname.startsWith(it.to);
        const Icon = it.icon;
        return (
          <Link
            key={it.to}
            to={it.to}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-200",
              active
                ? "bg-gradient-to-r from-pink-500/30 to-rose-500/20 text-white font-medium shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]"
                : "text-white/60 hover:bg-white/10 hover:text-white hover:shadow-sm",
            )}
          >
            <Icon className={cn("h-4 w-4", active ? "text-pink-400" : "text-white/40")} />
            {t(it.label as any)}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className={cn(
      "min-h-screen flex",
      theme === "dark" ? "bg-[#0f0a12]" : "bg-[#F7F5FA]"
    )}>
      {/* Desktop sidebar – dark gradient with pink accents */}
      <aside className="hidden lg:flex w-64 bg-gradient-to-b from-[#1F0A28] to-[#2D1440] text-white flex-col border-r border-white/5 shadow-xl">
        <div className="p-5 flex items-center gap-3 border-b border-white/10">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 shadow-lg shadow-pink-500/30">
            <Smartphone className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-wide">{t("appName")}</p>
            <p className="text-[11px] text-white/40 capitalize">{roleLabel}</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-2">{nav}</div>
        <div className="p-4 border-t border-white/10 space-y-3">
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => setLang("en")}
              className={cn(
                "px-2 py-1 rounded transition",
                lang === "en"
                  ? "bg-white/20 text-white"
                  : "text-white/40 hover:bg-white/10 hover:text-white/80",
              )}
            >
              EN
            </button>
            <button
              onClick={() => setLang("sw")}
              className={cn(
                "px-2 py-1 rounded transition",
                lang === "sw"
                  ? "bg-white/20 text-white"
                  : "text-white/40 hover:bg-white/10 hover:text-white/80",
              )}
            >
              SW
            </button>
            {/* Dark mode toggle */}
            <button
              onClick={toggleTheme}
              className={cn(
                "px-2 py-1 rounded transition",
                "hover:bg-white/10"
              )}
              aria-label="Toggle theme"
            >
              {theme === "light" ? "🌙" : "☀️"}
            </button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-white/60 hover:bg-white/10 hover:text-white transition"
            onClick={signOut}
          >
            <LogOut className="mr-2 h-4 w-4" /> {t("signOut")}
          </Button>
        </div>
      </aside>

      {/* Mobile overlay sidebar – same dark theme with pink accents */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="w-64 bg-gradient-to-b from-[#1F0A28] to-[#2D1440] text-white flex flex-col shadow-2xl">
            <div className="p-4 flex items-center gap-3 border-b border-white/10">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 shadow-md">
                <Smartphone className="h-5 w-5 text-white" />
              </div>
              <p className="text-sm font-semibold">{t("appName")}</p>
            </div>
            <div className="flex-1 overflow-y-auto py-2">{nav}</div>
            <div className="p-4 border-t border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-white/40">Theme</span>
                <button
                  onClick={toggleTheme}
                  className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 transition"
                >
                  {theme === "light" ? "🌙" : "☀️"}
                </button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-white/60 hover:bg-white/10 hover:text-white transition"
                onClick={signOut}
              >
                <LogOut className="mr-2 h-4 w-4" /> {t("signOut")}
              </Button>
            </div>
          </div>
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      <main className="flex-1 flex flex-col min-w-0">
        {/* Mobile header – matches the sidebar theme */}
        <header className={cn(
          "lg:hidden flex items-center justify-between border-b p-3",
          theme === "dark"
            ? "bg-[#1a0f20] border-[#2a1a30] text-white"
            : "bg-white/80 backdrop-blur-sm border-border text-slate-800"
        )}>
          <button onClick={() => setMobileOpen(true)} className="p-2">
            <Menu className={cn("h-5 w-5", theme === "dark" ? "text-white" : "text-slate-700")} />
          </button>
          <p className={cn("text-sm font-semibold", theme === "dark" ? "text-white" : "text-slate-800")}>
            {t("appName")}
          </p>
          <div className="flex items-center gap-1 text-xs">
            <button
              onClick={() => setLang("en")}
              className={lang === "en" ? "font-semibold" : "text-slate-400"}
            >
              EN
            </button>
            <span className="text-slate-300">·</span>
            <button
              onClick={() => setLang("sw")}
              className={lang === "sw" ? "font-semibold" : "text-slate-400"}
            >
              SW
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
