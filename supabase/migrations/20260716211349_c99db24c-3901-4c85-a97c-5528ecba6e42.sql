
-- ROLES
create type public.app_role as enum ('owner', 'manager', 'cashier');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles readable by authenticated" on public.profiles for select to authenticated using (true);
create policy "profiles self update" on public.profiles for update to authenticated using (auth.uid() = id);
create policy "profiles self insert" on public.profiles for insert to authenticated with check (auth.uid() = id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique(user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.get_my_role()
returns public.app_role language sql stable security definer set search_path = public as $$
  select role from public.user_roles where user_id = auth.uid()
  order by case role when 'owner' then 1 when 'manager' then 2 else 3 end
  limit 1
$$;

create policy "roles readable by authenticated" on public.user_roles for select to authenticated using (true);
create policy "owners manage roles" on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(),'owner')) with check (public.has_role(auth.uid(),'owner'));

-- Auto-create profile on new user; first user becomes owner, rest cashier
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  is_first boolean;
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), new.raw_user_meta_data->>'phone');
  select count(*) = 0 from public.user_roles into is_first;
  insert into public.user_roles (user_id, role) values (new.id, case when is_first then 'owner'::public.app_role else 'cashier'::public.app_role end);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- CUSTOMERS
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.customers to authenticated;
grant all on public.customers to service_role;
alter table public.customers enable row level security;
create policy "customers auth all" on public.customers for all to authenticated using (true) with check (true);

-- INVENTORY
create type public.item_condition as enum ('new', 'used');
create type public.item_type as enum ('phone', 'accessory');

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  item_type public.item_type not null default 'phone',
  brand text,
  model text,
  name text,
  imei text unique,
  condition public.item_condition default 'new',
  buy_price numeric(12,2) not null default 0,
  sell_price numeric(12,2) not null default 0,
  quantity int not null default 1,
  low_stock_threshold int not null default 1,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.inventory_items to authenticated;
grant all on public.inventory_items to service_role;
alter table public.inventory_items enable row level security;
create policy "inventory auth all" on public.inventory_items for all to authenticated using (true) with check (true);

-- SALES
create type public.sale_payment_type as enum ('cash', 'installment');

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  sold_by uuid references public.profiles(id) on delete set null,
  quantity int not null default 1,
  sell_price numeric(12,2) not null,
  discount numeric(12,2) not null default 0,
  buy_price_snapshot numeric(12,2) not null default 0,
  profit numeric(12,2) generated always as ((sell_price - discount - buy_price_snapshot) * quantity) stored,
  payment_type public.sale_payment_type not null default 'cash',
  sale_date timestamptz not null default now()
);
grant select, insert, update, delete on public.sales to authenticated;
grant all on public.sales to service_role;
alter table public.sales enable row level security;
create policy "sales auth read" on public.sales for select to authenticated using (true);
create policy "sales auth insert" on public.sales for insert to authenticated with check (true);
create policy "sales manager+ update" on public.sales for update to authenticated
  using (public.has_role(auth.uid(),'owner') or public.has_role(auth.uid(),'manager'));
create policy "sales owner delete" on public.sales for delete to authenticated
  using (public.has_role(auth.uid(),'owner'));

-- Decrement inventory on sale
create or replace function public.handle_sale_stock()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.inventory_item_id is not null then
    update public.inventory_items set quantity = quantity - new.quantity where id = new.inventory_item_id;
  end if;
  return new;
end $$;
create trigger sale_decrement_stock after insert on public.sales for each row execute function public.handle_sale_stock();

-- INSTALLMENTS
create type public.installment_status as enum ('pending', 'paid', 'overdue');

create table public.installment_plans (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid references public.sales(id) on delete cascade,
  total_amount numeric(12,2) not null,
  paid_amount numeric(12,2) not null default 0,
  balance numeric(12,2) generated always as (total_amount - paid_amount) stored,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.installment_plans to authenticated;
grant all on public.installment_plans to service_role;
alter table public.installment_plans enable row level security;
create policy "iplans auth all" on public.installment_plans for all to authenticated using (true) with check (true);

create table public.installment_payments (
  id uuid primary key default gen_random_uuid(),
  installment_plan_id uuid references public.installment_plans(id) on delete cascade,
  amount numeric(12,2) not null,
  due_date date,
  paid_date date,
  status public.installment_status not null default 'pending'
);
grant select, insert, update, delete on public.installment_payments to authenticated;
grant all on public.installment_payments to service_role;
alter table public.installment_payments enable row level security;
create policy "ipay auth all" on public.installment_payments for all to authenticated using (true) with check (true);

create or replace function public.handle_installment_payment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'paid' and (old.status is null or old.status <> 'paid') then
    update public.installment_plans set paid_amount = paid_amount + new.amount where id = new.installment_plan_id;
  elsif new.status <> 'paid' and old.status = 'paid' then
    update public.installment_plans set paid_amount = greatest(0, paid_amount - new.amount) where id = new.installment_plan_id;
  end if;
  return new;
end $$;
create trigger ipay_update_plan after insert or update on public.installment_payments for each row execute function public.handle_installment_payment();

-- WARRANTY
create type public.warranty_status as enum ('active', 'expired', 'claimed');

create table public.warranties (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid references public.sales(id) on delete cascade,
  period_months int not null default 3,
  start_date date not null default current_date,
  end_date date not null,
  status public.warranty_status not null default 'active'
);
grant select, insert, update, delete on public.warranties to authenticated;
grant all on public.warranties to service_role;
alter table public.warranties enable row level security;
create policy "warranties auth all" on public.warranties for all to authenticated using (true) with check (true);

create table public.warranty_claims (
  id uuid primary key default gen_random_uuid(),
  warranty_id uuid references public.warranties(id) on delete cascade,
  claim_date date not null default current_date,
  issue_description text,
  resolution text
);
grant select, insert, update, delete on public.warranty_claims to authenticated;
grant all on public.warranty_claims to service_role;
alter table public.warranty_claims enable row level security;
create policy "wclaims auth all" on public.warranty_claims for all to authenticated using (true) with check (true);

-- REPAIRS
create type public.repair_status as enum ('received', 'in_progress', 'completed');

create table public.repairs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  device_description text not null,
  issue_description text,
  status public.repair_status not null default 'received',
  repair_cost numeric(12,2) not null default 0,
  received_date timestamptz not null default now(),
  completed_date timestamptz
);
grant select, insert, update, delete on public.repairs to authenticated;
grant all on public.repairs to service_role;
alter table public.repairs enable row level security;
create policy "repairs auth all" on public.repairs for all to authenticated using (true) with check (true);

-- EXPENSES
create type public.expense_category as enum ('rent', 'electricity', 'salaries', 'other');

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  category public.expense_category not null,
  amount numeric(12,2) not null,
  note text,
  expense_date date not null default current_date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.expenses to authenticated;
grant all on public.expenses to service_role;
alter table public.expenses enable row level security;
create policy "expenses read auth" on public.expenses for select to authenticated using (true);
create policy "expenses manager+ write" on public.expenses for insert to authenticated
  with check (public.has_role(auth.uid(),'owner') or public.has_role(auth.uid(),'manager'));
create policy "expenses manager+ update" on public.expenses for update to authenticated
  using (public.has_role(auth.uid(),'owner') or public.has_role(auth.uid(),'manager'));
create policy "expenses owner delete" on public.expenses for delete to authenticated
  using (public.has_role(auth.uid(),'owner'));

create index idx_sales_customer on public.sales(customer_id);
create index idx_sales_item on public.sales(inventory_item_id);
create index idx_sales_date on public.sales(sale_date);
create index idx_repairs_customer on public.repairs(customer_id);
create index idx_inventory_imei on public.inventory_items(imei);
create index idx_inventory_type on public.inventory_items(item_type);
