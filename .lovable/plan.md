
# Support-Reduction Overhaul

Goal: reduce support tickets by ~80% via self-service recovery, transparency, and error prevention. No new business features.

I will also verify the super admin login `kulwakulangwa@gmail.com / Jordan2024==` works and re-provision it if not.

---

## 1. Verify Super Admin Login
- Call bootstrap route to (re)ensure the user exists in Auth + `user_roles` with `super_admin`.
- Confirm sign-in works from `/auth`.

## 2. Database Migration (single migration)

New tables (all with `shop_id` where applicable, RLS + GRANTs):

- `audit_logs` — user_id, user_name, shop_id, action, table_name, record_id, old_value jsonb, new_value jsonb, ip_address, user_agent, created_at.
- `error_logs` — user_id, shop_id, source (frontend/backend/db/import/auth), message, stack, context jsonb, created_at.
- `activity_timeline` — polymorphic (entity_type, entity_id, shop_id) + event, details, user_id, created_at. (Feeds per-record timelines.)

Schema changes to existing tables:
- Add `deleted_at timestamptz` + `deleted_by uuid` to: `inventory_items`, `sales`, `customers`, `repairs`, `expenses`, `profiles`/`user_roles`.
- Update all RLS SELECT policies to exclude `deleted_at is not null` for non-admins; add "trash" policies for shop_admin+.
- Add unique partial index: `inventory_items(shop_id, imei) where imei is not null and deleted_at is null`.
- Add CHECK/trigger: `inventory_items.quantity >= 0`.

Triggers:
- Generic `log_audit()` trigger attached to inventory_items, sales, customers, repairs, expenses, user_roles, profiles — writes to `audit_logs` on INSERT/UPDATE/DELETE with old/new row diff.
- Auth event logging via client-side hook (login/logout) writing to `audit_logs`.

## 3. Soft Delete Everywhere
- Replace all `.delete()` calls in the frontend with `update({ deleted_at: now(), deleted_by: uid })`.
- All list queries filter `deleted_at is null`.
- New `/trash` page (shop_admin+) listing deleted items by entity with Restore action. Super admin gets "Permanent Delete".

## 4. Password Recovery
- Add "Forgot password?" link on `/auth` → `supabase.auth.resetPasswordForEmail` with redirect to `/auth/reset`.
- New `/auth/reset` page to set new password.
- Shop admin "Reset Password" action in User Management using an `adminResetPassword` server fn (uses `supabaseAdmin.auth.admin.generateLink`, emails via existing Lovable Emails or returns temporary password).

## 5. Import Validation (Inventory + Customers CSV)
- New reusable `<ImportWizard>` component: upload → parse (papaparse) → validate with zod → preview table with row-level status (valid/invalid/duplicate) → confirm → batched insert. Invalid rows never sent.

## 6. Activity Timeline
- Each detail view (product, sale, repair, customer) shows chronological events from `audit_logs` + `activity_timeline` for that record.

## 7. Confirm Dialogs
- Wrap every destructive action in existing `AlertDialog` with typed confirmation for high-impact ones (delete user, cancel sale).

## 8. Automated Backups
- `pg_cron` jobs (daily/weekly/monthly) calling a server route `/api/public/hooks/backup-snapshot` that dumps key tables to `backups` table (jsonb snapshots) — retained per schedule.
- Super admin "Backups" page with list + Restore (restores JSON into tables via admin server fn).
- Note: full DB dump via Cloud → Export data (mentioned in help center).

## 9. Role-Based Menu Visibility
- Central `nav.ts` config mapping route → allowed roles. Sidebar filters strictly. Add route guards on `_authenticated/*` pages that check role and redirect if unauthorized.
- Cashier: POS + Sales History only. Technician: Repairs only. Salesperson: POS + Customers. Shop Admin: everything within shop. Super Admin: platform pages.

## 10. Help Center
- `/help` route with searchable articles (MDX-lite as TS objects): sales, inventory, repairs, installments, trash/restore, password reset, imports.
- Floating "?" button in app shell linking to context-relevant article.

## 11. Error Monitoring
- Global `window.onerror` + `unhandledrejection` + React `ErrorBoundary` → POST to `/api/logError` server fn writing to `error_logs`.
- Wrap server fns to log thrown errors.
- Super admin `/platform/errors` dashboard: list, filter by source, mark resolved.

## 12. Data Integrity
- DB-level: unique IMEI (partial index above), non-negative stock trigger, phone regex CHECK on customers, unique (shop_id, email) for staff via user_roles+profiles constraint.
- Client-level: zod schemas on all forms; installment plan calculator validates paid ≤ total, monthly*n = total.

---

## Technical Notes
- All new tables follow public-schema GRANT pattern.
- RLS uses existing `has_role`, `current_shop_id`, `is_super_admin` helpers.
- Audit log trigger is `SECURITY DEFINER`, captures `auth.uid()` + `request.headers` for IP via `current_setting('request.headers', true)`.
- No breaking API changes; existing pages get soft-delete-aware queries.

## Deliverables Order
1. Migration (schema, triggers, RLS, indexes).
2. Bootstrap super admin verification.
3. Soft-delete + Trash page.
4. Password recovery flow.
5. Role-based nav + guards.
6. Audit log page + record timelines.
7. Error boundary + error dashboard.
8. Import wizard.
9. Help center + confirm dialogs polish.
10. Backups (cron + page).

Scope is large; I'll ship in that order across successive turns, each turn leaving the app in a working state. Approve to proceed with step 1 (migration).
