import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "owner" | "manager" | "cashier";

export function useMyRole() {
  return useQuery({
    queryKey: ["my-role"],
    queryFn: async (): Promise<AppRole | null> => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return null;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.user.id);
      if (!data || data.length === 0) return null;
      const roles = data.map((r) => r.role as AppRole);
      if (roles.includes("owner")) return "owner";
      if (roles.includes("manager")) return "manager";
      return "cashier";
    },
    staleTime: 60_000,
  });
}
