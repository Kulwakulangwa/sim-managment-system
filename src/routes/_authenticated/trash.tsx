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
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

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
  const { theme } = useTheme();
  const isSuper = role?.isSuperAdmin ?? false;

  return (
    <div className={cn(
      "space-y-6 -m-4 sm:-m-6 p-4 sm:p-6 min-h-full rounded-3xl",
      theme === "dark" ? "bg-[#0f0a12]" : "bg-[#F7F5FA]"
    )}>
      <div>
        <h1 className={cn(
          "text-2xl font-bold",
          theme === "dark" ? "text-white" : "text-slate-800"
        )}>
          Trash
        </h1>
        <p className={cn(
          "text-sm",
          theme === "dark" ? "text-slate-400" : "text-muted-foreground"
        )}>
          Restore records deleted by mistake. Items stay here until permanently removed.
        </p>
      </div>

      <Tabs defaultValue="inventory_items">
        <TabsList className={cn(
          "flex-wrap",
          theme === "dark" ? "bg-slate-800/50 border-slate-700" : ""
        )}>
          {TABS.map((t) => (
            <TabsTrigger
              key={t.key}
              value={t.key}
              className={cn(
                theme === "dark" && "data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-300"
              )}
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map((t) => (
          <TabsContent key={t.key} value={t.key}>
            <TrashTable table={t.key} cols={t.cols} isSuper={isSuper} theme={theme} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function TrashTable({
  table,
  cols,
  isSuper,
  theme,
}: {
  table: SoftTable;
  cols: { field: string; label: string }[];
  isSuper: boolean;
  theme: "light" | "dark";
}) {
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

  if (isLoading) {
    return <p className={cn("text-sm py-4", theme === "dark" ? "text-slate-400" : "text-muted-foreground")}>Loading…</p>;
  }
  if (!data || data.length === 0) {
    return <p className={cn("text-sm py-4", theme === "dark" ? "text-slate-400" : "text-muted-foreground")}>Trash is empty.</p>;
  }

  return (
    <div className={cn(
      "rounded-md border overflow-x-auto",
      theme === "dark" ? "border-slate-700" : "border-border"
    )}>
      <Table>
        <TableHeader>
          <TableRow className={theme === "dark" ? "border-slate-700" : ""}>
            {cols.map((c) => (
              <TableHead key={c.field} className={theme === "dark" ? "text-slate-300" : ""}>
                {c.label}
              </TableHead>
            ))}
            <TableHead className={theme === "dark" ? "text-slate-300" : ""}>Deleted</TableHead>
            <TableHead className={cn("text-right", theme === "dark" ? "text-slate-300" : "")}>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => {
            const id = (row as { id: string }).id;
            return (
              <TableRow
                key={id}
                className={cn(
                  "transition",
                  theme === "dark"
                    ? "border-slate-700 hover:bg-slate-700/50"
                    : "hover:bg-muted/50"
                )}
              >
                {cols.map((c) => (
                  <TableCell key={c.field} className={theme === "dark" ? "text-slate-300" : ""}>
                    {String((row as Record<string, unknown>)[c.field] ?? "—")}
                  </TableCell>
                ))}
                <TableCell className={cn(
                  "text-xs",
                  theme === "dark" ? "text-slate-400" : "text-muted-foreground"
                )}>
                  {new Date((row as { deleted_at: string }).deleted_at).toLocaleString()}
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onRestore(id)}
                    className={cn(
                      theme === "dark" && "border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
                    )}
                  >
                    <Undo2 className="h-3 w-3 mr-1" /> Restore
                  </Button>
                  {isSuper && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => onHardDelete(id)}
                      className={theme === "dark" ? "bg-rose-600 hover:bg-rose-700 text-white" : ""}
                    >
                      <Trash2 className="h-3 w-3 mr-1" /> Delete forever
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
