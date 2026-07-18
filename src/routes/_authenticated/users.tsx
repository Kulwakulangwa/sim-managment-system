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
  const shopId = myRole?.shopId ?? null;
  const isShopAdmin = myRole?.role === "shop_admin";
  const isSuper = myRole?.isSuperAdmin ?? false;

  const createFn = useServerFn(createStaff);
  const deleteFn = useServerFn(deleteStaff);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ email: string; password: string; full_name: string; phone: string; role: StaffRole }>({
    email: "", password: "", full_name: "", phone: "", role: "cashier",
  });

  // Fetch staff list
  const { data: staff = [] } = useQuery({
    queryKey: ["staff", shopId],
    enabled: !!shopId || isSuper,
    queryFn: async () => {
      // If super_admin, fetch all staff across all shops
      if (isSuper) {
        // For super_admin, we could show all staff, but the current design is shop-scoped.
        // We'll keep it shop-scoped for now – super_admin can use the "Shops" page to manage.
        // If you want super_admin to see all, adjust accordingly.
        // For this implementation, we'll still rely on shopId.
      }
      const { data: roles } = await supabase.from("user_roles").select("user_id, role").eq("shop_id", shopId!);
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["staff"] }); setOpen(false); setForm({ email: "", password: "", full_name: "", phone: "", role: "cashier" }); toast.success(t("save")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (user_id: string) => deleteFn({ data: { user_id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["staff"] }); toast.success(t("save")); },
    onError: (e: Error) => toast.error(e.message),
  });

  // Stats
  const total = staff.length;
  const admins = staff.filter((s) => s.role === "shop_admin").length;
  const cashiers = staff.filter((s) => s.role === "cashier").length;
  const technicians = staff.filter((s) => s.role === "technician").length;

  const stats = [
    { label: t("totalStaff"), value: String(total), icon: Users },
    { label: t("shopAdmins"), value: String(admins), icon: ShieldCheck },
    { label: t("cashiers"), value: String(cashiers), icon: User },
    { label: t("technicians"), value: String(technicians), icon: Shield },
  ];

  return (
    <div className="space-y-6">
      {/* Header with gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-20 h-24 w-24 rounded-full bg-emerald-500/20 blur-2xl" />
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
                  <Button className="bg-gradient-to-r from-[#C45BA0] to-[#8B3A8F] text-white hover:shadow-lg hover:shadow-[#C45BA0]/30 transition-all">
                    <Plus className="mr-2 h-4 w-4" /> {t("createStaff")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{t("createStaff")}</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>{t("fullName")}</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
                    <div><Label>{t("phone")}</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                    <div><Label>{t("email")}</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                    <div><Label>{t("password")}</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
                    <div>
                      <Label>{t("role")}</Label>
                      <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as StaffRole })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cashier">{t("cashier")}</SelectItem>
                          <SelectItem value="salesperson">{t("salesperson")}</SelectItem>
                          <SelectItem value="technician">{t("technician")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setOpen(false)}>{t("cancel")}</Button>
                    <Button onClick={() => add.mutate()} disabled={add.isPending}>{t("save")}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </div>

      {/* Stats – matching dashboard */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl bg-white/80 backdrop-blur-sm border border-black/5 shadow-sm p-4 flex items-center justify-between dark:bg-slate-900/80">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{s.label}</p>
              <p className="text-xl font-bold text-slate-800 dark:text-white">{s.value}</p>
            </div>
            <div className="rounded-full bg-gradient-to-br from-[#C45BA0]/20 to-[#8B3A8F]/10 p-2 ring-1 ring-[#C45BA0]/20">
              <s.icon className="h-4 w-4 text-[#C45BA0]" />
            </div>
          </div>
        ))}
      </div>

      {/* Table card */}
      <Card className="border-0 bg-white/80 shadow-sm backdrop-blur-sm dark:bg-slate-900/80 p-4">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("fullName")}</TableHead>
                <TableHead>{t("phone")}</TableHead>
                <TableHead>{t("role")}</TableHead>
                {isShopAdmin && <TableHead className="text-right">{t("actions")}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.length === 0 && (
                <TableRow>
                  <TableCell colSpan={isShopAdmin ? 4 : 3} className="text-center py-6 text-muted-foreground">
                    {t("empty")}
                  </TableCell>
                </TableRow>
              )}
              {staff.map((u) => (
                <TableRow key={u.id} className="hover:bg-muted/50 transition">
                  <TableCell className="font-medium">{u.full_name}</TableCell>
                  <TableCell>{u.phone ?? "—"}</TableCell>
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
                          className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20"
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
