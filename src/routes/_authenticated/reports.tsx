// ... imports ...

function ReportsPage() {
  // ... state and presets ...

  const { data, isLoading } = useQuery({
    queryKey: ["reports", startDate, endDate],
    queryFn: async () => {
      const start = startDate ? new Date(startDate).toISOString() : null;
      const end = endDate ? new Date(endDate + "T23:59:59").toISOString() : null;

      // ── Sales (exclude returned winga) ──
      let salesQuery = supabase
        .from("sales")
        .select("sell_price, discount, quantity, profit, inventory_items(brand, model, item_type, name)")
        .or('winga_returned.is.null, winga_returned.eq.false');
      if (start) salesQuery = salesQuery.gte("sale_date", start);
      if (end) salesQuery = salesQuery.lte("sale_date", end);
      const salesRes = await salesQuery;

      // ── Expenses ──
      let expQuery = supabase.from("expenses").select("amount");
      if (start) expQuery = expQuery.gte("expense_date", start);
      if (end) expQuery = expQuery.lte("expense_date", end);
      const expRes = await expQuery;

      // ── Repairs ──
      let repairsQuery = supabase
        .from("repairs")
        .select("repair_cost, paid_amount, payment_status, status");
      if (start) repairsQuery = repairsQuery.gte("received_date", start);
      if (end) repairsQuery = repairsQuery.lte("received_date", end);
      const repairsRes = await repairsQuery;

      // ── Inventory ──
      const invRes = await supabase
        .from("inventory_items")
        .select("*")
        .order("quantity");

      // ── Winga revenue (settled, not returned) ──
      let wingaQuery = supabase
        .from("sales")
        .select("sell_price, discount, quantity")
        .eq("winga_settled", true)
        .or('winga_returned.is.null, winga_returned.eq.false');
      if (start) wingaQuery = wingaQuery.gte("sale_date", start);
      if (end) wingaQuery = wingaQuery.lte("sale_date", end);
      const wingaRes = await wingaQuery;
      const wingaRevenue = (wingaRes.data ?? []).reduce(
        (s, r) => s + (Number(r.sell_price) - Number(r.discount)) * Number(r.quantity),
        0
      );

      const sales = salesRes.data ?? [];
      const totalRev = sales.reduce((s, r) => s + (Number(r.sell_price) - Number(r.discount)) * Number(r.quantity), 0);
      const totalProfit = sales.reduce((s, r) => s + Number(r.profit ?? 0), 0);
      const totalExp = (expRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0);

      const repairs = repairsRes.data ?? [];
      const repairIncome = repairs
        .filter((r) => r.status === "completed" && r.payment_status === "paid")
        .reduce((sum, r) => sum + Number(r.paid_amount || 0), 0);

      // Best sellers (from sales)
      const bucket = new Map<string, number>();
      for (const s of sales) {
        const it = s.inventory_items;
        if (!it || it.item_type !== "phone") continue;
        const key = `${it.brand ?? ""} ${it.model ?? ""}`.trim() || "—";
        bucket.set(key, (bucket.get(key) ?? 0) + Number(s.quantity));
      }
      const best = Array.from(bucket.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);

      return {
        totalRev,
        totalProfit,
        totalExp,
        netProfit: totalProfit - totalExp,
        best,
        inv: invRes.data ?? [],
        repairIncome,
        wingaRevenue,
      };
    },
  });

  const stats = [
    { label: "Sales Revenue", value: formatTZS(data?.totalRev ?? 0), icon: ShoppingCart, badge: "ember" },
    { label: "Repair Income", value: formatTZS(data?.repairIncome ?? 0), icon: Wrench, badge: "pink" },
    { label: "Winga Revenue", value: formatTZS(data?.wingaRevenue ?? 0), icon: DollarSign, badge: "crimson" },
    { label: "Expenses", value: formatTZS(data?.totalExp ?? 0), icon: Receipt, badge: "wine" },
    { label: "Net Profit", value: formatTZS(data?.netProfit ?? 0), icon: DollarSign, badge: "slate" },
  ];

  // ... rest (date picker, tables, etc.) ...
}
