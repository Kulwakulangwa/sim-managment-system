
# Multi-Tenant SaaS Conversion Plan

Convert the Phone Shop Management System into a multi-tenant SaaS where one Super Admin manages many shops, each shop's data is isolated via `shop_id` + RLS, and public registration is fully removed.

## 1. Architecture Overview

- **Model**: Shared database, shared schema, `shop_id` discriminator on every business table.
- **Auth**: Supabase Auth retained. Public sign-up disabled. Accounts are created only by Super Admin (for Shop Admins) or Shop Admin (for staff) via privileged server functions using `supabaseAdmin`.
- **Isolation**: Enforced at the database level with RLS policies driven by a `SECURITY DEFINER` helper `current_shop_id()` and role checks.
- **Roles** (replaces current `owner|manager|cashier`):
  - `super_admin` — platform owner, no `shop_id`, sees everything.
  - `shop_admin` — one per shop (multiple allowed), manages that shop.
  - `cashier` — sales/POS only.
  - `salesperson` — sales/POS (same surface as cashier, distinguished for reporting).
  - `technician` — repairs only.

## 2. Database Migration Plan

### 2.1 New table
```
shops (
  id uuid pk,
  name text not null,
  phone text, address text, region text,
  status text check (status in ('active','suspended')) default 'active',
  created_at, updated_at
)
```

### 2.2 Enum changes
- Extend `app_role`: add `super_admin`, `shop_admin`, `salesperson`, `technician`. Keep `owner`/`manager`/`cashier` temporarily for migration; drop `owner`/`manager` after remap.
- Remap existing rows: first user with `owner` → `super_admin` (kulwakulangwa@gmail.com); other `owner` → `shop_admin`; `manager` → `shop_admin`; `cashier` stays.

### 2.3 Add `shop_id` to business tables
Add `shop_id uuid not null references shops(id) on delete cascade` to:
`inventory_items`, `customers`, `sales`, `installment_plans`, `installment_payments`, `warranties`, `warranty_claims`, `repairs`, `expenses`.

Also add `shop_id uuid` (nullable — null = super admin) to `user_roles`. A user gets one role row per shop (super admin: null shop_id).

Indexes: `create index on <table>(shop_id)` for each.

### 2.4 Bootstrap data
- Create one default shop "Default Shop".
- Backfill `shop_id` on all existing rows to that default shop.
- Alter columns to `NOT NULL` after backfill.

### 2.5 Helper functions (SECURITY DEFINER)
```
current_shop_id() -> uuid          -- reads user_roles for auth.uid()
is_super_admin() -> boolean
has_shop_role(role app_role) -> boolean
user_shop_id(uid) -> uuid
```

### 2.6 RLS policies (pattern per table)
```
USING (
  public.is_super_admin()
  OR shop_id = public.current_shop_id()
)
WITH CHECK (same)
```
Role-scoped write restrictions layered on top:
- `expenses`, `reports` data: only `shop_admin` writes.
- `repairs`: `shop_admin` + `technician` write; cashier/salesperson read-only.
- `sales`: `shop_admin`, `cashier`, `salesperson` insert; `shop_admin` update/delete.
- `inventory_items`, `customers`, `warranties`, `installments`: `shop_admin` full; others read.

`shops` table: super admin full; shop members SELECT their own row only.
`user_roles`: super admin full; shop admin SELECT/INSERT/DELETE where `shop_id = current_shop_id()` and role ∈ {cashier, salesperson, technician}.
`profiles`: readable by same-shop users and super admin.

### 2.7 Trigger updates
- Remove auto-role assignment in `handle_new_user` (no more "first user = owner"). Profile row still auto-created; role rows are inserted explicitly by admin flows.
- `handle_sale_stock` unchanged (shop_id inherited from inventory row; add assertion that `sales.shop_id = inventory.shop_id`).

## 3. Super Admin Bootstrap

One-time seed migration:
1. Ensure user with email `kulwakulangwa@gmail.com` exists in `auth.users`; if not, create via `supabaseAdmin.auth.admin.createUser` in a server function ran once at deploy (or SQL insert into user_roles when the user signs in for the first time). Because we cannot create auth users from pure SQL reliably, we ship a one-shot server route `/api/public/bootstrap-super-admin` protected by a `BOOTSTRAP_TOKEN` secret that creates the user with password `Jordan2024==` and inserts `(user_id, role='super_admin', shop_id=null)`. After running once, the endpoint no-ops.
2. Alternative (simpler): create the auth user manually via `supabaseAdmin` inside a migration-adjacent server function invoked from the app on first load if no super_admin exists.

Chosen: **bootstrap server route with token secret**, called once by us.

## 4. Server Functions (new / changed)

New `.functions.ts` files under `src/lib/`:
- `shops.functions.ts`: `listShops`, `createShop`, `updateShop`, `suspendShop`, `deleteShop` (super admin only, verified server-side).
- `admin-users.functions.ts`: `createShopAdmin(shopId, email, password, fullName)`, `createStaff(email, password, fullName, role)` — uses `supabaseAdmin` after verifying caller.
- `platform-stats.functions.ts`: aggregate KPIs across all shops (super admin).
- Existing shop-scoped fetches keep using `requireSupabaseAuth`; RLS handles isolation, no code changes to WHERE clauses needed.

Authorization pattern in every privileged fn:
```
.middleware([requireSupabaseAuth])
.handler(async ({ context }) => {
  const { data } = await context.supabase.from('user_roles').select('role,shop_id').eq('user_id', context.userId);
  // verify super_admin OR shop_admin for shopId
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  // privileged action
})
```

## 5. Frontend Changes

### 5.1 Remove
- `src/routes/auth.tsx` sign-up tab and any signup UI. Replace with login-only page.
- Public-registration copy in i18n.

### 5.2 New routes
- `src/routes/_authenticated/_super/` pathless layout gating `super_admin` role:
  - `shops.tsx` — list/create/edit/suspend/delete shops.
  - `shops.$id.tsx` — shop detail + create Shop Admin.
  - `platform.tsx` — platform-wide dashboard.
- `src/routes/_authenticated/staff.tsx` — Shop Admin creates cashier/salesperson/technician (replaces current `users.tsx` role management).

### 5.3 Role-based sidebar
Update `_authenticated/route.tsx` nav map:
- `super_admin`: Platform Dashboard, Shops, (optionally impersonate).
- `shop_admin`: full shop module set.
- `cashier` / `salesperson`: Dashboard, POS, Sales, Customers.
- `technician`: Dashboard, Repairs.

### 5.4 Hook updates
- `useMyRole` returns `{ role, shopId, isSuperAdmin }`.
- Rename `AppRole` type; update all consumers.

### 5.5 Dashboards
- `dashboard.tsx`: branch on role — super admin sees platform stats; others see shop stats (already shop-filtered via RLS).

## 6. i18n & Terminology

Add EN/SW strings for: super admin, shop admin, salesperson, technician, shops, suspend, activate, platform. Remove "sign up" strings.

## 7. Migration Execution Order

1. **DB migration 1**: create `shops`, extend `app_role`, add `shop_id` columns nullable, add helper functions, seed default shop, backfill `shop_id`, set NOT NULL, drop old RLS policies, add new RLS policies, update `handle_new_user`, remap existing roles.
2. **Bootstrap super admin** via one-shot server route + `BOOTSTRAP_TOKEN` secret; invoke once.
3. **Frontend refactor**: role hook, sidebar, remove signup, add super admin routes, add staff creation route.
4. **QA**: sign in as super admin, create shop + shop admin, sign in as shop admin, create staff, verify data isolation across two shops.

## 8. Files Touched (summary)

- `supabase/migrations/*` — one big migration (section 2).
- `src/lib/shops.functions.ts`, `src/lib/admin-users.functions.ts`, `src/lib/platform-stats.functions.ts` — new.
- `src/routes/api/public/bootstrap-super-admin.ts` — new, token-gated.
- `src/routes/auth.tsx` — strip signup.
- `src/routes/_authenticated/route.tsx` — role-based nav.
- `src/routes/_authenticated/_super/*` — new super admin routes.
- `src/routes/_authenticated/staff.tsx` — replaces `users.tsx`.
- `src/routes/_authenticated/dashboard.tsx` — branch by role.
- `src/hooks/use-role.ts` — return role + shopId.
- `src/lib/i18n.tsx` — new strings.

## 9. Security Notes

- Super admin bootstrap password `Jordan2024==` should be rotated after first login; we'll surface a "change password" prompt.
- `supabaseAdmin` (service role) is used only inside server function handlers guarded by role checks.
- All shop-scoped tables covered by RLS; no client-side filtering is trusted.
- No public sign-up — server route for shop admin creation requires super_admin caller; staff creation requires shop_admin caller.

Approve this plan and I'll execute the migration and code changes in order.
