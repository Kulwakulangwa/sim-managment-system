import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { formatTZS } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/subscriptions")({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();
    if (role?.role !== "super_admin") throw redirect({ to: "/dashboard" });
  },
  component: SubscriptionsPage,
});

function SubscriptionsPage() {
  const { t } = useI18n();
  const { theme } = useTheme();

  const { data: subscriptions = [] } = useQuery({
    queryKey: ["subscriptions"],
    queryFn: async () => {
      // Fetch all shops
      const { data: shops } = await supabase.from("shops").select("*");
      if (!shops) return [];

      // For each shop, find the shop_admin and calculate revenue
      const results = await Promise.all(
        shops.map(async (shop) => {
          // Get shop admin
          const { data: admin } = await supabase
            .from("user_roles")
            .select("user_id, expires_at, profiles(full_name, email)")
            .eq("shop_id", shop.id)
            .eq("role", "shop_admin")
            .single();

          // Get total revenue for this shop (all sales)
          const { data: sales } = await supabase
            .from("sales")
            .select("sell_price, discount, quantity")
            .eq("shop_id", shop.id);
          const revenue = (sales ?? []).reduce(
            (sum, s) => sum + (Number(s.sell_price) - Number(s.discount)) * Number(s.quantity),
            0
          );

          return {
            shop,
            admin: admin?.profiles || null,
            expires_at: admin?.expires_at || null,
            revenue,
            is_active: admin?.expires_at ? new Date(admin.expires_at) > new Date() : false,
          };
        })
      );
      return results;
    },
  });

  return (
    <div className={cn(
      "space-y-6 -m-4 sm:-m-6 p-4 sm:p-6 min-h-full rounded-3xl",
      theme === "dark" ? "bg-[#0f0a12]" : "bg-[#F7F5FA]"
    )}>
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-pink-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-20 h-24 w-24 rounded-full bg-rose-500/20 blur-2xl" />
        <div className="relative z-10">
          <h1 className="text-2xl font-bold">Subscriptions</h1>
          <p className="mt-1 text-sm text-white/70">Manage all shop subscriptions and revenue</p>
        </div>
      </div>

      <Card className={cn(
        "border-0 shadow-sm backdrop-blur-sm p-4",
        theme === "dark"
          ? "bg-slate-800/90 border-slate-700"
          : "bg-white/80"
      )}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={theme === "dark" ? "text-slate-300" : ""}>Shop</TableHead>
                <TableHead className={theme === "dark" ? "text-slate-300" : ""}>Admin</TableHead>
                <TableHead className={theme === "dark" ? "text-slate-300" : ""}>Expiry Date</TableHead>
                <TableHead className={theme === "dark" ? "text-slate-300" : ""}>Status</TableHead>
                <TableHead className={cn("text-right", theme === "dark" ? "text-slate-300" : "")}>Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className={cn("text-center py-6", theme === "dark" ? "text-slate-400" : "text-muted-foreground")}>
                    No subscriptions found.
                  </TableCell>
                </TableRow>
              )}
              {subscriptions.map((sub) => (
                <TableRow key={sub.shop.id} className={theme === "dark" ? "hover:bg-slate-700/50" : "hover:bg-muted/50"}>
                  <TableCell className={cn("font-medium", theme === "dark" ? "text-slate-200" : "")}>{sub.shop.name}</TableCell>
                  <TableCell className={theme === "dark" ? "text-slate-300" : ""}>
                    {sub.admin?.full_name || "—"}
                  </TableCell>
                  <TableCell className={theme === "dark" ? "text-slate-300" : ""}>
                    {sub.expires_at ? new Date(sub.expires_at).toLocaleDateString() : "Never"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={sub.is_active ? "secondary" : "destructive"}>
                      {sub.is_active ? "Active" : "Expired"}
                    </Badge>
                  </TableCell>
                  <TableCell className={cn("text-right font-semibold", theme === "dark" ? "text-slate-200" : "")}>
                    {formatTZS(sub.revenue)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
