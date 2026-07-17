
-- =========================================================
-- 1. SHOPS TABLE
-- =========================================================
CREATE TABLE public.shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  address text,
  region text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shops TO authenticated;
GRANT ALL ON public.shops TO service_role;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER shops_updated_at BEFORE UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default shop for backfill
INSERT INTO public.shops (id, name) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Default Shop');

-- =========================================================
-- 2. REPLACE app_role ENUM
-- =========================================================
-- Drop dependent policies/functions first
DROP POLICY IF EXISTS "owners manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "roles readable by authenticated" ON public.user_roles;
DROP POLICY IF EXISTS "sales manager+ update" ON public.sales;
DROP POLICY IF EXISTS "sales owner delete" ON public.sales;
DROP POLICY IF EXISTS "inventory auth all" ON public.inventory_items;
DROP POLICY IF EXISTS "sales auth insert" ON public.sales;
DROP POLICY IF EXISTS "sales auth read" ON public.sales;
DROP POLICY IF EXISTS "profiles readable by authenticated" ON public.profiles;
DROP POLICY IF EXISTS "profiles self insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles self update" ON public.profiles;
-- Drop remaining policies on business tables (unknown names) by discovering
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname='public'
      AND tablename IN ('customers','expenses','installment_plans','installment_payments','warranties','warranty_claims','repairs','sales','inventory_items','profiles','user_roles')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS public.get_my_role();
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);

ALTER TYPE public.app_role RENAME TO app_role_old;
CREATE TYPE public.app_role AS ENUM ('super_admin','shop_admin','cashier','salesperson','technician');

-- Migrate user_roles.role column
ALTER TABLE public.user_roles ADD COLUMN role_new public.app_role;
UPDATE public.user_roles SET role_new = CASE role::text
  WHEN 'owner' THEN 'shop_admin'::public.app_role
  WHEN 'manager' THEN 'shop_admin'::public.app_role
  WHEN 'cashier' THEN 'cashier'::public.app_role
END;
ALTER TABLE public.user_roles DROP COLUMN role;
ALTER TABLE public.user_roles RENAME COLUMN role_new TO role;
ALTER TABLE public.user_roles ALTER COLUMN role SET NOT NULL;

-- Promote the very first user (if any) to super_admin
WITH first_user AS (
  SELECT user_id FROM public.user_roles
  ORDER BY (SELECT created_at FROM auth.users u WHERE u.id = user_roles.user_id) ASC
  LIMIT 1
)
UPDATE public.user_roles SET role = 'super_admin'
WHERE user_id IN (SELECT user_id FROM first_user);

DROP TYPE public.app_role_old;

-- =========================================================
-- 3. ADD shop_id TO USER_ROLES + BUSINESS TABLES
-- =========================================================
ALTER TABLE public.user_roles ADD COLUMN shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE;
-- Non-super-admin users go to Default Shop
UPDATE public.user_roles SET shop_id = '00000000-0000-0000-0000-000000000001'
WHERE role <> 'super_admin';
-- Uniqueness: one role per (user, shop). Drop old unique on (user_id, role) and replace.
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;
CREATE UNIQUE INDEX user_roles_user_shop_uidx ON public.user_roles (user_id, COALESCE(shop_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX user_roles_shop_idx ON public.user_roles (shop_id);

-- Business tables: add shop_id
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['inventory_items','customers','sales','installment_plans','installment_payments','warranties','warranty_claims','repairs','expenses'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE', t);
    EXECUTE format('UPDATE public.%I SET shop_id = ''00000000-0000-0000-0000-000000000001''', t);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN shop_id SET NOT NULL', t);
    EXECUTE format('CREATE INDEX %I ON public.%I (shop_id)', t || '_shop_idx', t);
  END LOOP;
END $$;

-- =========================================================
-- 4. HELPER FUNCTIONS
-- =========================================================
CREATE OR REPLACE FUNCTION public.is_super_admin(_uid uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role = 'super_admin')
$$;

CREATE OR REPLACE FUNCTION public.current_shop_id(_uid uuid DEFAULT auth.uid())
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT shop_id FROM public.user_roles
   WHERE user_id = _uid AND role <> 'super_admin'
   LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.has_shop_role(_role public.app_role, _uid uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles
   WHERE user_id = auth.uid()
   ORDER BY CASE role
     WHEN 'super_admin' THEN 1
     WHEN 'shop_admin' THEN 2
     WHEN 'cashier' THEN 3
     WHEN 'salesperson' THEN 4
     WHEN 'technician' THEN 5 END
   LIMIT 1
$$;

-- Update handle_new_user: no auto role, just profile row
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    new.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END $$;

-- =========================================================
-- 5. RLS POLICIES
-- =========================================================

-- SHOPS
CREATE POLICY "shops super admin all" ON public.shops FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "shops member read own" ON public.shops FOR SELECT TO authenticated
  USING (id = public.current_shop_id());

-- USER_ROLES
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles super admin all" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "user_roles self read" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "user_roles shop_admin manage staff" ON public.user_roles FOR ALL TO authenticated
  USING (
    public.has_shop_role('shop_admin')
    AND shop_id = public.current_shop_id()
    AND role IN ('cashier','salesperson','technician')
  ) WITH CHECK (
    public.has_shop_role('shop_admin')
    AND shop_id = public.current_shop_id()
    AND role IN ('cashier','salesperson','technician')
  );
CREATE POLICY "user_roles shop members read same shop" ON public.user_roles FOR SELECT TO authenticated
  USING (shop_id IS NOT NULL AND shop_id = public.current_shop_id());

-- PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles super admin all" ON public.profiles FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "profiles self manage" ON public.profiles FOR ALL TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles same shop read" ON public.profiles FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = profiles.id
      AND ur.shop_id = public.current_shop_id()
  ));

-- Helper macro-like block for tenant tables
-- Pattern: super_admin all; shop members full CRUD scoped to their shop.
-- Fine-grained role restrictions can be layered by app logic; RLS provides isolation.

-- INVENTORY_ITEMS: shop_admin full; others read
CREATE POLICY "inv super all" ON public.inventory_items FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "inv shop read" ON public.inventory_items FOR SELECT TO authenticated
  USING (shop_id = public.current_shop_id());
CREATE POLICY "inv shop_admin write" ON public.inventory_items FOR ALL TO authenticated
  USING (shop_id = public.current_shop_id() AND public.has_shop_role('shop_admin'))
  WITH CHECK (shop_id = public.current_shop_id() AND public.has_shop_role('shop_admin'));

-- CUSTOMERS: any shop member CRUD (needed for POS quick-add)
CREATE POLICY "cust super all" ON public.customers FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "cust shop all" ON public.customers FOR ALL TO authenticated
  USING (shop_id = public.current_shop_id())
  WITH CHECK (shop_id = public.current_shop_id());

-- SALES: shop_admin/cashier/salesperson insert+read; shop_admin update/delete
CREATE POLICY "sales super all" ON public.sales FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "sales shop read" ON public.sales FOR SELECT TO authenticated
  USING (shop_id = public.current_shop_id());
CREATE POLICY "sales shop insert" ON public.sales FOR INSERT TO authenticated
  WITH CHECK (
    shop_id = public.current_shop_id()
    AND (public.has_shop_role('shop_admin') OR public.has_shop_role('cashier') OR public.has_shop_role('salesperson'))
  );
CREATE POLICY "sales shop_admin update" ON public.sales FOR UPDATE TO authenticated
  USING (shop_id = public.current_shop_id() AND public.has_shop_role('shop_admin'))
  WITH CHECK (shop_id = public.current_shop_id() AND public.has_shop_role('shop_admin'));
CREATE POLICY "sales shop_admin delete" ON public.sales FOR DELETE TO authenticated
  USING (shop_id = public.current_shop_id() AND public.has_shop_role('shop_admin'));

-- INSTALLMENT_PLANS + PAYMENTS: shop members CRUD
CREATE POLICY "ip super all" ON public.installment_plans FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "ip shop all" ON public.installment_plans FOR ALL TO authenticated
  USING (shop_id = public.current_shop_id())
  WITH CHECK (shop_id = public.current_shop_id());

CREATE POLICY "ipay super all" ON public.installment_payments FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "ipay shop all" ON public.installment_payments FOR ALL TO authenticated
  USING (shop_id = public.current_shop_id())
  WITH CHECK (shop_id = public.current_shop_id());

-- WARRANTIES + CLAIMS
CREATE POLICY "war super all" ON public.warranties FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "war shop all" ON public.warranties FOR ALL TO authenticated
  USING (shop_id = public.current_shop_id())
  WITH CHECK (shop_id = public.current_shop_id());

CREATE POLICY "wc super all" ON public.warranty_claims FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "wc shop all" ON public.warranty_claims FOR ALL TO authenticated
  USING (shop_id = public.current_shop_id())
  WITH CHECK (shop_id = public.current_shop_id());

-- REPAIRS: shop_admin + technician write; others read
CREATE POLICY "rep super all" ON public.repairs FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "rep shop read" ON public.repairs FOR SELECT TO authenticated
  USING (shop_id = public.current_shop_id());
CREATE POLICY "rep shop write" ON public.repairs FOR ALL TO authenticated
  USING (
    shop_id = public.current_shop_id()
    AND (public.has_shop_role('shop_admin') OR public.has_shop_role('technician'))
  ) WITH CHECK (
    shop_id = public.current_shop_id()
    AND (public.has_shop_role('shop_admin') OR public.has_shop_role('technician'))
  );

-- EXPENSES: shop_admin only
CREATE POLICY "exp super all" ON public.expenses FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "exp shop_admin all" ON public.expenses FOR ALL TO authenticated
  USING (shop_id = public.current_shop_id() AND public.has_shop_role('shop_admin'))
  WITH CHECK (shop_id = public.current_shop_id() AND public.has_shop_role('shop_admin'));
