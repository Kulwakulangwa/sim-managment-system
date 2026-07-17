import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/bootstrap-super-admin")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("x-bootstrap-token");
        const expected = process.env.BOOTSTRAP_TOKEN;
        if (!expected || token !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        const email = "kulwakulangwa@gmail.com";
        const password = "Jordan2024==";
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Check existing super admin
        const { data: existingRoles } = await supabaseAdmin
          .from("user_roles")
          .select("user_id")
          .eq("role", "super_admin")
          .limit(1);
        if (existingRoles && existingRoles.length > 0) {
          return Response.json({ ok: true, message: "Super admin already exists" });
        }

        // Try to find user by email via listUsers
        let userId: string | null = null;
        const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
        const found = list?.users?.find((u) => u.email?.toLowerCase() === email);
        if (found) {
          userId = found.id;
          await supabaseAdmin.auth.admin.updateUserById(userId, { password, email_confirm: true });
        } else {
          const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: "Super Admin" },
          });
          if (error) return new Response(error.message, { status: 500 });
          userId = created.user!.id;
        }

        await supabaseAdmin.from("profiles").upsert({ id: userId, full_name: "Super Admin" });
        const { error: e2 } = await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: userId, role: "super_admin", shop_id: null });
        if (e2 && !e2.message.includes("duplicate")) {
          return new Response(e2.message, { status: 500 });
        }
        return Response.json({ ok: true, user_id: userId });
      },
    },
  },
});