import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useShopId, useMyRole } from "@/hooks/use-role";
import { formatTZS } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Pencil, ShoppingCart, Upload, X, Package, AlertTriangle, Trash2 } from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

// ─── Helper: remove spaces and dashes from IMEI ──────────────
const cleanImei = (value: string): string => {
  return value.replace(/[\s-]/g, '');
};

export const Route = createFileRoute("/_authenticated/inventory")({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    const role = roleData?.role;
    const isSuperAdminByEmail = user.email === "kulwakulangwa@gmail.com";
    const allowedRoles = ["super_admin", "shop_admin", "cashier"];
    const isAllowed = allowedRoles.includes(role ?? "") || isSuperAdminByEmail;

    if (!isAllowed) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: InventoryPage,
});

type FormState = {
  item_type: "phone" | "accessory";
  brand: string;
  model: string;
  name: string;
  condition: "new" | "used";
  buy_price: string;
  sell_price: string;
  quantity: string;
  low_stock_threshold: string;
  photo_url: string;
};

const empty: FormState = {
  item_type: "phone",
  brand: "",
  model: "",
  name: "",
  condition: "new",
  buy_price: "",
  sell_price: "",
  quantity: "1",
  low_stock_threshold: "1",
  photo_url: "",
};

function InventoryPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const shopId = useShopId();
  const { theme } = useTheme();
  const { data: myRole } = useMyRole();
  const role = myRole?.role;
  const isAdmin = role === "shop_admin" || role === "super_admin";

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Batch IMEI state (only for phones)
  const [imeiBatch, setImeiBatch] = useState("");

  // ─── Fetch inventory (exclude soft‑deleted) ──────────────
  const { data: items = [] } = useQuery({
    queryKey: ["inventory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const totalItems = items.length;
  const lowStockItems = items.filter((i) => i.quantity <= i.low_stock_threshold).length;

  // ─── Delete mutation (soft delete) ─────────────────────────
  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("inventory_items")
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user.id,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["inventory-pos"] });
      toast.success("Item moved to trash");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadPhoto = async (file: File): Promise<string> => {
    const fileExt = file.name.split(".").pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `inventory/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("public")
      .upload(filePath, file);

    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw new Error("Failed to upload photo. Please check storage bucket permissions.");
    }

    const { data: { publicUrl } } = supabase.storage
      .from("public")
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const upsert = useMutation({
    mutationFn: async () => {
      // If phone and we have batch IMEIs, create multiple items
      if (form.item_type === "phone" && imeiBatch.trim()) {
        const rawImeis = imeiBatch.split("\n").map(s => s.trim()).filter(s => s.length > 0);
        if (rawImeis.length === 0) throw new Error("Please enter at least one IMEI");

        const cleanedImeis = rawImeis.map(cleanImei).filter(s => s.length > 0);

        const basePayload = {
          item_type: form.item_type,
          brand: form.brand || null,
          model: form.model || null,
          name: form.name || null,
          condition: form.condition,
          buy_price: Number(form.buy_price || 0),
          sell_price: Number(form.sell_price || 0),
          quantity: 1,
          low_stock_threshold: Number(form.low_stock_threshold || 1),
          photo_url: form.photo_url || null,
          shop_id: shopId,
        };

        const insertPromises = cleanedImeis.map((imei) =>
          supabase.from("inventory_items").insert({ ...basePayload, imei })
        );
        const results = await Promise.all(insertPromises);
        for (const result of results) {
          if (result.error) throw result.error;
        }
        return;
      }

      // Regular insert/update
      const payload = {
        item_type: form.item_type,
        brand: form.brand || null,
        model: form.model || null,
        name: form.name || null,
        condition: form.condition,
        buy_price: Number(form.buy_price || 0),
        sell_price: Number(form.sell_price || 0),
        quantity: Number(form.quantity || 0),
        low_stock_threshold: Number(form.low_stock_threshold || 1),
        photo_url: form.photo_url || null,
      };

      if (editingId) {
        const { error } = await supabase.from("inventory_items").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        if (!shopId) throw new Error("No shop context");
        const { error } = await supabase.from("inventory_items").insert({ ...payload, shop_id: shopId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["inventory-pos"] });
      setOpen(false);
      setForm(empty);
      setEditingId(null);
      setImeiBatch("");
      toast.success(t("save"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const url = await uploadPhoto(file);
      setForm({ ...form, photo_url: url });
      toast.success("Photo uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload photo");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removePhoto = () => {
    setForm({ ...form, photo_url: "" });
  };

  const filtered = items.filter((i) => {
    const s = q.toLowerCase();
    return !s || `${i.brand ?? ""} ${i.model ?? ""} ${i.name ?? ""} ${i.imei ?? ""}`.toLowerCase().includes(s);
  });

  const openEdit = (i: typeof items[number]) => {
    setEditingId(i.id);
    setForm({
      item_type: i.item_type,
      brand: i.brand ?? "",
      model: i.model ?? "",
      name: i.name ?? "",
      condition: (i.condition ?? "new") as "new" | "used",
      buy_price: String(i.buy_price),
      sell_price: String(i.sell_price),
      quantity: String(i.quantity),
      low_stock_threshold: String(i.low_stock_threshold),
      photo_url: i.photo_url ?? "",
    });
    setImeiBatch("");
    setOpen(true);
  };

  return (
    <div className={cn(
      "space-y-6 -m-4 sm:-m-6 p-4 sm:p-6 min-h-full rounded-3xl",
      theme === "dark" ? "bg-[#0f0a12]" : "bg-[#F7F5FA]"
    )}>
      {/* ─── Header ────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-pink-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-20 h-24 w-24 rounded-full bg-rose-500/20 blur-2xl" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{t("inventory")}</h1>
            <p className="mt-1 text-sm text-white/70">Manage your stock and products</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 backdrop-blur-sm">
              <Package className="h-4 w-4 text-white/60" />
              <span className="text-sm">{totalItems} items</span>
            </div>
            {lowStockItems > 0 && (
              <div className="flex items-center gap-2 rounded-full bg-amber-500/20 px-3 py-1 backdrop-blur-sm">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                <span className="text-sm">{lowStockItems} low stock</span>
              </div>
            )}
            <Link to="/sales/pos">
              <Button variant="secondary" className="bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm border-0">
                <ShoppingCart className="mr-2 h-4 w-4" /> {t("pos")}
              </Button>
            </Link>
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm(empty); setEditingId(null); setImeiBatch(""); } }}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-pink-500 to-rose-500 text-white hover:shadow-lg hover:shadow-pink-500/30 transition-all">
                  <Plus className="mr-2 h-4 w-4" /> {t("addItem")}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{editingId ? t("edit") : t("addItem")}</DialogTitle></DialogHeader>
                {/* ─── Form ────────────────────────────────────── */}
                <div className="grid grid-cols-2 gap-3">
                  {/* item_type */}
                  <div className="col-span-2">
                    <Label className={theme === "dark" ? "text-slate-300" : ""}>{t("itemType")}</Label>
                    <Select value={form.item_type} onValueChange={(v) => {
                      setForm({ ...form, item_type: v as "phone" | "accessory" });
                      setImeiBatch("");
                    }}>
                      <SelectTrigger className={theme === "dark" ? "border-slate-700 bg-slate-800 text-white" : ""}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="phone">{t("phoneItem")}</SelectItem>
                        <SelectItem value="accessory">{t("accessoryItem")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {form.item_type === "phone" ? (
                    <>
                      <div>
                        <Label className={theme === "dark" ? "text-slate-300" : ""}>{t("brand")}</Label>
                        <Input
                          value={form.brand}
                          onChange={(e) => setForm({ ...form, brand: e.target.value })}
                          className={theme === "dark" ? "border-slate-700 bg-slate-800 text-white" : ""}
                        />
                      </div>
                      <div>
                        <Label className={theme === "dark" ? "text-slate-300" : ""}>{t("model")}</Label>
                        <Input
                          value={form.model}
                          onChange={(e) => setForm({ ...form, model: e.target.value })}
                          className={theme === "dark" ? "border-slate-700 bg-slate-800 text-white" : ""}
                        />
                      </div>
                      <div>
                        <Label className={theme === "dark" ? "text-slate-300" : ""}>{t("condition")}</Label>
                        <Select value={form.condition} onValueChange={(v) => setForm({ ...form, condition: v as "new" | "used" })}>
                          <SelectTrigger className={theme === "dark" ? "border-slate-700 bg-slate-800 text-white" : ""}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">{t("new")}</SelectItem>
                            <SelectItem value="used">{t("used")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div />
                      <div className="col-span-2">
                        <Label className={theme === "dark" ? "text-slate-300" : ""}>IMEIs (one per line)</Label>
                        <Textarea
                          value={imeiBatch}
                          onChange={(e) => setImeiBatch(e.target.value)}
                          placeholder="Enter multiple IMEIs, one per line (spaces and dashes will be removed)"
                          rows={5}
                          className={theme === "dark" ? "border-slate-700 bg-slate-800 text-white" : ""}
                        />
                        <p className="text-xs text-muted-foreground mt-1">Each IMEI will create a separate inventory item. Spaces and dashes are automatically removed.</p>
                      </div>
                    </>
                  ) : (
                    <div className="col-span-2">
                      <Label className={theme === "dark" ? "text-slate-300" : ""}>{t("name")}</Label>
                      <Input
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className={theme === "dark" ? "border-slate-700 bg-slate-800 text-white" : ""}
                      />
                      <div className="mt-2">
                        <Label className={theme === "dark" ? "text-slate-300" : ""}>{t("stock")}</Label>
                        <Input
                          type="number"
                          value={form.quantity}
                          onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                          className={theme === "dark" ? "border-slate-700 bg-slate-800 text-white" : ""}
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <Label className={theme === "dark" ? "text-slate-300" : ""}>{t("buyPrice")}</Label>
                    <Input
                      type="number"
                      value={form.buy_price}
                      onChange={(e) => setForm({ ...form, buy_price: e.target.value })}
                      className={theme === "dark" ? "border-slate-700 bg-slate-800 text-white" : ""}
                    />
                  </div>
                  <div>
                    <Label className={theme === "dark" ? "text-slate-300" : ""}>{t("sellPrice")}</Label>
                    <Input
                      type="number"
                      value={form.sell_price}
                      onChange={(e) => setForm({ ...form, sell_price: e.target.value })}
                      className={theme === "dark" ? "border-slate-700 bg-slate-800 text-white" : ""}
                    />
                  </div>

                  {form.item_type === "phone" && (
                    <div className="col-span-2">
                      <Label className={theme === "dark" ? "text-slate-300" : ""}>{t("lowStockThreshold")}</Label>
                      <Input
                        type="number"
                        value={form.low_stock_threshold}
                        onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })}
                        className={theme === "dark" ? "border-slate-700 bg-slate-800 text-white" : ""}
                      />
                    </div>
                  )}

                  {/* Photo upload */}
                  <div className="col-span-2">
                    <Label className={theme === "dark" ? "text-slate-300" : ""}>Photo</Label>
                    <div className="flex items-center gap-3 mt-1">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className={theme === "dark" ? "border-slate-700 text-slate-300 hover:bg-slate-700" : ""}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {uploading ? "Uploading..." : "Upload Photo"}
                      </Button>
                      {form.photo_url && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={removePhoto}
                          className={theme === "dark" ? "text-slate-400 hover:text-white" : ""}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    {form.photo_url && (
                      <div className="mt-2 relative w-24 h-24 rounded-md overflow-hidden border border-slate-200 dark:border-slate-700">
                        <img src={form.photo_url} alt="Item" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setOpen(false)} className={theme === "dark" ? "text-slate-300 hover:text-white hover:bg-slate-700" : ""}>
                    {t("cancel")}
                  </Button>
                  <Button onClick={() => upsert.mutate()} disabled={upsert.isPending} className="bg-gradient-to-r from-pink-500 to-rose-500 text-white hover:shadow-lg hover:shadow-pink-500/30">
                    {t("save")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* ─── Table ────────────────────────────────────────────── */}
      <Card className={cn(
        "border-0 shadow-sm backdrop-blur-sm p-4",
        theme === "dark"
          ? "bg-slate-800/90 border-slate-700"
          : "bg-white/80"
      )}>
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            className={cn(
              "pl-9 focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500",
              theme === "dark"
                ? "border-slate-700 bg-slate-900 text-white placeholder-slate-400"
                : "bg-white border-slate-200"
            )}
            placeholder={t("search")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={theme === "dark" ? "text-slate-300" : ""}>Photo</TableHead>
                <TableHead className={theme === "dark" ? "text-slate-300" : ""}>{t("itemType")}</TableHead>
                <TableHead className={theme === "dark" ? "text-slate-300" : ""}>{t("name")}/{t("model")}</TableHead>
                <TableHead className={theme === "dark" ? "text-slate-300" : ""}>IMEI</TableHead>
                <TableHead className={cn("text-right", theme === "dark" ? "text-slate-300" : "")}>{t("buyPrice")}</TableHead>
                <TableHead className={cn("text-right", theme === "dark" ? "text-slate-300" : "")}>{t("sellPrice")}</TableHead>
                <TableHead className={cn("text-right", theme === "dark" ? "text-slate-300" : "")}>{t("stock")}</TableHead>
                <TableHead className={cn("text-right", theme === "dark" ? "text-slate-300" : "")}>{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className={cn("text-center py-6", theme === "dark" ? "text-slate-400" : "text-muted-foreground")}>
                    {t("empty")}
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((i) => {
                const low = i.quantity <= i.low_stock_threshold;
                return (
                  <TableRow key={i.id} className={theme === "dark" ? "hover:bg-slate-700/50" : "hover:bg-muted/50"}>
                    <TableCell>
                      {i.photo_url ? (
                        <img src={i.photo_url} alt="" className="w-10 h-10 rounded object-cover" />
                      ) : (
                        <div className={cn(
                          "w-10 h-10 rounded flex items-center justify-center text-xs",
                          theme === "dark" ? "bg-slate-700 text-slate-400" : "bg-muted text-muted-foreground"
                        )}>
                          No
                        </div>
                      )}
                    </TableCell>
                    <TableCell className={theme === "dark" ? "text-slate-300" : ""}>
                      {i.item_type === "phone" ? t("phoneItem") : t("accessoryItem")}
                    </TableCell>
                    <TableCell className={cn("font-medium", theme === "dark" ? "text-slate-200" : "")}>
                      {i.item_type === "phone" ? `${i.brand ?? ""} ${i.model ?? ""}`.trim() : i.name}
                    </TableCell>
                    <TableCell className={cn("font-mono text-xs", theme === "dark" ? "text-slate-300" : "")}>
                      {i.imei || "—"}
                    </TableCell>
                    <TableCell className={cn("text-right", theme === "dark" ? "text-slate-300" : "")}>
                      {formatTZS(i.buy_price)}
                    </TableCell>
                    <TableCell className={cn("text-right", theme === "dark" ? "text-slate-300" : "")}>
                      {formatTZS(i.sell_price)}
                    </TableCell>
                    <TableCell className="text-right">
                      {low ? (
                        <Badge variant="destructive">{i.quantity}</Badge>
                      ) : (
                        <span className={theme === "dark" ? "text-slate-300" : ""}>{i.quantity}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEdit(i)}
                        className={theme === "dark" ? "text-slate-300 hover:text-white hover:bg-slate-700" : ""}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {isAdmin && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (confirm("Delete this item? It will be moved to trash.")) {
                              deleteItem.mutate(i.id);
                            }
                          }}
                          disabled={deleteItem.isPending}
                          className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:text-rose-300 dark:hover:bg-rose-950/20"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
