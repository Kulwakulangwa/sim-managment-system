import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

type StaffRole = "cashier" | "salesperson" | "technician" | "shop_admin";

// ──────────────────────────────────────────────────────────────
// 1. Shop management (Super Admin only)
// ──────────────────────────────────────────────────────────────

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
    const patch: { name?: string; phone?: string | null; address?: string | null; region?: string | null; status?: "active" | "suspended" } = {};
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

// ──────────────────────────────────────────────────────────────
// 2. Shop Admin management (Super Admin only)
// ──────────────────────────────────────────────────────────────

export const createShopAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { shop_id: string; email: string; password: string; full_name: string; phone?: string; validity_months?: number }) =>
    z.object({
      shop_id: z.string().uuid(),
      email: z.string().email(),
      password: z.string().min(6),
      full_name: z.string().min(1),
      phone: z.string().optional(),
      validity_months: z.number().int().min(1).default(12),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    if (!(roles ?? []).some((r) => r.role === "super_admin")) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error: e1 } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name, phone: data.phone ?? null },
    });
    if (e1) throw new Error(e1.message);
    const uid = created.user!.id;

    // Store email in profiles
    await supabaseAdmin.from("profiles").upsert({
      id: uid,
      full_name: data.full_name,
      phone: data.phone ?? null,
      email: data.email,
    });

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + data.validity_months);

    const { error: e2 } = await supabaseAdmin.from("user_roles").insert({
      user_id: uid,
      role: "shop_admin",
      shop_id: data.shop_id,
      expires_at: expiresAt.toISOString(),
    });
    if (e2) throw new Error(e2.message);
    return { user_id: uid };
  });

export const resetShopAdminPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; new_password: string }) =>
    z.object({ user_id: z.string().uuid(), new_password: z.string().min(6) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    if (!(roles ?? []).some((r) => r.role === "super_admin")) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, { password: data.new_password });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const extendShopAdminExpiration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; additional_months: number }) =>
    z.object({ user_id: z.string().uuid(), additional_months: z.number().int().min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    if (!(roles ?? []).some((r) => r.role === "super_admin")) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: current, error: fetchError } = await supabaseAdmin
      .from("user_roles")
      .select("expires_at")
      .eq("user_id", data.user_id)
      .single();
    if (fetchError || !current) throw new Error("User not found");

    const newExpiry = new Date(current.expires_at || new Date());
    newExpiry.setMonth(newExpiry.getMonth() + data.additional_months);

    const { error } = await supabaseAdmin
      .from("user_roles")
      .update({ expires_at: newExpiry.toISOString() })
      .eq("user_id", data.user_id);

    if (error) throw new Error(error.message);
    return { ok: true, new_expiry: newExpiry };
  });

// ─── Suspend Shop Admin (Super Admin only) ────────────────
export const suspendShopAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string }) =>
    z.object({ user_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    console.log("[suspendShopAdmin] Called with user_id:", data.user_id);

    // Check super_admin
    const { data: roles } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    if (!(roles ?? []).some((r) => r.role === "super_admin")) {
      console.error("[suspendShopAdmin] Forbidden – caller is not super_admin");
      throw new Error("Forbidden");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const past = new Date();
    past.setDate(past.getDate() - 1);
    const pastISO = past.toISOString();
    console.log("[suspendShopAdmin] Setting expires_at to:", pastISO);

    const { data: updated, error } = await supabaseAdmin
      .from("user_roles")
      .update({ expires_at: pastISO })
      .eq("user_id", data.user_id)
      .eq("role", "shop_admin")
      .select();

    if (error) {
      console.error("[suspendShopAdmin] Update error:", error);
      throw new Error(error.message);
    }

    console.log("[suspendShopAdmin] Updated rows:", updated);
    return { ok: true, updated };
  });

// ─── Activate Shop Admin (Super Admin only) ────────────────
export const activateShopAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; months?: number }) =>
    z.object({ user_id: z.string().uuid(), months: z.number().int().min(1).default(12) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    console.log("[activateShopAdmin] Called with user_id:", data.user_id, "months:", data.months);

    const { data: roles } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    if (!(roles ?? []).some((r) => r.role === "super_admin")) {
      console.error("[activateShopAdmin] Forbidden – caller is not super_admin");
      throw new Error("Forbidden");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const future = new Date();
    future.setMonth(future.getMonth() + data.months);
    const futureISO = future.toISOString();
    console.log("[activateShopAdmin] Setting expires_at to:", futureISO);

    const { data: updated, error } = await supabaseAdmin
      .from("user_roles")
      .update({ expires_at: futureISO })
      .eq("user_id", data.user_id)
      .eq("role", "shop_admin")
      .select();

    if (error) {
      console.error("[activateShopAdmin] Update error:", error);
      throw new Error(error.message);
    }

    console.log("[activateShopAdmin] Updated rows:", updated);
    return { ok: true, updated };
  });

// ─── Return Winga Sale (restore inventory) ──────────────────
export const returnWingaSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { sale_id: string }) =>
    z.object({ sale_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    console.log("[returnWingaSale] Called with sale_id:", data.sale_id);

    // Get the inventory_item_id from the sale
    const { data: sale, error: saleError } = await context.supabase
      .from("sales")
      .select("inventory_item_id")
      .eq("id", data.sale_id)
      .single();

    if (saleError) {
      console.error("[returnWingaSale] Sale fetch error:", saleError);
      throw new Error("Sale not found");
    }
    if (!sale) throw new Error("Sale not found");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Restore inventory
    const { error: invError } = await supabaseAdmin
      .from("inventory_items")
      .update({ quantity: 1, deleted_at: null })
      .eq("id", sale.inventory_item_id);

    if (invError) {
      console.error("[returnWingaSale] Inventory update error:", invError);
      throw new Error(invError.message);
    }

    // Mark sale as returned
    const { error: retError } = await supabaseAdmin
      .from("sales")
      .update({ winga_returned: true })
      .eq("id", data.sale_id);

    if (retError) {
      console.error("[returnWingaSale] Sale update error:", retError);
      throw new Error(retError.message);
    }

    console.log("[returnWingaSale] Return successful for sale:", data.sale_id);
    return { ok: true };
  });

// ──────────────────────────────────────────────────────────────
// 3. Staff management (Shop Admin / Super Admin)
// ──────────────────────────────────────────────────────────────

export const createStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string; password: string; full_name: string; phone?: string; role: StaffRole }) =>
    z.object({
      email: z.string().email(),
      password: z.string().min(6),
      full_name: z.string().min(1),
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
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name, phone: data.phone ?? null },
    });
    if (e1) throw new Error(e1.message);
    const uid = created.user!.id;
    await supabaseAdmin.from("profiles").upsert({
      id: uid,
      full_name: data.full_name,
      phone: data.phone ?? null,
      email: data.email,
    });
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
