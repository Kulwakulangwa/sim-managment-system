// Create Shop Admin — Super Admin only, with configurable expiry
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

    // Create auth user
    const { data: created, error: e1 } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name, phone: data.phone ?? null },
    });
    if (e1) throw new Error(e1.message);
    const uid = created.user!.id;

    // Insert profile
    await supabaseAdmin.from("profiles").upsert({ id: uid, full_name: data.full_name, phone: data.phone ?? null });

    // Set expiration based on validity_months
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + data.validity_months);

    // Insert user role with expiry
    const { error: e2 } = await supabaseAdmin.from("user_roles").insert({
      user_id: uid,
      role: "shop_admin",
      shop_id: data.shop_id,
      expires_at: expiresAt.toISOString(),
    });
    if (e2) throw new Error(e2.message);
    return { user_id: uid };
  });
