import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useMyRole } from "@/hooks/use-role";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/users")({ component: UsersPage });

type Role = "owner" | "manager" | "cashier";

function UsersPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data: myRole } = useMyRole();

  const { data: users = [] } = useQuery({
    queryKey: ["users-list"],
    queryFn: async () => {
      const { data: profiles } = await supabase.from("profiles").select("*").order("created_at");
      const { data: roles } = await supabase.from("user_roles").select("*");
      return (profiles ?? []).map((p) => {
        const userRoles = (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role);
        const role: Role = userRoles.includes("owner") ? "owner" : userRoles.includes("manager") ? "manager" : "cashier";
        return { ...p, role };
      });
    },
  });

  const changeRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: Role }) => {
      await supabase.from("user_roles").delete().eq("user_id", userId);
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users-list"] }); toast.success(t("save")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const canEdit = myRole === "owner";

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t("users")}</h1>
      <Card className="p-4 overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>{t("fullName")}</TableHead><TableHead>{t("phone")}</TableHead><TableHead>{t("role")}</TableHead></TableRow></TableHeader>
          <TableBody>
            {users.length === 0 && <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">{t("empty")}</TableCell></TableRow>}
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.full_name}</TableCell>
                <TableCell>{u.phone ?? "—"}</TableCell>
                <TableCell>
                  {canEdit ? (
                    <Select value={u.role} onValueChange={(v) => changeRole.mutate({ userId: u.id, role: v as Role })}>
                      <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">{t("owner")}</SelectItem>
                        <SelectItem value="manager">{t("manager")}</SelectItem>
                        <SelectItem value="cashier">{t("cashier")}</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="capitalize">{u.role}</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
