import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { formatTZS, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Download, ShoppingCart, TrendingUp, DollarSign } from "lucide-react";
import { generateReceipt } from "@/lib/receipt";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/sales/")({ component: SalesPage });

function SalesPage() {
  const { t } = useI18n();
  const { theme } = useTheme();

  // 🔍 Fetch sales including IMEI
  const { data: sales = [] } = useQuery({
    queryKey: ["sales-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select(`
          *,
          inventory_items(brand, model, name, item_type),
          customers(full_name, phone),
          profiles(full_name)
        `)
        .order("sale_date", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  // Compute stats
  const totalSales = sales.reduce((sum, s) => {
    const total = (Number(s.sell_price) - Number(s.discount)) * Number(s.quantity);
    return sum + total;
  }, 0);
  const totalProfit = sales.reduce((sum, s) => sum + Number(s.profit ?? 0), 0);
  const totalItems = sales.reduce((sum, s) => sum + Number(s.quantity), 0);

  const stats = [
    { label: t("totalSales"), value: formatTZS(totalSales), icon: TrendingUp },
    { label: t("totalProfit"), value: formatTZS(totalProfit), icon: DollarSign },
    { label: t("itemsSold"), value: String(totalItems), icon: ShoppingCart },
  ];

  // 🧾 Handle receipt generation – opens in new tab
  const handleReceipt = (sale: any) => {
    const it = sale.inventory_items;
    const label = it ? (it.item_type === "phone" ? `${it.brand ?? ""} ${it.model ?? ""}`.trim() : (it.name ?? "")) : "—";
    const total = (Number(sale.sell_price) - Number(sale.discount)) * Number(sale.quantity);

    const pdfData = generateReceipt({
      shopName: t("appName"),
      saleId: sale.id,
      date: sale.sale_date,
      itemLabel: label,
      quantity: sale.quantity,
      unitPrice: Number(sale.sell_price),
      discount: Number(sale.discount),
      total,
      customerName: sale.customers?.full_name,
      customerPhone: sale.customers?.phone,
      cashier: sale.profiles?.full_name,
      paymentType: sale.payment_type === "cash" ? t("cash") : t("installment"),
      warrantyMonths: null, // not stored in sale, can be fetched from warranties table if needed
      imei: sale.imei || null, // ✅ Pass IMEI
    });

    if (pdfData) {
      window.open(pdfData, "_blank");
    }
  };

  return (
    <div className={cn(
      "space-y-6 -m-4 sm:-m-6 p-4 sm:p-6 min-h-full rounded-3xl",
      theme === "dark" ? "bg-[#0f0a12]" : "bg-[#F7F5FA]"
    )}>
      {/* Header with gradient – dark background with pink accent */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-pink-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-20 h-24 w-24 rounded-full bg-rose-500/20 blur-2xl" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{t("sales")}</h1>
            <p className="mt-1 text-sm text-white/70">View and manage all sales transactions</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 backdrop-blur-sm">
              <ShoppingCart className="h-4 w-4 text-white/60" />
              <span className="text-sm">{sales.length} sales</span>
            </div>
            <Link to="/sales/pos">
              <Button className="bg-gradient-to-r from-pink-500 to-rose-500 text-white hover:shadow-lg hover:shadow-pink-500/30 transition-all">
                <Plus className="mr-2 h-4 w-4" /> {t("newSale")}
              </Button>
            </Link>
          </div>
        </div>
        {/* Quick stats */}
        <div className="relative z-10 mt-4 flex flex-wrap gap-4 text-sm">
          {stats.map((s) => (
            <div key={s.label} className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 backdrop-blur-sm">
              <s.icon className="h-4 w-4 text-white/60" />
              <span>{s.label}: {s.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Table card */}
      <Card className="border-0 bg-white/80 shadow-sm backdrop-blur-sm dark:bg-slate-800/90 p-4">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="dark:text-slate-300">{t("date")}</TableHead>
                <TableHead className="dark:text-slate-300">Item</TableHead>
                <TableHead className="dark:text-slate-300">IMEI</TableHead> {/* ✅ New column */}
                <TableHead className="dark:text-slate-300">{t("customer")}</TableHead>
                <TableHead className="dark:text-slate-300">{t("paymentType")}</TableHead>
                <TableHead className="text-right dark:text-slate-300">{t("quantity")}</TableHead>
                <TableHead className="text-right dark:text-slate-300">{t("total")}</TableHead>
                <TableHead className="text-right dark:text-slate-300">{t("profit")}</TableHead>
                <TableHead className="dark:text-slate-300" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground dark:text-slate-400 py-6">
                    {t("empty")}
                  </TableCell>
                </TableRow>
              )}
              {sales.map((s) => {
                const it = s.inventory_items;
                const label = it ? (it.item_type === "phone" ? `${it.brand ?? ""} ${it.model ?? ""}`.trim() : (it.name ?? "")) : "—";
                const total = (Number(s.sell_price) - Number(s.discount)) * Number(s.quantity);
                return (
                  <TableRow key={s.id} className="hover:bg-muted/50 transition dark:hover:bg-slate-700/50">
                    <TableCell className="text-xs dark:text-slate-300">{formatDate(s.sale_date)}</TableCell>
                    <TableCell className="font-medium dark:text-white">{label}</TableCell>
                    <TableCell className="font-mono text-xs dark:text-slate-300">
                      {s.imei || "—"}
                    </TableCell>
                    <TableCell className="dark:text-slate-300">{s.customers?.full_name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={s.payment_type === "cash" ? "secondary" : "outline"} className="dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600">
                        {s.payment_type === "cash" ? t("cash") : t("installment")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right dark:text-slate-300">{s.quantity}</TableCell>
                    <TableCell className="text-right font-semibold dark:text-white">{formatTZS(total)}</TableCell>
                    <TableCell className="text-right text-success dark:text-emerald-400">{formatTZS(Number(s.profit ?? 0))}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleReceipt(s)}
                        className="dark:text-slate-300 dark:hover:text-white"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
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
