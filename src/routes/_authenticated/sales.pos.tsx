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
import { Search, Plus, Minus, ShoppingCart, Check, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/sales/pos")({ component: POS });

const BUTTON_GRADIENT = "bg-gradient-to-r from-pink-500 to-rose-500 hover:shadow-lg hover:shadow-pink-500/30 transition-all duration-200";

function POS() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const shopId = useShopId();
  const navigate = useNavigate();
  const { theme } = useTheme();
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

  // ─── Winga state ──────────────────────────────────────────────
  const [isWinga, setIsWinga] = useState(false);
  const [agentId, setAgentId] = useState<string>("none");
  const { data: agents = [] } = useQuery({
    queryKey: ["agents-pos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agents")
        .select("id, name, phone")
        .eq("shop_id", shopId);
      if (error) throw error;
      return data;
    },
    enabled: isWinga,
  });

  const { data: items = [] } = useQuery({
    queryKey: ["inventory-pos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("inventory_items").select("*").gt("quantity", 0).is("deleted_at", null);
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

  const handleSelectItem = (id: string) => {
    const item = items.find(i => i.id === id);
    setSelectedId(id);
    setQty(1);
    if (item?.item_type === "phone" && item.imei) {
      setImei(item.imei);
    } else {
      setImei("");
    }
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

      let custId: string | null = null;
      let agentIdValue: string | null = null;
      let paymentTypeValue: string = paymentType;

      if (isWinga) {
        // Winga mode: require agent selection
        if (!agentId || agentId === "none") throw new Error("Please select an agent");
        agentIdValue = agentId;
        paymentTypeValue = "winga";
        // No customer for winga
      } else {
        // Normal mode: customer handling
        custId = customerId !== "none" ? customerId : null;
        if (!custId && (newCust.name || newCust.phone)) {
          if (!newCust.name || !newCust.phone) throw new Error("Please enter customer name and phone");
          const { data, error } = await supabase.from("customers").insert({ full_name: newCust.name, phone: newCust.phone, shop_id: shopId }).select("id").single();
          if (error) throw error;
          custId = data.id;
        }
        if (paymentType === "installment" && !custId) throw new Error("Customer required for installment");
      }

      const { data: userRes } = await supabase.auth.getUser();
      const { data: sale, error: se } = await supabase.from("sales").insert({
        inventory_item_id: selected.id,
        customer_id: custId,
        agent_id: agentIdValue,
        quantity: qty,
        sell_price: unit,
        discount: Number(discount || 0),
        buy_price_snapshot: Number(selected.buy_price),
        payment_type: paymentTypeValue,
        sold_by: userRes.user?.id ?? null,
        shop_id: shopId,
        imei: selected.item_type === "phone" ? imei.trim() : null,
        winga_settled: isWinga ? false : null,
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
    onSuccess: async () => {
      toast.success(t("saleCompleted"));
      qc.invalidateQueries();
      navigate({ to: "/sales" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className={cn(
      "space-y-6 -m-4 sm:-m-6 p-4 sm:p-6 min-h-full rounded-3xl",
      theme === "dark" ? "bg-[#0f0a12]" : "bg-[#F7F5FA]"
    )}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className={cn(
          "text-2xl font-bold flex items-center gap-2",
          theme === "dark" ? "text-white" : "text-slate-800"
        )}>
          <ShoppingCart className="h-6 w-6 text-pink-500" />
          {t("pos")}
        </h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate({ to: "/sales" })}
            className={cn(
              "border-slate-200 hover:bg-slate-50",
              theme === "dark" && "border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
            )}
          >
            View Sales
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className={cn(
          "lg:col-span-2 border-0 shadow-md backdrop-blur-sm",
          theme === "dark" ? "bg-slate-800/90" : "bg-white/90"
        )}>
          <CardHeader className={cn(
            "pb-3 border-b",
            theme === "dark" ? "border-slate-700" : "border-slate-100"
          )}>
            <CardTitle className={theme === "dark" ? "text-slate-200" : "text-slate-700"}>
              {t("selectItem")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                className={cn(
                  "pl-9 focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500",
                  theme === "dark"
                    ? "border-slate-700 bg-slate-900 text-white placeholder-slate-400"
                    : "border-slate-200"
                )}
                placeholder="Search by brand, model, name, or IMEI"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="max-h-[420px] overflow-y-auto divide-y scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600">
              {filtered.length === 0 && (
                <p className={cn(
                  "p-6 text-sm text-center",
                  theme === "dark" ? "text-slate-400" : "text-slate-400"
                )}>
                  {t("empty")}
                </p>
              )}
              {filtered.map((i) => {
                const active = selectedId === i.id;
                const label = i.item_type === "phone" ? `${i.brand ?? ""} ${i.model ?? ""}`.trim() : i.name;
                return (
                  <button
                    key={i.id}
                    onClick={() => handleSelectItem(i.id)}
                    className={cn(
                      "w-full text-left p-3 flex items-center gap-3 transition-all duration-200",
                      active
                        ? "bg-gradient-to-r from-pink-500/20 to-rose-500/10 border-l-4 border-pink-500"
                        : theme === "dark"
                          ? "hover:bg-slate-700/50"
                          : "hover:bg-slate-50",
                      theme === "dark" ? "border-slate-700" : "border-slate-100"
                    )}
                  >
                    {i.photo_url && (
                      <img src={i.photo_url} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0 shadow-sm" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "font-medium",
                        theme === "dark" ? "text-slate-200" : "text-slate-800"
                      )}>
                        {label}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>Stock: {i.quantity}</span>
                        {i.condition && <span>· {i.condition}</span>}
                        {i.imei && <span className="font-mono">· IMEI: {i.imei}</span>}
                      </div>
                    </div>
                    <p className={cn(
                      "font-semibold",
                      theme === "dark" ? "text-slate-200" : "text-slate-700"
                    )}>
                      {formatTZS(i.sell_price)}
                    </p>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className={cn(
          "border-0 shadow-md backdrop-blur-sm",
          theme === "dark" ? "bg-slate-800/90" : "bg-white/90"
        )}>
          <CardHeader className={cn(
            "pb-3 border-b",
            theme === "dark" ? "border-slate-700" : "border-slate-100"
          )}>
            <CardTitle className={theme === "dark" ? "text-slate-200" : "text-slate-700"}>
              {t("newSale")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {selected ? (
              <>
                <div className={cn(
                  "rounded-xl p-4 border flex items-center gap-4",
                  theme === "dark"
                    ? "bg-slate-700/50 border-slate-700"
                    : "bg-gradient-to-br from-slate-50 to-white border-slate-200"
                )}>
                  {selected.photo_url && (
                    <img src={selected.photo_url} alt="" className="w-16 h-16 rounded-xl object-cover flex-shrink-0 shadow-md" />
                  )}
                  <div className="min-w-0">
                    <p className={cn(
                      "font-semibold",
                      theme === "dark" ? "text-slate-200" : "text-slate-800"
                    )}>
                      {selected.item_type === "phone" ? `${selected.brand ?? ""} ${selected.model ?? ""}` : selected.name}
                    </p>
                    <p className="text-sm text-slate-500">
                      {formatTZS(unit)} · Stock: {selected.quantity}
                    </p>
                    {selected.condition && (
                      <span className={cn(
                        "inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full",
                        theme === "dark" ? "bg-slate-600 text-slate-300" : "bg-slate-200 text-slate-600"
                      )}>
                        {selected.condition}
                      </span>
                    )}
                  </div>
                </div>

                {selected.item_type === "phone" && (
                  <div>
                    <Label className={cn(
                      "text-sm font-medium flex items-center gap-1",
                      theme === "dark" ? "text-slate-300" : "text-slate-700"
                    )}>
                      IMEI <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      value={imei}
                      readOnly
                      disabled
                      className={cn(
                        "mt-1 bg-slate-100 dark:bg-slate-700 cursor-not-allowed",
                        theme === "dark"
                          ? "border-slate-600 text-slate-300"
                          : "border-slate-200 text-slate-600"
                      )}
                    />
                    <p className="text-xs text-muted-foreground mt-1">IMEI is auto-filled from the selected phone.</p>
                  </div>
                )}

                <div>
                  <Label className={cn(
                    "text-sm font-medium",
                    theme === "dark" ? "text-slate-300" : "text-slate-700"
                  )}>
                    {t("quantity")}
                  </Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => setQty((n) => Math.max(1, n - 1))}
                      className={cn(
                        "border-slate-200 hover:bg-slate-100",
                        theme === "dark" && "border-slate-700 hover:bg-slate-700 hover:text-white"
                      )}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                      type="number"
                      value={qty}
                      onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
                      className={cn(
                        "text-center w-20 focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500",
                        theme === "dark"
                          ? "border-slate-700 bg-slate-900 text-white"
                          : "border-slate-200"
                      )}
                    />
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => setQty((n) => Math.min(selected.quantity, n + 1))}
                      className={cn(
                        "border-slate-200 hover:bg-slate-100",
                        theme === "dark" && "border-slate-700 hover:bg-slate-700 hover:text-white"
                      )}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className={cn(
                    "text-sm font-medium",
                    theme === "dark" ? "text-slate-300" : "text-slate-700"
                  )}>
                    {t("discount")}
                  </Label>
                  <Input
                    type="number"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    className={cn(
                      "mt-1 focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500",
                      theme === "dark"
                        ? "border-slate-700 bg-slate-900 text-white"
                        : "border-slate-200"
                    )}
                  />
                </div>

                {/* ─── Customer / Agent section ────────────────── */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Label className={cn(
                      "text-sm font-medium",
                      theme === "dark" ? "text-slate-300" : "text-slate-700"
                    )}>
                      {isWinga ? "Agent" : "Customer"}
                    </Label>
                    <Button
                      size="sm"
                      variant={isWinga ? "default" : "outline"}
                      onClick={() => {
                        setIsWinga(!isWinga);
                        if (!isWinga) {
                          setAgentId("none");
                        } else {
                          setCustomerId("none");
                        }
                      }}
                      className={cn(
                        isWinga ? "bg-pink-500 hover:bg-pink-600" : "",
                        "text-xs h-7"
                      )}
                    >
                      <Users className="h-3 w-3 mr-1" />
                      {isWinga ? "Winga mode" : "Customer"}
                    </Button>
                  </div>

                  {isWinga ? (
                    <Select value={agentId} onValueChange={setAgentId}>
                      <SelectTrigger className={cn(
                        "mt-1 focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500",
                        theme === "dark" ? "border-slate-700 bg-slate-900 text-white" : "border-slate-200"
                      )}>
                        <SelectValue placeholder="Select agent" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {agents.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name} · {a.phone || "no phone"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <>
                      <Select value={customerId} onValueChange={setCustomerId}>
                        <SelectTrigger className={cn(
                          "mt-1 focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500",
                          theme === "dark" ? "border-slate-700 bg-slate-900 text-white" : "border-slate-200"
                        )}>
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
                            className={cn(
                              "focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500",
                              theme === "dark"
                                ? "border-slate-700 bg-slate-900 text-white placeholder-slate-400"
                                : "border-slate-200"
                            )}
                          />
                          <Input
                            placeholder={t("phone")}
                            value={newCust.phone}
                            onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })}
                            className={cn(
                              "focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500",
                              theme === "dark"
                                ? "border-slate-700 bg-slate-900 text-white placeholder-slate-400"
                                : "border-slate-200"
                            )}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div>
                  <Label className={cn(
                    "text-sm font-medium",
                    theme === "dark" ? "text-slate-300" : "text-slate-700"
                  )}>
                    {t("paymentType")}
                  </Label>
                  <Select value={paymentType} onValueChange={(v) => setPaymentType(v as "cash" | "installment")}>
                    <SelectTrigger className={cn(
                      "mt-1 focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500",
                      theme === "dark"
                        ? "border-slate-700 bg-slate-900 text-white"
                        : "border-slate-200"
                    )}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">{t("cash")}</SelectItem>
                      <SelectItem value="installment">{t("installment")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {paymentType === "installment" && (
                  <div className={cn(
                    "space-y-2 p-3 rounded-lg border",
                    theme === "dark"
                      ? "bg-slate-700/30 border-slate-700"
                      : "bg-slate-50 border-slate-200"
                  )}>
                    <div>
                      <Label className={cn(
                        "text-sm font-medium",
                        theme === "dark" ? "text-slate-300" : "text-slate-700"
                      )}>
                        {t("installmentMonths")}
                      </Label>
                      <Input
                        type="number"
                        value={installmentMonths}
                        onChange={(e) => setInstallmentMonths(e.target.value)}
                        className={cn(
                          "mt-1 focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500",
                          theme === "dark"
                            ? "border-slate-700 bg-slate-900 text-white"
                            : "border-slate-200"
                        )}
                      />
                    </div>
                    <div>
                      <Label className={cn(
                        "text-sm font-medium",
                        theme === "dark" ? "text-slate-300" : "text-slate-700"
                      )}>
                        {t("downPayment")}
                      </Label>
                      <Input
                        type="number"
                        value={downPayment}
                        onChange={(e) => setDownPayment(e.target.value)}
                        className={cn(
                          "mt-1 focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500",
                          theme === "dark"
                            ? "border-slate-700 bg-slate-900 text-white"
                            : "border-slate-200"
                        )}
                      />
                    </div>
                  </div>
                )}

                {selected.item_type === "phone" && (
                  <div>
                    <Label className={cn(
                      "text-sm font-medium",
                      theme === "dark" ? "text-slate-300" : "text-slate-700"
                    )}>
                      {t("warrantyMonths")}
                    </Label>
                    <Input
                      type="number"
                      value={warrantyMonths}
                      onChange={(e) => setWarrantyMonths(e.target.value)}
                      className={cn(
                        "mt-1 focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500",
                        theme === "dark"
                          ? "border-slate-700 bg-slate-900 text-white"
                          : "border-slate-200"
                      )}
                    />
                  </div>
                )}

                <div className={cn(
                  "space-y-1 border-t pt-3 text-sm",
                  theme === "dark" ? "border-slate-700" : "border-slate-200"
                )}>
                  <div className={cn(
                    "flex justify-between",
                    theme === "dark" ? "text-slate-400" : "text-slate-600"
                  )}>
                    <span>{t("subtotal")}</span>
                    <span>{formatTZS(subtotal)}</span>
                  </div>
                  <div className={cn(
                    "flex justify-between",
                    theme === "dark" ? "text-slate-400" : "text-slate-600"
                  )}>
                    <span>{t("discount")}</span>
                    <span>-{formatTZS(Number(discount || 0))}</span>
                  </div>
                  <div className={cn(
                    "flex justify-between text-base font-bold pt-1 border-t",
                    theme === "dark" ? "border-slate-700 text-white" : "border-slate-200 text-slate-800"
                  )}>
                    <span>{t("grandTotal")}</span>
                    <span>{formatTZS(total)}</span>
                  </div>
                </div>

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
                <ShoppingCart className={cn(
                  "h-12 w-12 mx-auto mb-3",
                  theme === "dark" ? "text-slate-600" : "text-slate-300"
                )} />
                <p className={theme === "dark" ? "text-slate-400" : "text-slate-500"}>
                  {t("selectItem")}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
