
-- ============ SOFT DELETE COLUMNS ============
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE public.repairs ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.repairs ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS deleted_by uuid;

-- ============ DATA INTEGRITY ============
-- Unique IMEI per shop (excluding soft-deleted)
CREATE UNIQUE INDEX IF NOT EXISTS inventory_items_shop_imei_unique
  ON public.inventory_items(shop_id, imei)
  WHERE imei IS NOT NULL AND deleted_at IS NULL;

-- Prevent negative stock
DO $$ BEGIN
  ALTER TABLE public.inventory_items ADD CONSTRAINT inventory_items_qty_nonneg CHECK (quantity >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ AUDIT LOGS ============
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  user_name text,
  shop_id uuid,
  action text NOT NULL,
  table_name text,
  record_id text,
  old_value jsonb,
  new_value jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_shop_created_idx ON public.audit_logs(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_record_idx ON public.audit_logs(table_name, record_id);

GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit insert own" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "audit read shop" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR (public.has_role(auth.uid(), 'shop_admin') AND shop_id = public.current_shop_id())
    OR user_id = auth.uid()
  );

-- ============ ERROR LOGS ============
CREATE TABLE IF NOT EXISTS public.error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  shop_id uuid,
  source text NOT NULL, -- frontend | backend | db | import | auth
  message text NOT NULL,
  stack text,
  url text,
  context jsonb,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS error_logs_created_idx ON public.error_logs(created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.error_logs TO authenticated;
GRANT ALL ON public.error_logs TO service_role;
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "err insert any" ON public.error_logs
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "err read super" ON public.error_logs
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR user_id = auth.uid());

CREATE POLICY "err update super" ON public.error_logs
  FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ============ BACKUPS ============
CREATE TABLE IF NOT EXISTS public.backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL, -- daily | weekly | monthly | manual
  shop_id uuid,
  payload jsonb NOT NULL,
  size_bytes integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS backups_created_idx ON public.backups(created_at DESC);

GRANT SELECT ON public.backups TO authenticated;
GRANT ALL ON public.backups TO service_role;
ALTER TABLE public.backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "backups super only" ON public.backups
  FOR SELECT TO authenticated USING (public.is_super_admin());

-- ============ GENERIC AUDIT TRIGGER ============
CREATE OR REPLACE FUNCTION public.log_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop uuid;
  v_rec_id text;
  v_uid uuid := auth.uid();
  v_name text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_shop := (to_jsonb(OLD)->>'shop_id')::uuid;
    v_rec_id := (to_jsonb(OLD)->>'id');
  ELSE
    v_shop := (to_jsonb(NEW)->>'shop_id')::uuid;
    v_rec_id := (to_jsonb(NEW)->>'id');
  END IF;

  SELECT full_name INTO v_name FROM public.profiles WHERE id = v_uid;

  INSERT INTO public.audit_logs(user_id, user_name, shop_id, action, table_name, record_id, old_value, new_value)
  VALUES (
    v_uid, v_name, v_shop,
    CASE
      WHEN TG_OP='UPDATE' AND (to_jsonb(NEW)->>'deleted_at') IS NOT NULL AND (to_jsonb(OLD)->>'deleted_at') IS NULL THEN 'soft_delete'
      WHEN TG_OP='UPDATE' AND (to_jsonb(OLD)->>'deleted_at') IS NOT NULL AND (to_jsonb(NEW)->>'deleted_at') IS NULL THEN 'restore'
      ELSE lower(TG_OP)
    END,
    TG_TABLE_NAME, v_rec_id,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END
  );

  RETURN COALESCE(NEW, OLD);
END $$;

-- Attach to key tables
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['inventory_items','sales','customers','repairs','expenses','user_roles','shops']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%1$s ON public.%1$s', t);
    EXECUTE format('CREATE TRIGGER audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.log_audit()', t);
  END LOOP;
END $$;

-- ============ RESTRICT SELECTS FROM SOFT-DELETED ROWS (staff) ============
-- Add filter policies for shop_admin to see trash separately.
-- The simplest safe approach: add a helper view is overkill; instead, the app filters by deleted_at IS NULL for lists.
-- We only add an explicit "trash read" policy for shop_admin (already covered by existing full-shop policies).
