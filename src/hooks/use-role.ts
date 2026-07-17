import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "super_admin" | "shop_admin" | "cashier" | "salesperson" | "technician";

const rank: Record<AppRole, number> = {
  super_admin: 1,
  shop_admin: 2,
  cashier: 3,
  salesperson: 4,
  technician: 5,
};

export type MyRole = { role: AppRole | null; shopId: string | null; isSuperAdmin: boolean };

export function useMyRole() {
  return useQuery<MyRole>({
    queryKey: ["my-role"],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return { role: null, shopId: null, isSuperAdmin: false };
      const { data } = await supabase
        .from("user_roles")
        .select("role, shop_id")
        .eq("user_id", user.user.id);
      if (!data || data.length === 0) return { role: null, shopId: null, isSuperAdmin: false };
      const sorted = [...data].sort((a, b) => rank[a.role as AppRole] - rank[b.role as AppRole]);
      const role = sorted[0].role as AppRole;
      return { role, shopId: sorted[0].shop_id ?? null, isSuperAdmin: role === "super_admin" };
    },
    staleTime: 60_000,
  });
}

export function useShopId(): string | null {
  const { data } = useMyRole();
  return data?.shopId ?? null;
}
