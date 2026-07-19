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
import { Plus, Pause, Play, Trash2, UserPlus, KeyRound, CalendarClock, Ban, CheckCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  createShop,
  updateShop,
  deleteShop,
  createShopAdmin,
  resetShopAdminPassword,
  extendShopAdminExpiration,
  suspendShopAdmin,
  activateShopAdmin,
} from "@/lib/admin.functions";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/shops")({ component: ShopsPage });

function ShopsPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { theme } = useTheme();

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

  // Fetch shop admins with profiles
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
  const extendExpiryFn = useServerFn(extendShopAdminExpiration);
  const suspendAdminFn = useServerFn(suspendShopAdmin);
  const activateAdminFn = useServerFn(activateShopAdmin);

  const [openShop, setOpenShop] = useState(false);
  const [shopForm, setShopForm] = useState({ name: "", phone: "", address: "", region: "" });
  const [adminOpen, setAdminOpen] = useState<string | null>(null);
  const [adminForm, setAdminForm] = useState({ email: "", password: "", full_name: "", phone: "", validity_months: 12 });

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
    mutationFn: async (shop_id: string) => {
      return createAdminFn({ data: { shop_id, ...adminForm } });
    },
    onSuccess: () => {
      setAdminOpen(null);
      setAdminForm({ email: "", password: "", full_name: "", phone: "", validity_months: 12 });
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

  // Suspend admin using server function with logging
  const suspendAdmin = useMutation({
    mutationFn: async (userId: string) => {
      console.log("[suspendAdmin] Calling suspendShopAdmin for user:", userId);
      const result = await suspendAdminFn({ data: { user_id: userId } });
      console.log("[suspendAdmin] Server function result:", result);
      return result;
    },
    onSuccess: () => {
      console.log("[suspendAdmin] Success – invalidating queries");
      qc.invalidateQueries({ queryKey: ["shop-admins"] });
      toast.success("Admin suspended");
    },
    onError: (e: Error) => {
      console.error("[suspendAdmin] Error:", e);
      toast.error(e.message);
    },
  });

  // Activate admin using server function with logging
  const activateAdmin = useMutation({
    mutationFn: async (userId: string) => {
      console.log("[activateAdmin] Calling activateShopAdmin for user:", userId);
      const result = await activateAdminFn({ data: { user_id: userId } });
      console.log("[activateAdmin] Server function result:", result);
      return result;
    },
    onSuccess: () => {
      console.log("[activateAdmin] Success – invalidating queries");
      qc.invalidateQueries({ queryKey: ["shop-admins"] });
      toast.success("Admin activated");
    },
    onError: (e: Error) => {
      console.error("[activateAdmin] Error:", e);
      toast.error(e.message);
    },
  });

  // Delete admin: remove from user_roles
  const deleteAdmin = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "shop_admin");
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shop-admins"] });
      toast.success("Admin removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isSuper) return <div className="text-muted-foreground">Forbidden</div>;

  return (
    <div className={cn(
      "space-y-4 -m-4 sm:-m-6 p-4 sm:p-6 min-h-full rounded-3xl",
      theme === "dark" ? "bg-[#0f0a12]" : "bg-[#F7F5FA]"
    )}>
      <div className="flex items-center justify-between">
        <h1 className={cn(
          "text-2xl font-bold",
          theme === "dark" ? "text-white" : "text-slate-800"
        )}>
          {t("shops")}
        </h1>
        <Dialog open={openShop} onOpenChange={setOpenShop}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-pink-500 to-rose-500 text-white hover:shadow-lg hover:shadow-pink-500/30 transition-all">
              <Plus className="mr-2 h-4 w-4" />
              {t("createShop")}
            </Button>
          </DialogTrigger>
          <DialogContent className={theme === "dark" ? "bg-slate-800 border-slate-700 text-white" : ""}>
            <DialogHeader>
              <DialogTitle className={theme === "dark" ? "text-white" : ""}>{t("createShop")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className={theme === "dark" ? "text-slate-300" : ""}>{t("name")}</Label>
                <Input
                  value={shopForm.name}
                  onChange={(e) => setShopForm({ ...shopForm, name: e.target.value })}
                  className={theme === "dark" ? "border-slate-700 bg-slate-900 text-white" : ""}
                />
              </div>
              <div>
                <Label className={theme === "dark" ? "text-slate-300" : ""}>{t("phone")}</Label>
                <Input
                  value={shopForm.phone}
                  onChange={(e) => setShopForm({ ...shopForm, phone: e.target.value })}
                  className={theme === "dark" ? "border-slate-700 bg-slate-900 text-white" : ""}
                />
              </div>
              <div>
                <Label className={theme === "dark" ? "text-slate-300" : ""}>{t("region")}</Label>
                <Input
                  value={shopForm.region}
                  onChange={(e) => setShopForm({ ...shopForm, region: e.target.value })}
                  className={theme === "dark" ? "border-slate-700 bg-slate-900 text-white" : ""}
                />
              </div>
              <div>
                <Label className={theme === "dark" ? "text-slate-300" : ""}>{t("address")}</Label>
                <Input
                  value={shopForm.address}
                  onChange={(e) => setShopForm({ ...shopForm, address: e.target.value })}
                  className={theme === "dark" ? "border-slate-700 bg-slate-900 text-white" : ""}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpenShop(false)} className={theme === "dark" ? "text-slate-300 hover:text-white hover:bg-slate-700" : ""}>
                {t("cancel")}
              </Button>
              <Button onClick={() => add.mutate()} disabled={add.isPending || !shopForm.name} className="bg-gradient-to-r from-pink-500 to-rose-500 text-white">
                {t("save")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className={cn(
        "p-4 overflow-x-auto",
        theme === "dark"
          ? "bg-slate-800/90 border-slate-700"
          : "bg-white/80"
      )}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={theme === "dark" ? "text-slate-300" : ""}>{t("name")}</TableHead>
              <TableHead className={theme === "dark" ? "text-slate-300" : ""}>{t("phone")}</TableHead>
              <TableHead className={theme === "dark" ? "text-slate-300" : ""}>{t("region")}</TableHead>
              <TableHead className={theme === "dark" ? "text-slate-300" : ""}>{t("status")}</TableHead>
              <TableHead className={theme === "dark" ? "text-slate-300" : ""}>Shop Admin</TableHead>
              <TableHead className={cn("text-right", theme === "dark" ? "text-slate-300" : "")}>{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shops.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className={cn("text-center py-6", theme === "dark" ? "text-slate-400" : "text-muted-foreground")}>
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
            {shops.map((s) => {
              const admin = shopAdmins.find((a) => a.shop_id === s.id);
              const isExpired = admin && admin.expires_at && new Date(admin.expires_at) < new Date();
              const isActive = admin && admin.expires_at && new Date(admin.expires_at) > new Date();
              return (
                <TableRow key={s.id} className={theme === "dark" ? "hover:bg-slate-700/50" : "hover:bg-muted/50"}>
                  <TableCell className={cn("font-medium", theme === "dark" ? "text-slate-200" : "")}>{s.name}</TableCell>
                  <TableCell className={theme === "dark" ? "text-slate-300" : ""}>{s.phone ?? "—"}</TableCell>
                  <TableCell className={theme === "dark" ? "text-slate-300" : ""}>{s.region ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={s.status === "active" ? "default" : "secondary"}>
                      {t(s.status === "active" ? "active" : "suspendedShops")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {admin ? (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={theme === "dark" ? "text-slate-200" : ""}>
                            {admin.profiles?.full_name || "Admin"}
                          </span>
                          {admin.profiles?.email && (
                            <span className="text-xs text-muted-foreground">
                              ({admin.profiles.email})
                            </span>
                          )}
                          {isExpired ? (
                            <Badge variant="destructive">Expired</Badge>
                          ) : isActive ? (
                            <Badge variant="secondary">Active</Badge>
                          ) : (
                            <Badge variant="outline">No expiry</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-wrap">
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
                          {isExpired ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => activateAdmin.mutate(admin.user_id)}
                              disabled={activateAdmin.isPending}
                              className="h-7 px-2 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Activate
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => suspendAdmin.mutate(admin.user_id)}
                              disabled={suspendAdmin.isPending}
                              className="h-7 px-2 text-xs text-amber-600 border-amber-200 hover:bg-amber-50"
                            >
                              <Ban className="h-3 w-3 mr-1" />
                              Suspend
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (confirm("Delete this admin? This cannot be undone.")) {
                                deleteAdmin.mutate(admin.user_id);
                              }
                            }}
                            disabled={deleteAdmin.isPending}
                            className="h-7 px-2 text-xs text-red-600 border-red-200 hover:bg-red-50"
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Remove
                          </Button>
                        </div>
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
                        <Button size="sm" variant="outline" className={theme === "dark" ? "border-slate-600 text-slate-300 hover:bg-slate-700" : ""}>
                          <UserPlus className="h-4 w-4 mr-1" />
                          {t("createShopAdmin")}
                        </Button>
                      </DialogTrigger>
                      <DialogContent className={theme === "dark" ? "bg-slate-800 border-slate-700 text-white" : ""}>
                        <DialogHeader>
                          <DialogTitle className={theme === "dark" ? "text-white" : ""}>
                            {t("createShopAdmin")} — {s.name}
                          </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3">
                          <div>
                            <Label className={theme === "dark" ? "text-slate-300" : ""}>{t("fullName")}</Label>
                            <Input
                              value={adminForm.full_name}
                              onChange={(e) => setAdminForm({ ...adminForm, full_name: e.target.value })}
                              className={theme === "dark" ? "border-slate-700 bg-slate-900 text-white" : ""}
                            />
                          </div>
                          <div>
                            <Label className={theme === "dark" ? "text-slate-300" : ""}>{t("phone")}</Label>
                            <Input
                              value={adminForm.phone}
                              onChange={(e) => setAdminForm({ ...adminForm, phone: e.target.value })}
                              className={theme === "dark" ? "border-slate-700 bg-slate-900 text-white" : ""}
                            />
                          </div>
                          <div>
                            <Label className={theme === "dark" ? "text-slate-300" : ""}>{t("email")}</Label>
                            <Input
                              type="email"
                              value={adminForm.email}
                              onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                              className={theme === "dark" ? "border-slate-700 bg-slate-900 text-white" : ""}
                            />
                          </div>
                          <div>
                            <Label className={theme === "dark" ? "text-slate-300" : ""}>{t("password")}</Label>
                            <Input
                              type="password"
                              value={adminForm.password}
                              onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                              className={theme === "dark" ? "border-slate-700 bg-slate-900 text-white" : ""}
                            />
                          </div>
                          <div>
                            <Label className={theme === "dark" ? "text-slate-300" : ""}>Validity (months)</Label>
                            <Input
                              type="number"
                              min={1}
                              value={adminForm.validity_months}
                              onChange={(e) => setAdminForm({ ...adminForm, validity_months: Number(e.target.value) })}
                              className={theme === "dark" ? "border-slate-700 bg-slate-900 text-white" : ""}
                            />
                            <p className="text-xs text-muted-foreground mt-1">The admin will expire after this many months.</p>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="ghost" onClick={() => setAdminOpen(null)} className={theme === "dark" ? "text-slate-300 hover:text-white hover:bg-slate-700" : ""}>
                            {t("cancel")}
                          </Button>
                          <Button onClick={() => addAdmin.mutate(s.id)} disabled={addAdmin.isPending} className="bg-gradient-to-r from-pink-500 to-rose-500 text-white">
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
        <DialogContent className={theme === "dark" ? "bg-slate-800 border-slate-700 text-white" : ""}>
          <DialogHeader>
            <DialogTitle className={theme === "dark" ? "text-white" : ""}>Reset Shop Admin Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label className={theme === "dark" ? "text-slate-300" : ""}>New Password</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password (min 6 characters)"
              className={theme === "dark" ? "border-slate-700 bg-slate-900 text-white" : ""}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResetOpen(false)} className={theme === "dark" ? "text-slate-300 hover:text-white hover:bg-slate-700" : ""}>
              Cancel
            </Button>
            <Button
              onClick={() => resetPassword.mutate()}
              disabled={resetPassword.isPending}
              className="bg-gradient-to-r from-pink-500 to-rose-500 text-white"
            >
              {resetPassword.isPending ? "Resetting..." : "Reset Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
