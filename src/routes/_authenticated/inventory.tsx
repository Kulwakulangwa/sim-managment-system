import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { formatTZS } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Pencil, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/inventory")({ component: InventoryPage });

type FormState = {
  item_type: "phone" | "accessory";
  brand: string;
  model: string;
  name: string;
  imei: string;
  condition: "new" | "used";
  buy_price: string;
  sell_price: string;
  quantity: string;
  low_stock_threshold: string;
};

const empty: FormState = {
  item_type: "phone",
  brand: "",
  model: "",
  name: "",
  imei: "",
  condition: "new",
  buy_price: "",
  sell_price: "",
  quantity: "1",
  low_stock_threshold: "1",
};

function InventoryPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(empty);

  const { data: items = [] } = useQuery({
    queryKey: ["inventory"],
    queryFn: async () => {
      const { data, error } = await supabase.from("inventory_items").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const upsert = useMutation({
    mutationFn: async () => {
      const payload = {
        item_type: form.item_type,
        brand: form.brand || null,
        model: form.model || null,
        name: form.name || null,
        imei: form.imei || null,
        condition: form.condition,
        buy_price: Number(form.buy_price || 0),
        sell_price: Number(form.sell_price || 0),
        quantity: Number(form.quantity || 0),
        low_stock_threshold: Number(form.low_stock_threshold || 1),
      };
      if (editingId) {
        const { error } = await supabase.from("inventory_items").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("inventory_items").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      setOpen(false); setForm(empty); setEditingId(null);
      toast.success(t("save"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

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
      imei: i.imei ?? "",
      condition: (i.condition ?? "new") as "new" | "used",
      buy_price: String(i.buy_price),
      sell_price: String(i.sell_price),
      quantity: String(i.quantity),
      low_stock_threshold: String(i.low_stock_threshold),
    });
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t("inventory")}</h1>
        <div className="flex gap-2">
          <Link to="/sales/pos"><Button variant="secondary"><ShoppingCart className="mr-2 h-4 w-4" />{t("pos")}</Button></Link>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm(empty); setEditingId(null); } }}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />{t("addItem")}</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{editingId ? t("edit") : t("addItem")}</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>{t("itemType")}</Label>
                  <Select value={form.item_type} onValueChange={(v) => setForm({ ...form, item_type: v as "phone" | "accessory" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="phone">{t("phoneItem")}</SelectItem>
                      <SelectItem value="accessory">{t("accessoryItem")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.item_type === "phone" ? (
                  <>
                    <div><Label>{t("brand")}</Label><Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></div>
                    <div><Label>{t("model")}</Label><Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></div>
                    <div className="col-span-2"><Label>{t("imei")}</Label><Input value={form.imei} onChange={(e) => setForm({ ...form, imei: e.target.value })} /></div>
                    <div>
                      <Label>{t("condition")}</Label>
                      <Select value={form.condition} onValueChange={(v) => setForm({ ...form, condition: v as "new" | "used" })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">{t("new")}</SelectItem>
                          <SelectItem value="used">{t("used")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div />
                  </>
                ) : (
                  <div className="col-span-2"><Label>{t("name")}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                )}
                <div><Label>{t("buyPrice")}</Label><Input type="number" value={form.buy_price} onChange={(e) => setForm({ ...form, buy_price: e.target.value })} /></div>
                <div><Label>{t("sellPrice")}</Label><Input type="number" value={form.sell_price} onChange={(e) => setForm({ ...form, sell_price: e.target.value })} /></div>
                <div><Label>{t("stock")}</Label><Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></div>
                <div><Label>{t("lowStockThreshold")}</Label><Input type="number" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })} /></div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>{t("cancel")}</Button>
                <Button onClick={() => upsert.mutate()} disabled={upsert.isPending}>{t("save")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="p-4">
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder={t("search")} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("itemType")}</TableHead>
                <TableHead>{t("name")}/{t("model")}</TableHead>
                <TableHead>{t("imei")}</TableHead>
                <TableHead className="text-right">{t("buyPrice")}</TableHead>
                <TableHead className="text-right">{t("sellPrice")}</TableHead>
                <TableHead className="text-right">{t("stock")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">{t("empty")}</TableCell></TableRow>
              )}
              {filtered.map((i) => {
                const low = i.quantity <= i.low_stock_threshold;
                return (
                  <TableRow key={i.id}>
                    <TableCell>{i.item_type === "phone" ? t("phoneItem") : t("accessoryItem")}</TableCell>
                    <TableCell className="font-medium">{i.item_type === "phone" ? `${i.brand ?? ""} ${i.model ?? ""}`.trim() : i.name}</TableCell>
                    <TableCell className="font-mono text-xs">{i.imei ?? "—"}</TableCell>
                    <TableCell className="text-right">{formatTZS(i.buy_price)}</TableCell>
                    <TableCell className="text-right">{formatTZS(i.sell_price)}</TableCell>
                    <TableCell className="text-right">
                      {low ? <Badge variant="destructive">{i.quantity}</Badge> : <span>{i.quantity}</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(i)}><Pencil className="h-4 w-4" /></Button>
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
