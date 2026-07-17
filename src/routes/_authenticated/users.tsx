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
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { createStaff, deleteStaff } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/users")({ component: UsersPage });

type StaffRole = "cashier" | "salesperson" | "technician" | "shop_admin";

function UsersPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data: myRole } = useMyRole();
  const shopId = myRole?.shopId ?? null;
  const isShopAdmin = myRole?.role === "shop_admin";

  const createFn = useServerFn(createStaff);
  const deleteFn = useServerFn(deleteStaff);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ email: string; password: string; full_name: string; phone: string; role: StaffRole }>({
    email: "", password: "", full_name: "", phone: "", role: "cashier",
  });

  const { data: staff = [] } = useQuery({
    queryKey: ["staff", shopId],
    enabled: !!shopId,
    queryFn: async () => {
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("staff")}</h1>
        {isShopAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />{t("createStaff")}</Button></DialogTrigger>
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
      <Card className="p-4 overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>{t("fullName")}</TableHead><TableHead>{t("phone")}</TableHead><TableHead>{t("role")}</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {staff.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">{t("empty")}</TableCell></TableRow>}
            {staff.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.full_name}</TableCell>
                <TableCell>{u.phone ?? "—"}</TableCell>
                <TableCell><span className="capitalize">{t(u.role)}</span></TableCell>
                <TableCell className="text-right">
                  {isShopAdmin && u.role !== "shop_admin" && (
                    <Button size="sm" variant="ghost" onClick={() => remove.mutate(u.id)}><Trash2 className="h-4 w-4" /></Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
