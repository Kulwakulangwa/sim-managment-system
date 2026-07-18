// src/routes/_authenticated/sales/pos.tsx
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
import { Search, Plus, Minus, ShoppingCart, Check, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { generateReceipt } from "@/lib/receipt";

export const Route = createFileRoute("/_authenticated/sales/pos")({ component: POS });

// ─── Theme tokens ────────────────────────────────────────────
const GRADIENT_BG = "bg-gradient-to-br from-[#1F0A28] to-[#3A1442]";
const BUTTON_GRADIENT = "bg-gradient-to-r from-[#C45BA0] to-[#8B3A8F] hover:shadow-lg hover:shadow-[#C45BA0]/30 transition-all duration-200";

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
  const [imei, setImei] = useState("");

  // ─── Data fetching ──────────────────────────────────────────
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
    return !s || `${i.brand ?? ""} ${i.model ?? ""} ${i.name ?? ""}`.toLowerCase().includes(s);
  }), [items, q]);

  const selected = items.find((i) => i.id === selectedId) ?? null;
  const unit = selected ? Number(selected.sell_price) : 0;
  const subtotal = unit * qty;
  const total = Math.max(0, subtotal - Number(discount || 0));

  const handleSelectItem = (id: string) => {
    setSelectedId(id);
    setQty(1);
    setImei("");
  };

  const complete = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Select an item");
      if (qty < 1 || qty > selected.quantity) throw new Error("Invalid quantity");
      if (!shopId) throw new Error("No shop context");

      if (selected.item_type === "phone" && !imei.trim()) {
        throw new Error("IMEI is required for phone sales");
      }

      if (selected.item_type === "phone" && imei.trim()) {
        const { data: existing } = await supabase
          .from("sales")
          .select("id")
          .eq("imei", imei.trim())
          .maybeSingle();
        if (existing) {
          throw new Error("This IMEI has already been sold");
        }
      }

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
        imei: selected.item_type === "phone" ? imei.trim() : null,
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

  // ─── Render ──────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <ShoppingCart className="h-6 w-6 text-[#C45BA0]" />
          {t("pos")}
        </h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate({ to: "/sales" })}
            className="border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            View Sales
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left – Item selection */}
        <Card className="lg:col-span-2 border-0 shadow-md bg-white/90 backdrop-blur-sm">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-slate-700">{t("selectItem")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                className="pl-9 border-slate-200 focus:ring-2 focus:ring-[#C45BA0]/50 focus:border-[#C45BA0]"
                placeholder="Search by brand, model, or name"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-100 scrollbar-thin scrollbar-thumb-slate-300">
              {filtered.length === 0 && (
                <p className="p-6 text-sm text-slate-400 text-center">{t("empty")}</p>
              )}
              {filtered.map((i) => {
                const active = selectedId === i.id;
                const label = i.item_type === "phone" ? `${i.brand ?? ""} ${i.model ?? ""}`.trim() : i.name;
                return (
                  <button
                    key={i.id}
                    onClick={() => handleSelectItem(i.id)}
                    className={`w-full text-left p-3 flex items-center gap-3 transition-all duration-200 ${
                      active
                        ? "bg-gradient-to-r from-[#C45BA0]/10 to-[#8B3A8F]/5 border-l-4 border-[#C45BA0]"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    {i.photo_url && (
                      <img src={i.photo_url} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0 shadow-sm" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800">{label}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>Stock: {i.quantity}</span>
                        {i.condition && <span>· {i.condition}</span>}
                      </div>
                    </div>
                    <p className="font-semibold text-slate-700">{formatTZS(i.sell_price)}</p>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Right – Sale form */}
        <Card className="border-0 shadow-md bg-white/90 backdrop-blur-sm">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-slate-700">{t("newSale")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {selected ? (
              <>
                {/* Selected item preview */}
                <div className="rounded-xl bg-gradient-to-br from-slate-50 to-white p-4 border border-slate-200 flex items-center gap-4">
                  {selected.photo_url && (
                    <img src={selected.photo_url} alt="" className="w-16 h-16 rounded-xl object-cover flex-shrink-0 shadow-md" />
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800">
                      {selected.item_type === "phone" ? `${selected.brand ?? ""} ${selected.model ?? ""}` : selected.name}
                    </p>
                    <p className="text-sm text-slate-500">{formatTZS(unit)} · Stock: {selected.quantity}</p>
                    {selected.condition && (
                      <span className="inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
                        {selected.condition}
                      </span>
                    )}
                  </div>
                </div>

                {/* IMEI – only for phones */}
                {selected.item_type === "phone" && (
                  <div>
                    <Label className="text-sm font-medium text-slate-700 flex items-center gap-1">
                      IMEI <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      value={imei}
                      onChange={(e) => setImei(e.target.value)}
                      placeholder="Enter IMEI number"
                      className={`mt-1 border-slate-200 focus:ring-2 focus:ring-[#C45BA0]/50 focus:border-[#C45BA0] ${
                        !imei.trim() ? "border-red-300" : "border-slate-200"
                      }`}
                    />
                    {!imei.trim() && (
                      <p className="text-xs text-red-500 mt-1">IMEI is required for phone sales</p>
                    )}
                  </div>
                )}

                {/* Quantity */}
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("quantity")}</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => setQty((n) => Math.max(1, n - 1))}
                      className="border-slate-200 hover:bg-slate-100"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                      type="number"
                      value={qty}
                      onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
                      className="text-center w-20 border-slate-200 focus:ring-2 focus:ring-[#C45BA0]/50 focus:border-[#C45BA0]"
                    />
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => setQty((n) => Math.min(selected.quantity, n + 1))}
                      className="border-slate-200 hover:bg-slate-100"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Discount */}
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("discount")}</Label>
                  <Input
                    type="number"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    className="mt-1 border-slate-200 focus:ring-2 focus:ring-[#C45BA0]/50 focus:border-[#C45BA0]"
                  />
                </div>

                {/* Customer */}
                <div>
                  <Label className="text-sm font-medium text-slate-700">
                    {t("customer")} <span className="text-slate-400 text-xs">({t("optional")})</span>
                  </Label>
                  <Select value={customerId} onValueChange={setCustomerId}>
                    <SelectTrigger className="mt-1 border-slate-200 focus:ring-2 focus:ring-[#C45BA0]/50 focus:border-[#C45BA0]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.full_name} · {c.phone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {customerId === "none" && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <Input
                        placeholder={t("fullName")}
                        value={newCust.name}
                        onChange={(e) => setNewCust({ ...newCust, name: e.target.value })}
                        className="border-slate-200 focus:ring-2 focus:ring-[#C45BA0]/50 focus:border-[#C45BA0]"
                      />
                      <Input
                        placeholder={t("phone")}
                        value={newCust.phone}
                        onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })}
                        className="border-slate-200 focus:ring-2 focus:ring-[#C45BA0]/50 focus:border-[#C45BA0]"
                      />
                    </div>
                  )}
                </div>

                {/* Payment Type */}
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("paymentType")}</Label>
                  <Select value={paymentType} onValueChange={(v) => setPaymentType(v as "cash" | "installment")}>
                    <SelectTrigger className="mt-1 border-slate-200 focus:ring-2 focus:ring-[#C45BA0]/50 focus:border-[#C45BA0]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">{t("cash")}</SelectItem>
                      <SelectItem value="installment">{t("installment")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Installment options */}
                {paymentType === "installment" && (
                  <div className="space-y-2 p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <div>
                      <Label className="text-sm font-medium text-slate-700">{t("installmentMonths")}</Label>
                      <Input
                        type="number"
                        value={installmentMonths}
                        onChange={(e) => setInstallmentMonths(e.target.value)}
                        className="mt-1 border-slate-200 focus:ring-2 focus:ring-[#C45BA0]/50 focus:border-[#C45BA0]"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-700">{t("downPayment")}</Label>
                      <Input
                        type="number"
                        value={downPayment}
                        onChange={(e) => setDownPayment(e.target.value)}
                        className="mt-1 border-slate-200 focus:ring-2 focus:ring-[#C45BA0]/50 focus:border-[#C45BA0]"
                      />
                    </div>
                  </div>
                )}

                {/* Warranty – only for phones */}
                {selected.item_type === "phone" && (
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("warrantyMonths")}</Label>
                    <Input
                      type="number"
                      value={warrantyMonths}
                      onChange={(e) => setWarrantyMonths(e.target.value)}
                      className="mt-1 border-slate-200 focus:ring-2 focus:ring-[#C45BA0]/50 focus:border-[#C45BA0]"
                    />
                  </div>
                )}

                {/* Totals */}
                <div className="space-y-1 border-t border-slate-200 pt-3 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>{t("subtotal")}</span>
                    <span>{formatTZS(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>{t("discount")}</span>
                    <span>-{formatTZS(Number(discount || 0))}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold text-slate-800 pt-1 border-t border-slate-200">
                    <span>{t("grandTotal")}</span>
                    <span>{formatTZS(total)}</span>
                  </div>
                </div>

                {/* Complete Sale Button */}
                <Button
                  className={`w-full ${BUTTON_GRADIENT} text-white font-medium h-12 text-base`}
                  onClick={() => complete.mutate()}
                  disabled={complete.isPending || (selected.item_type === "phone" && !imei.trim())}
                >
                  {complete.isPending ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
                      Processing…
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Check className="h-5 w-5" />
                      {t("completeSale")}
                    </span>
                  )}
                </Button>
              </>
            ) : (
              <div className="py-12 text-center">
                <ShoppingCart className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                <p className="text-slate-500">{t("selectItem")}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
