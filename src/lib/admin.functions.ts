import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

type StaffRole = "cashier" | "salesperson" | "technician" | "shop_admin";

// Create a shop (Super Admin only)
export const createShop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string; phone?: string; address?: string; region?: string }) =>
    z.object({ name: z.string().min(1), phone: z.string().optional(), address: z.string().optional(), region: z.string().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    if (!(roles ?? []).some((r) => r.role === "super_admin")) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: shop, error } = await supabaseAdmin.from("shops").insert({ name: data.name, phone: data.phone ?? null, address: data.address ?? null, region: data.region ?? null }).select("*").single();
    if (error) throw new Error(error.message);
    return shop;
  });

export const updateShop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; name?: string; phone?: string | null; address?: string | null; region?: string | null; status?: "active" | "suspended" }) => d)
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    if (!(roles ?? []).some((r) => r.role === "super_admin")) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.phone !== undefined) patch.phone = data.phone;
    if (data.address !== undefined) patch.address = data.address;
    if (data.region !== undefined) patch.region = data.region;
    if (data.status !== undefined) patch.status = data.status;
    const { error } = await supabaseAdmin.from("shops").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteShop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    if (!(roles ?? []).some((r) => r.role === "super_admin")) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("shops").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Create Shop Admin — Super Admin only
export const createShopAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { shop_id: string; email: string; password: string; full_name: string; phone?: string }) =>
    z.object({ shop_id: z.string().uuid(), email: z.string().email(), password: z.string().min(6), full_name: z.string().min(1), phone: z.string().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    if (!(roles ?? []).some((r) => r.role === "super_admin")) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error: e1 } = await supabaseAdmin.auth.admin.createUser({
      email: data.email, password: data.password, email_confirm: true,
      user_metadata: { full_name: data.full_name, phone: data.phone ?? null },
    });
    if (e1) throw new Error(e1.message);
    const uid = created.user!.id;
    await supabaseAdmin.from("profiles").upsert({ id: uid, full_name: data.full_name, phone: data.phone ?? null });
    const { error: e2 } = await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: "shop_admin", shop_id: data.shop_id });
    if (e2) throw new Error(e2.message);
    return { user_id: uid };
  });

// Create staff — Shop Admin only, in their shop
export const createStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string; password: string; full_name: string; phone?: string; role: StaffRole }) =>
    z.object({
      email: z.string().email(), password: z.string().min(6), full_name: z.string().min(1),
      phone: z.string().optional(),
      role: z.enum(["cashier", "salesperson", "technician", "shop_admin"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase.from("user_roles").select("role, shop_id").eq("user_id", context.userId);
    const admin = (roles ?? []).find((r) => r.role === "shop_admin");
    if (!admin || !admin.shop_id) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error: e1 } = await supabaseAdmin.auth.admin.createUser({
      email: data.email, password: data.password, email_confirm: true,
      user_metadata: { full_name: data.full_name, phone: data.phone ?? null },
    });
    if (e1) throw new Error(e1.message);
    const uid = created.user!.id;
    await supabaseAdmin.from("profiles").upsert({ id: uid, full_name: data.full_name, phone: data.phone ?? null });
    const { error: e2 } = await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: data.role, shop_id: admin.shop_id });
    if (e2) throw new Error(e2.message);
    return { user_id: uid };
  });

export const deleteStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase.from("user_roles").select("role, shop_id").eq("user_id", context.userId);
    const admin = (roles ?? []).find((r) => r.role === "shop_admin");
    const isSuper = (roles ?? []).some((r) => r.role === "super_admin");
    if (!admin && !isSuper) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!isSuper && admin) {
      const { data: target } = await supabaseAdmin.from("user_roles").select("shop_id").eq("user_id", data.user_id).single();
      if (!target || target.shop_id !== admin.shop_id) throw new Error("Forbidden");
    }
    await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    return { ok: true };
  });
