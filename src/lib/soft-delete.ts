import { supabase } from "@/integrations/supabase/client";

export type SoftTable =
  | "inventory_items"
  | "sales"
  | "customers"
  | "repairs"
  | "expenses";

export async function softDelete(table: SoftTable, id: string) {
  const { data: user } = await supabase.auth.getUser();
  return supabase
    .from(table)
    .update({ deleted_at: new Date().toISOString(), deleted_by: user.user?.id ?? null })
    .eq("id", id);
}

export async function restoreRow(table: SoftTable, id: string) {
  return supabase.from(table).update({ deleted_at: null, deleted_by: null }).eq("id", id);
}

export async function hardDelete(table: SoftTable, id: string) {
  return supabase.from(table).delete().eq("id", id);
}
