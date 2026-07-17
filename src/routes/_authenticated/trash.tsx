import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { useMyRole } from "@/hooks/use-role";
import { restoreRow, hardDelete, type SoftTable } from "@/lib/soft-delete";
import { Trash2, Undo2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/trash")({
  component: TrashPage,
});

const TABS: { key: SoftTable; label: string; cols: { field: string; label: string }[] }[] = [
  { key: "inventory_items", label: "Products", cols: [{ field: "name", label: "Name" }, { field: "brand", label: "Brand" }, { field: "imei", label: "IMEI" }] },
  { key: "sales", label: "Sales", cols: [{ field: "sale_date", label: "Date" }, { field: "sell_price", label: "Price" }] },
  { key: "customers", label: "Customers", cols: [{ field: "full_name", label: "Name" }, { field: "phone", label: "Phone" }] },
  { key: "repairs", label: "Repairs", cols: [{ field: "device_description", label: "Device" }, { field: "status", label: "Status" }] },
  { key: "expenses", label: "Expenses", cols: [{ field: "category", label: "Category" }, { field: "amount", label: "Amount" }] },
];

function TrashPage() {
  const { data: role } = useMyRole();
  const isSuper = role?.isSuperAdmin ?? false;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Trash</h1>
        <p className="text-sm text-muted-foreground">Restore records deleted by mistake. Items stay here until permanently removed.</p>
      </div>
      <Tabs defaultValue="inventory_items">
        <TabsList className="flex-wrap">
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>
          ))}
        </TabsList>
        {TABS.map((t) => (
          <TabsContent key={t.key} value={t.key}>
            <TrashTable table={t.key} cols={t.cols} isSuper={isSuper} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function TrashTable({ table, cols, isSuper }: { table: SoftTable; cols: { field: string; label: string }[]; isSuper: boolean }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["trash", table],
    queryFn: async () => {
      const { data, error } = await supabase.from(table).select("*").not("deleted_at", "is", null).order("deleted_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const onRestore = async (id: string) => {
    const { error } = await restoreRow(table, id);
    if (error) return toast.error(error.message);
    toast.success("Restored");
    qc.invalidateQueries({ queryKey: ["trash", table] });
  };

  const onHardDelete = async (id: string) => {
    if (!confirm("Permanently delete this record? This cannot be undone.")) return;
    const { error } = await hardDelete(table, id);
    if (error) return toast.error(error.message);
    toast.success("Permanently deleted");
    qc.invalidateQueries({ queryKey: ["trash", table] });
  };

  if (isLoading) return <p className="text-sm text-muted-foreground py-4">Loading…</p>;
  if (!data || data.length === 0) return <p className="text-sm text-muted-foreground py-4">Trash is empty.</p>;

  return (
    <div className="rounded-md border border-border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {cols.map((c) => <TableHead key={c.field}>{c.label}</TableHead>)}
            <TableHead>Deleted</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow key={(row as { id: string }).id}>
              {cols.map((c) => <TableCell key={c.field}>{String((row as Record<string, unknown>)[c.field] ?? "—")}</TableCell>)}
              <TableCell className="text-xs text-muted-foreground">
                {new Date((row as { deleted_at: string }).deleted_at).toLocaleString()}
              </TableCell>
              <TableCell className="text-right space-x-2">
                <Button size="sm" variant="outline" onClick={() => onRestore((row as { id: string }).id)}>
                  <Undo2 className="h-3 w-3 mr-1" /> Restore
                </Button>
                {isSuper && (
                  <Button size="sm" variant="destructive" onClick={() => onHardDelete((row as { id: string }).id)}>
                    <Trash2 className="h-3 w-3 mr-1" /> Delete forever
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
