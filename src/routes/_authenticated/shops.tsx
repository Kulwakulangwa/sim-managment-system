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
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pause, Play, Trash2, UserPlus, KeyRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { createShop, updateShop, deleteShop, createShopAdmin, resetShopAdminPassword } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/shops")({ component: ShopsPage });

function ShopsPage() {
  const { t } = useI18n();
  const qc = useQueryClient();

  // Role detection
  const { data: myRole } = useMyRole();
  const { data: user } = useQuery({
    queryKey: ["authUser"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user;
    },
    staleTime: 5 * 60 * 1000,
  });

  const isSuper = myRole?.isSuperAdmin || user?.email === "kulwakulangwa@gmail.com";

  // Fetch shops
  const { data: shops = [], isLoading: shopsLoading } = useQuery({
    queryKey: ["shops"],
    enabled: !!isSuper,
    queryFn: async () => {
      const { data, error } = await supabase.from("shops").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch shop admins
  const { data: shopAdmins = [] } = useQuery({
    queryKey: ["shop-admins"],
    enabled: !!isSuper,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("*, profiles(id, full_name, email)")
        .eq("role", "shop_admin");
      if (error) throw error;
      return data;
    },
  });

  // Mutations
  const createShopFn = useServerFn(createShop);
  const updateShopFn = useServerFn(updateShop);
  const deleteShopFn = useServerFn(deleteShop);
  const createAdminFn = useServerFn(createShopAdmin);
  const resetPasswordFn = useServerFn(resetShopAdminPassword);

  const [openShop, setOpenShop] = useState(false);
  const [shopForm, setShopForm] = useState({ name: "", phone: "", address: "", region: "" });
  const [adminOpen, setAdminOpen] = useState<string | null>(null);
  const [adminForm, setAdminForm] = useState({ email: "", password: "", full_name: "", phone: "" });

  // Reset password state
  const [resetOpen, setResetOpen] = useState(false);
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const add = useMutation({
    mutationFn: async () => createShopFn({ data: shopForm }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shops"] });
      setOpenShop(false);
      setShopForm({ name: "", phone: "", address: "", region: "" });
      toast.success(t("save"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (s: { id: string; status: string }) =>
      updateShopFn({ data: { id: s.id, status: s.status === "active" ? "suspended" : "active" } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shops"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => deleteShopFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shops"] });
      toast.success(t("save"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addAdmin = useMutation({
    mutationFn: async (shop_id: string) => createAdminFn({ data: { shop_id, ...adminForm } }),
    onSuccess: () => {
      setAdminOpen(null);
      setAdminForm({ email: "", password: "", full_name: "", phone: "" });
      toast.success(t("save"));
      qc.invalidateQueries({ queryKey: ["shop-admins"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetPassword = useMutation({
    mutationFn: async () => {
      if (!resetUserId) throw new Error("No user selected");
      if (!newPassword || newPassword.length < 6) throw new Error("Password must be at least 6 characters");
      await resetPasswordFn({ data: { user_id: resetUserId, new_password: newPassword } });
    },
    onSuccess: () => {
      toast.success("Password reset successfully");
      setResetOpen(false);
      setNewPassword("");
      setResetUserId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isSuper) return <div className="text-muted-foreground">Forbidden</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("shops")}</h1>
        <Dialog open={openShop} onOpenChange={setOpenShop}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {t("createShop")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("createShop")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>{t("name")}</Label>
                <Input
                  value={shopForm.name}
                  onChange={(e) => setShopForm({ ...shopForm, name: e.target.value })}
                />
              </div>
              <div>
                <Label>{t("phone")}</Label>
                <Input
                  value={shopForm.phone}
                  onChange={(e) => setShopForm({ ...shopForm, phone: e.target.value })}
                />
              </div>
              <div>
                <Label>{t("region")}</Label>
                <Input
                  value={shopForm.region}
                  onChange={(e) => setShopForm({ ...shopForm, region: e.target.value })}
                />
              </div>
              <div>
                <Label>{t("address")}</Label>
                <Input
                  value={shopForm.address}
                  onChange={(e) => setShopForm({ ...shopForm, address: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpenShop(false)}>
                {t("cancel")}
              </Button>
              <Button onClick={() => add.mutate()} disabled={add.isPending || !shopForm.name}>
                {t("save")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-4 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("name")}</TableHead>
              <TableHead>{t("phone")}</TableHead>
              <TableHead>{t("region")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead>Shop Admin</TableHead>
              <TableHead className="text-right">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shops.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
            {shops.map((s) => {
              const admin = shopAdmins.find((a) => a.shop_id === s.id);
              return (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.phone ?? "—"}</TableCell>
                  <TableCell>{s.region ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={s.status === "active" ? "default" : "secondary"}>
                      {t(s.status === "active" ? "active" : "suspendedShops")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {admin ? (
                      <div className="flex items-center gap-2">
                        <span>{admin.profiles?.full_name || admin.profiles?.email || "Admin"}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setResetUserId(admin.user_id);
                            setResetOpen(true);
                          }}
                          className="h-7 px-2 text-xs"
                        >
                          <KeyRound className="h-3 w-3 mr-1" />
                          Reset
                        </Button>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">No admin</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Dialog
                      open={adminOpen === s.id}
                      onOpenChange={(v) => setAdminOpen(v ? s.id : null)}
                    >
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline">
                          <UserPlus className="h-4 w-4 mr-1" />
                          {t("createShopAdmin")}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{t("createShopAdmin")} — {s.name}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3">
                          <div>
                            <Label>{t("fullName")}</Label>
                            <Input
                              value={adminForm.full_name}
                              onChange={(e) => setAdminForm({ ...adminForm, full_name: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label>{t("phone")}</Label>
                            <Input
                              value={adminForm.phone}
                              onChange={(e) => setAdminForm({ ...adminForm, phone: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label>{t("email")}</Label>
                            <Input
                              type="email"
                              value={adminForm.email}
                              onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label>{t("password")}</Label>
                            <Input
                              type="password"
                              value={adminForm.password}
                              onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="ghost" onClick={() => setAdminOpen(null)}>
                            {t("cancel")}
                          </Button>
                          <Button onClick={() => addAdmin.mutate(s.id)} disabled={addAdmin.isPending}>
                            {t("save")}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    <Button size="sm" variant="ghost" onClick={() => toggle.mutate({ id: s.id, status: s.status })}>
                      {s.status === "active" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(t("confirmDelete"))) remove.mutate(s.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Reset Password Dialog */}
      <Dialog open={resetOpen} onOpenChange={(v) => setResetOpen(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Shop Admin Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>New Password</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password (min 6 characters)"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResetOpen(false)}>Cancel</Button>
            <Button
              onClick={() => resetPassword.mutate()}
              disabled={resetPassword.isPending}
            >
              {resetPassword.isPending ? "Resetting..." : "Reset Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
