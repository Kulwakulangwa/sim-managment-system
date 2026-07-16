import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { formatTZS, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Download } from "lucide-react";
import { generateReceipt } from "@/lib/receipt";

export const Route = createFileRoute("/_authenticated/sales/")({ component: SalesPage });

function SalesPage() {
  const { t } = useI18n();
  const { data: sales = [] } = useQuery({
    queryKey: ["sales-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("*, inventory_items(brand, model, name, item_type), customers(full_name, phone), profiles(full_name)")
        .order("sale_date", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("sales")}</h1>
        <Link to="/sales/pos"><Button><Plus className="mr-2 h-4 w-4" />{t("newSale")}</Button></Link>
      </div>
      <Card className="p-4 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("date")}</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>{t("customer")}</TableHead>
              <TableHead>{t("paymentType")}</TableHead>
              <TableHead className="text-right">{t("quantity")}</TableHead>
              <TableHead className="text-right">{t("total")}</TableHead>
              <TableHead className="text-right">{t("profit")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">{t("empty")}</TableCell></TableRow>
            )}
            {sales.map((s) => {
              const it = s.inventory_items;
              const label = it ? (it.item_type === "phone" ? `${it.brand ?? ""} ${it.model ?? ""}`.trim() : (it.name ?? "")) : "—";
              const total = (Number(s.sell_price) - Number(s.discount)) * Number(s.quantity);
              return (
                <TableRow key={s.id}>
                  <TableCell className="text-xs">{formatDate(s.sale_date)}</TableCell>
                  <TableCell className="font-medium">{label}</TableCell>
                  <TableCell>{s.customers?.full_name ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={s.payment_type === "cash" ? "secondary" : "outline"}>
                      {s.payment_type === "cash" ? t("cash") : t("installment")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{s.quantity}</TableCell>
                  <TableCell className="text-right font-semibold">{formatTZS(total)}</TableCell>
                  <TableCell className="text-right text-success">{formatTZS(Number(s.profit ?? 0))}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => generateReceipt({
                      shopName: t("appName"),
                      saleId: s.id,
                      date: s.sale_date,
                      itemLabel: label,
                      quantity: s.quantity,
                      unitPrice: Number(s.sell_price),
                      discount: Number(s.discount),
                      total,
                      customerName: s.customers?.full_name,
                      customerPhone: s.customers?.phone,
                      cashier: s.profiles?.full_name,
                      paymentType: s.payment_type === "cash" ? t("cash") : t("installment"),
                    })}><Download className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
