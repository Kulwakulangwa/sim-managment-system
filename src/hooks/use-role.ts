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

export function useMyRole() {
  return useQuery({
    queryKey: ["my-role"],
    queryFn: async (): Promise<{ role: AppRole | null; shopId: string | null }> => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return { role: null, shopId: null };
      const { data } = await supabase
        .from("user_roles")
        .select("role, shop_id")
        .eq("user_id", user.user.id);
      if (!data || data.length === 0) return { role: null, shopId: null };
      const sorted = [...data].sort((a, b) => rank[a.role as AppRole] - rank[b.role as AppRole]);
      return { role: sorted[0].role as AppRole, shopId: sorted[0].shop_id ?? null };
    },
    staleTime: 60_000,
  });
}

export function useShopId(): string | null {
  const { data } = useMyRole();
  return data?.shopId ?? null;
}
