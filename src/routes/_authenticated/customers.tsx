import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useShopId } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/customers")({ component: CustomersPage });

function CustomersPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const shopId = useShopId();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", phone: "" });

  const { data: rows = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => (await supabase.from("customers").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!form.full_name || !form.phone) throw new Error("Missing");
      if (!shopId) throw new Error("No shop context");
      const { error } = await supabase.from("customers").insert({ ...form, shop_id: shopId });
      if (error) throw error;
    },

    onSuccess: () => { qc.invalidateQueries({ queryKey: ["customers"] }); setOpen(false); setForm({ full_name: "", phone: "" }); toast.success(t("save")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = rows.filter((r) => !q || `${r.full_name} ${r.phone}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("customers")}</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />{t("add")}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("customer")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>{t("fullName")}</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
              <div><Label>{t("phone")}</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>{t("cancel")}</Button>
              <Button onClick={() => add.mutate()} disabled={add.isPending}>{t("save")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Card className="p-4">
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder={t("search")} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>{t("fullName")}</TableHead><TableHead>{t("phone")}</TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 && <TableRow><TableCell colSpan={2} className="text-center py-6 text-muted-foreground">{t("empty")}</TableCell></TableRow>}
            {filtered.map((c) => <TableRow key={c.id}><TableCell className="font-medium">{c.full_name}</TableCell><TableCell>{c.phone}</TableCell></TableRow>)}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
