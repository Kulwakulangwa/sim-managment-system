import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useMyRole } from "@/hooks/use-role";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Users, UserCog, Shield, ShieldCheck, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { createStaff, deleteStaff } from "@/lib/admin.functions";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/users")({ component: UsersPage });

type StaffRole = "cashier" | "salesperson" | "technician" | "shop_admin";

// Role color mapping (matches the dashboard palette)
const ROLE_COLORS: Record<StaffRole, string> = {
  cashier: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  salesperson: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  technician: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  shop_admin: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
};

function UsersPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data: myRole } = useMyRole();
  const { theme } = useTheme();
  const shopId = myRole?.shopId ?? null;
  const isShopAdmin = myRole?.role === "shop_admin";
  const isSuper = myRole?.isSuperAdmin ?? false;

  const createFn = useServerFn(createStaff);
  const deleteFn = useServerFn(deleteStaff);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ email: string; password: string; full_name: string; phone: string; role: StaffRole }>({
    email: "", password: "", full_name: "", phone: "", role: "cashier",
  });

  // Fetch staff list – for shop_admin, exclude other shop_admin roles
  const { data: staff = [] } = useQuery({
    queryKey: ["staff", shopId],
    enabled: !!shopId || isSuper,
    queryFn: async () => {
      let query = supabase.from("user_roles").select("user_id, role").eq("shop_id", shopId!);
      // If not super admin, do NOT show other shop_admin users
      if (!isSuper) {
        query = query.neq("role", "shop_admin");
      }
      const { data: roles } = await query;
      const ids = (roles ?? []).map((r) => r.user_id);
      if (!ids.length) return [];
      const { data: profiles } = await supabase.from("profiles").select("*").in("id", ids);
      return (profiles ?? []).map((p) => ({
        ...p,
        role: (roles ?? []).find((r) => r.user_id === p.id)?.role as StaffRole,
      }));
    },
  });

  const add = useMutation({
    mutationFn: async () => createFn({ data: form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff"] });
      setOpen(false);
      setForm({ email: "", password: "", full_name: "", phone: "", role: "cashier" });
      toast.success(t("save"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (user_id: string) => deleteFn({ data: { user_id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff"] });
      toast.success(t("save"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Stats – only staff roles (cashier, salesperson, technician) for shop_admin
  const total = staff.length;
  const admins = staff.filter((s) => s.role === "shop_admin").length; // will be 0 for shop_admin
  const cashiers = staff.filter((s) => s.role === "cashier").length;
  const salespersons = staff.filter((s) => s.role === "salesperson").length;
  const technicians = staff.filter((s) => s.role === "technician").length;

  const stats = [
    { label: t("totalStaff"), value: String(total), icon: Users },
    { label: t("shopAdmins"), value: String(admins), icon: ShieldCheck },
    { label: t("cashiers"), value: String(cashiers), icon: User },
    { label: t("technicians"), value: String(technicians), icon: Shield },
  ];

  // For shop_admin, hide the "shopAdmins" stat since they can't see other admins
  const displayStats = isSuper ? stats : stats.filter((s) => s.label !== t("shopAdmins"));

  return (
    <div className={cn(
      "space-y-6 -m-4 sm:-m-6 p-4 sm:p-6 min-h-full rounded-3xl",
      theme === "dark" ? "bg-[#0f0a12]" : "bg-[#F7F5FA]"
    )}>
      {/* Header with gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-pink-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-20 h-24 w-24 rounded-full bg-rose-500/20 blur-2xl" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{t("staff")}</h1>
            <p className="mt-1 text-sm text-white/70">Manage your team members and their roles</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 backdrop-blur-sm">
              <UserCog className="h-4 w-4 text-white/60" />
              <span className="text-sm">{total} staff</span>
            </div>
            {isShopAdmin && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-pink-500 to-rose-500 text-white hover:shadow-lg hover:shadow-pink-500/30 transition-all">
                    <Plus className="mr-2 h-4 w-4" /> {t("createStaff")}
                  </Button>
                </DialogTrigger>
                <DialogContent className={theme === "dark" ? "bg-slate-800 border-slate-700 text-white" : ""}>
                  <DialogHeader><DialogTitle className={theme === "dark" ? "text-white" : ""}>{t("createStaff")}</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <Label className={theme === "dark" ? "text-slate-300" : ""}>{t("fullName")}</Label>
                      <Input
                        value={form.full_name}
                        onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                        className={theme === "dark" ? "border-slate-700 bg-slate-900 text-white placeholder-slate-400" : ""}
                      />
                    </div>
                    <div>
                      <Label className={theme === "dark" ? "text-slate-300" : ""}>{t("phone")}</Label>
                      <Input
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        className={theme === "dark" ? "border-slate-700 bg-slate-900 text-white placeholder-slate-400" : ""}
                      />
                    </div>
                    <div>
                      <Label className={theme === "dark" ? "text-slate-300" : ""}>{t("email")}</Label>
                      <Input
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        className={theme === "dark" ? "border-slate-700 bg-slate-900 text-white placeholder-slate-400" : ""}
                      />
                    </div>
                    <div>
                      <Label className={theme === "dark" ? "text-slate-300" : ""}>{t("password")}</Label>
                      <Input
                        type="password"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        className={theme === "dark" ? "border-slate-700 bg-slate-900 text-white placeholder-slate-400" : ""}
                      />
                    </div>
                    <div>
                      <Label className={theme === "dark" ? "text-slate-300" : ""}>{t("role")}</Label>
                      <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as StaffRole })}>
                        <SelectTrigger className={theme === "dark" ? "border-slate-700 bg-slate-900 text-white" : ""}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cashier">{t("cashier")}</SelectItem>
                          <SelectItem value="salesperson">{t("salesperson")}</SelectItem>
                          <SelectItem value="technician">{t("technician")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="ghost"
                      onClick={() => setOpen(false)}
                      className={theme === "dark" ? "text-slate-300 hover:text-white hover:bg-slate-700" : ""}
                    >
                      {t("cancel")}
                    </Button>
                    <Button
                      onClick={() => add.mutate()}
                      disabled={add.isPending}
                      className="bg-gradient-to-r from-pink-500 to-rose-500 text-white hover:shadow-lg hover:shadow-pink-500/30"
                    >
                      {t("save")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </div>

      {/* Stats – matching dashboard */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        {displayStats.map((s) => (
          <div key={s.label} className="rounded-2xl bg-white/80 backdrop-blur-sm border border-black/5 shadow-sm p-4 flex items-center justify-between dark:bg-slate-800/90 dark:border-slate-700/50">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground dark:text-slate-400">{s.label}</p>
              <p className="text-xl font-bold text-slate-800 dark:text-white">{s.value}</p>
            </div>
            <div className="rounded-full bg-gradient-to-br from-pink-500/20 to-rose-500/10 p-2 ring-1 ring-pink-500/20">
              <s.icon className="h-4 w-4 text-pink-500" />
            </div>
          </div>
        ))}
      </div>

      {/* Table card */}
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
                <TableHead className={theme === "dark" ? "text-slate-300" : ""}>{t("fullName")}</TableHead>
                <TableHead className={theme === "dark" ? "text-slate-300" : ""}>{t("phone")}</TableHead>
                <TableHead className={theme === "dark" ? "text-slate-300" : ""}>{t("role")}</TableHead>
                {isShopAdmin && <TableHead className={cn("text-right", theme === "dark" ? "text-slate-300" : "")}>{t("actions")}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.length === 0 && (
                <TableRow>
                  <TableCell colSpan={isShopAdmin ? 4 : 3} className={cn("text-center py-6", theme === "dark" ? "text-slate-400" : "text-muted-foreground")}>
                    {t("empty")}
                  </TableCell>
                </TableRow>
              )}
              {staff.map((u) => (
                <TableRow key={u.id} className={cn(
                  "transition",
                  theme === "dark" ? "hover:bg-slate-700/50" : "hover:bg-muted/50"
                )}>
                  <TableCell className={cn("font-medium", theme === "dark" ? "text-slate-200" : "")}>{u.full_name}</TableCell>
                  <TableCell className={theme === "dark" ? "text-slate-300" : ""}>{u.phone ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={ROLE_COLORS[u.role] ?? ""}>
                      {t(u.role)}
                    </Badge>
                  </TableCell>
                  {isShopAdmin && (
                    <TableCell className="text-right">
                      {u.role !== "shop_admin" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => remove.mutate(u.id)}
                          className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:text-rose-300 dark:hover:bg-rose-950/20"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
