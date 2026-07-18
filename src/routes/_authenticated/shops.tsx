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
import { Plus, Pause, Play, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { createShop, updateShop, deleteShop, createShopAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/shops")({ component: ShopsPage });

function ShopsPage() {
  const { t } = useI18n();
  const qc = useQueryClient();

  // 1. Get role from hook (may fail if RLS is strict)
  const { data: myRole } = useMyRole();

  // 2. Get current user directly from Supabase (to check email)
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ["authUser"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // 3. Determine if super admin – role OR hardcoded email
  const isSuper = myRole?.isSuperAdmin || user?.email === "kulwakulangwa@gmail.com";

  // 4. Fetch shops – only if super admin is confirmed
  const { data: shops = [], isLoading: shopsLoading } = useQuery({
    queryKey: ["shops"],
    enabled: !!isSuper, // only run when we know user is super
    queryFn: async () => {
      console.log("[Shops] Fetching all shops as super admin");
      const { data, error } = await supabase
        .from("shops")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        console.error("[Shops] Error:", error);
        toast.error(t("errorFetchingShops"));
        return [];
      }
      console.log(`[Shops] Fetched ${data?.length || 0} shops`);
      return data ?? [];
    },
  });

  // Mutations for CRUD operations
  const createShopFn = useServerFn(createShop);
  const updateShopFn = useServerFn(updateShop);
  const deleteShopFn = useServerFn(deleteShop);
  const createAdminFn = useServerFn(createShopAdmin);

  // Local state for forms
  const [openShop, setOpenShop] = useState(false);
  const [shopForm, setShopForm] = useState({ name: "", phone: "", address: "", region: "" });
  const [adminOpen, setAdminOpen] = useState<string | null>(null);
  const [adminForm, setAdminForm] = useState({ email: "", password: "", full_name: "", phone: "" });

  // Mutations
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
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Loading state
  if (userLoading || shopsLoading) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  // Forbidden for non‑super
  if (!isSuper) {
    return <div className="text-muted-foreground">Forbidden</div>;
  }

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
              <TableHead className="text-right">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shops.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
            {shops.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{s.phone ?? "—"}</TableCell>
                <TableCell>{s.region ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={s.status === "active" ? "default" : "secondary"}>
                    {t(s.status === "active" ? "active" : "suspendedShops")}
                  </Badge>
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
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
