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
  DollarSign,
} from "lucide-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });

    const userId = data.user.id;

    // ─── Fetch user's role and shop_id ──────────────────────────
    const { data: userRole, error: roleError } = await supabase
      .from("user_roles")
      .select("role, shop_id")
      .eq("user_id", userId)
      .single();

    console.log("[RouteGuard] userRole:", userRole);
    console.log("[RouteGuard] roleError:", roleError);

    // Super admin bypass
    if (userRole?.role === "super_admin") {
      console.log("[RouteGuard] Super admin – skipping expiry check");
      return { userId };
    }

    // Shop admin: check own expiry
    if (userRole?.role === "shop_admin") {
      const { data: shopAdminData } = await supabase
        .from("user_roles")
        .select("expires_at")
        .eq("user_id", userId)
        .single();

      const expired = !shopAdminData?.expires_at || new Date(shopAdminData.expires_at) < new Date();
      console.log("[RouteGuard] Shop admin – expired?", expired);
      if (expired) {
        await supabase.auth.signOut();
        throw redirect({ to: "/auth" });
      }
      return { userId };
    }

    // Staff (cashier, salesperson, technician): check shop admin expiry
    if (userRole?.shop_id) {
      const { data: shopAdmin } = await supabase
        .from("user_roles")
        .select("expires_at")
        .eq("shop_id", userRole.shop_id)
        .eq("role", "shop_admin")
        .maybeSingle();

      console.log("[RouteGuard] Staff – shop admin data:", shopAdmin);

      const shopAdminExpired = !shopAdmin?.expires_at || new Date(shopAdmin.expires_at) < new Date();
      if (shopAdminExpired) {
        console.log("[RouteGuard] Shop admin expired – blocking staff");
        await supabase.auth.signOut();
        throw redirect({ to: "/auth" });
      }
      console.log("[RouteGuard] Staff – shop admin active, allowing access");
      return { userId };
    }

    return { userId };
  },
  component: Layout,
});

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }>; roles?: AppRole[] };

function Layout() {
  // ─── Your existing Layout code remains exactly the same ──────
  // (No changes needed here – keep your current version)
}
