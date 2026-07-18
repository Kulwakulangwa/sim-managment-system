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

  const items: NavItem[] = isSuper
    ? [
        { to: "/dashboard", label: "platformDashboard", icon: LayoutDashboard },
        { to: "/shops", label: "shops", icon: Building2 },
        { to: "/audit", label: "auditLog", icon: History },          // ✅ super_admin only
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
        // ❌ Audit log removed from here – only super_admin can see it
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
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {t(it.label as any)}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="hidden lg:flex w-64 bg-sidebar text-sidebar-foreground flex-col border-r border-sidebar-border">
        <div className="p-4 flex items-center gap-3 border-b border-sidebar-border">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Smartphone className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">{t("appName")}</p>
            <p className="text-xs text-sidebar-foreground/60 capitalize">{roleLabel}</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">{nav}</div>
        <div className="p-3 border-t border-sidebar-border space-y-2">
          <div className="flex items-center gap-1 text-xs">
            <button onClick={() => setLang("en")} className={cn("px-2 py-1 rounded", lang === "en" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/60")}>EN</button>
            <button onClick={() => setLang("sw")} className={cn("px-2 py-1 rounded", lang === "sw" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/60")}>SW</button>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> {t("signOut")}
          </Button>
        </div>
      </aside>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="w-64 bg-sidebar text-sidebar-foreground flex flex-col">
            <div className="p-4 flex items-center gap-3 border-b border-sidebar-border">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Smartphone className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold">{t("appName")}</p>
            </div>
            <div className="flex-1 overflow-y-auto">{nav}</div>
            <div className="p-3 border-t border-sidebar-border">
              <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground/80" onClick={signOut}>
                <LogOut className="mr-2 h-4 w-4" /> {t("signOut")}
              </Button>
            </div>
          </div>
          <div className="flex-1 bg-black/40" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      <main className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden flex items-center justify-between border-b border-border p-3 bg-card">
          <button onClick={() => setMobileOpen(true)} className="p-2"><Menu className="h-5 w-5" /></button>
          <p className="text-sm font-semibold">{t("appName")}</p>
          <div className="flex items-center gap-1 text-xs">
            <button onClick={() => setLang("en")} className={lang === "en" ? "font-semibold" : "text-muted-foreground"}>EN</button>
            <span>·</span>
            <button onClick={() => setLang("sw")} className={lang === "sw" ? "font-semibold" : "text-muted-foreground"}>SW</button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
