import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useShopId } from "@/hooks/use-role";
import { formatTZS } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Minus, ShoppingCart } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { generateReceipt } from "@/lib/receipt";

export const Route = createFileRoute("/_authenticated/sales/pos")({ component: POS });

function POS() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const shopId = useShopId();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [discount, setDiscount] = useState("0");
  const [customerId, setCustomerId] = useState<string>("none");
  const [newCust, setNewCust] = useState({ name: "", phone: "" });
  const [paymentType, setPaymentType] = useState<"cash" | "installment">("cash");
  const [warrantyMonths, setWarrantyMonths] = useState("0");
  const [installmentMonths, setInstallmentMonths] = useState("3");
  const [downPayment, setDownPayment] = useState("0");

  const { data: items = [] } = useQuery({
    queryKey: ["inventory-pos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("inventory_items").select("*").gt("quantity", 0);
      if (error) throw error;
      return data;
    },
  });
  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => (await supabase.from("customers").select("*").order("full_name")).data ?? [],
  });

  const filtered = useMemo(() => items.filter((i) => {
    const s = q.toLowerCase();
    return !s || `${i.brand ?? ""} ${i.model ?? ""} ${i.name ?? ""} ${i.imei ?? ""}`.toLowerCase().includes(s);
  }), [items, q]);

  const selected = items.find((i) => i.id === selectedId) ?? null;
  const unit = selected ? Number(selected.sell_price) : 0;
  const subtotal = unit * qty;
  const total = Math.max(0, subtotal - Number(discount || 0));

  const complete = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Select an item");
      if (qty < 1 || qty > selected.quantity) throw new Error("Invalid quantity");
      if (!shopId) throw new Error("No shop context");

      let custId: string | null = customerId !== "none" ? customerId : null;
      if (!custId && (newCust.name || newCust.phone) && paymentType === "installment") {
        if (!newCust.name || !newCust.phone) throw new Error("Customer required for installment");
      }
      if (!custId && newCust.name && newCust.phone) {
        const { data, error } = await supabase.from("customers").insert({ full_name: newCust.name, phone: newCust.phone, shop_id: shopId }).select("id").single();
        if (error) throw error;
        custId = data.id;
      }
      if (paymentType === "installment" && !custId) throw new Error("Customer required for installment");

      const { data: userRes } = await supabase.auth.getUser();
      const { data: sale, error: se } = await supabase.from("sales").insert({
        inventory_item_id: selected.id,
        customer_id: custId,
        quantity: qty,
        sell_price: unit,
        discount: Number(discount || 0),
        buy_price_snapshot: Number(selected.buy_price),
        payment_type: paymentType,
        sold_by: userRes.user?.id ?? null,
        shop_id: shopId,
      }).select("id, sale_date").single();
      if (se) throw se;

      const wm = Number(warrantyMonths || 0);
      if (wm > 0) {
        const start = new Date();
        const end = new Date(start); end.setMonth(end.getMonth() + wm);
        await supabase.from("warranties").insert({
          sale_id: sale.id,
          period_months: wm,
          start_date: start.toISOString().slice(0, 10),
          end_date: end.toISOString().slice(0, 10),
          shop_id: shopId,
        });
      }

      if (paymentType === "installment") {
        const months = Math.max(1, Number(installmentMonths || 1));
        const down = Number(downPayment || 0);
        const { data: plan, error: pe } = await supabase.from("installment_plans").insert({
          sale_id: sale.id,
          total_amount: total,
          paid_amount: down,
          shop_id: shopId,
        }).select("id").single();
        if (pe) throw pe;
        const remaining = Math.max(0, total - down);
        const per = remaining / months;
        const rows = Array.from({ length: months }).map((_, idx) => {
          const due = new Date(); due.setMonth(due.getMonth() + idx + 1);
          return { installment_plan_id: plan.id, amount: per, due_date: due.toISOString().slice(0, 10), status: "pending" as const, shop_id: shopId };
        });
        if (rows.length) await supabase.from("installment_payments").insert(rows);
      }

      return { saleId: sale.id, saleDate: sale.sale_date };
    },
    onSuccess: async ({ saleId, saleDate }) => {
      toast.success(t("saleCompleted"));
      const label = selected ? (selected.item_type === "phone" ? `${selected.brand ?? ""} ${selected.model ?? ""}`.trim() : selected.name ?? "") : "";
      const cust = customerId !== "none" ? customers.find((c) => c.id === customerId) : null;
      generateReceipt({
        shopName: t("appName"),
        saleId,
        date: saleDate,
        itemLabel: label,
        quantity: qty,
        unitPrice: unit,
        discount: Number(discount || 0),
        total,
        customerName: cust?.full_name ?? newCust.name ?? null,
        customerPhone: cust?.phone ?? newCust.phone ?? null,
        paymentType: paymentType === "cash" ? t("cash") : t("installment"),
        warrantyMonths: Number(warrantyMonths || 0) || null,
      });
      qc.invalidateQueries();
      navigate({ to: "/sales" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2"><ShoppingCart className="h-6 w-6" />{t("pos")}</h1>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>{t("selectItem")}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder={t("search")} value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="max-h-[420px] overflow-y-auto divide-y">
              {filtered.length === 0 && <p className="p-4 text-sm text-muted-foreground text-center">{t("empty")}</p>}
              {filtered.map((i) => {
                const active = selectedId === i.id;
                const label = i.item_type === "phone" ? `${i.brand ?? ""} ${i.model ?? ""}`.trim() : i.name;
                return (
                  <button key={i.id} onClick={() => { setSelectedId(i.id); setQty(1); }}
                    className={`w-full text-left p-3 flex items-center justify-between hover:bg-accent transition ${active ? "bg-accent" : ""}`}>
                    <div>
                      <p className="font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">{i.imei ?? ""} · {t("stock")}: {i.quantity}</p>
                    </div>
                    <p className="font-semibold">{formatTZS(i.sell_price)}</p>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("newSale")}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {selected ? (
              <>
                <div className="rounded-md bg-muted p-3">
                  <p className="text-sm font-medium">{selected.item_type === "phone" ? `${selected.brand ?? ""} ${selected.model ?? ""}` : selected.name}</p>
                  <p className="text-xs text-muted-foreground">{formatTZS(unit)}</p>
                </div>
                <div>
                  <Label>{t("quantity")}</Label>
                  <div className="flex items-center gap-2">
                    <Button size="icon" variant="outline" onClick={() => setQty((n) => Math.max(1, n - 1))}><Minus className="h-4 w-4" /></Button>
                    <Input type="number" value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value)))} className="text-center" />
                    <Button size="icon" variant="outline" onClick={() => setQty((n) => Math.min(selected.quantity, n + 1))}><Plus className="h-4 w-4" /></Button>
                  </div>
                </div>
                <div><Label>{t("discount")}</Label><Input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} /></div>
                <div>
                  <Label>{t("customer")} ({t("optional")})</Label>
                  <Select value={customerId} onValueChange={setCustomerId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name} · {c.phone}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {customerId === "none" && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <Input placeholder={t("fullName")} value={newCust.name} onChange={(e) => setNewCust({ ...newCust, name: e.target.value })} />
                      <Input placeholder={t("phone")} value={newCust.phone} onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })} />
                    </div>
                  )}
                </div>
                <div>
                  <Label>{t("paymentType")}</Label>
                  <Select value={paymentType} onValueChange={(v) => setPaymentType(v as "cash" | "installment")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">{t("cash")}</SelectItem>
                      <SelectItem value="installment">{t("installment")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {paymentType === "installment" && (
                  <>
                    <div><Label>{t("installmentMonths")}</Label><Input type="number" value={installmentMonths} onChange={(e) => setInstallmentMonths(e.target.value)} /></div>
                    <div><Label>{t("downPayment")}</Label><Input type="number" value={downPayment} onChange={(e) => setDownPayment(e.target.value)} /></div>
                  </>
                )}
                {selected.item_type === "phone" && (
                  <div><Label>{t("warrantyMonths")}</Label><Input type="number" value={warrantyMonths} onChange={(e) => setWarrantyMonths(e.target.value)} /></div>
                )}
                <div className="space-y-1 border-t pt-3 text-sm">
                  <div className="flex justify-between"><span>{t("subtotal")}</span><span>{formatTZS(subtotal)}</span></div>
                  <div className="flex justify-between"><span>{t("discount")}</span><span>-{formatTZS(Number(discount || 0))}</span></div>
                  <div className="flex justify-between text-base font-bold pt-1"><span>{t("grandTotal")}</span><span>{formatTZS(total)}</span></div>
                </div>
                <Button className="w-full" size="lg" onClick={() => complete.mutate()} disabled={complete.isPending}>{t("completeSale")}</Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">{t("selectItem")}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
