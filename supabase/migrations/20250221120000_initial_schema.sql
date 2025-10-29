-- Initial schema for Capture Solutions CMS

-- Extensions
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- Helper functions -------------------------------------------------------

create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_manager()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('manager', 'admin')
  );
$$;

create or replace function public.generate_offer_reference()
returns text
language plpgsql
as $$
declare
  current_year int := date_part('year', now());
  next_value int;
begin
  loop
    update public.offer_reference_counters
       set last_value = last_value + 1
     where year = current_year
     returning last_value into next_value;
    if found then
      exit;
    end if;
    begin
      insert into public.offer_reference_counters(year, last_value)
      values (current_year, 1)
      returning last_value into next_value;
      exit;
    exception when unique_violation then
      -- try again
    end;
  end loop;
  return format('OFF-%s-%04s', current_year, next_value);
end;
$$;

create or replace function public.set_offer_reference()
returns trigger
language plpgsql
as $$
begin
  if new.offer_reference is null then
    new.offer_reference = public.generate_offer_reference();
  end if;
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles(id, email, role)
  values (new.id, coalesce(new.email, ''), 'sales_rep')
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Metadata tables --------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'sales_rep' check (role in ('sales_rep', 'manager', 'admin')),
  territory text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at();

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  contact_email text,
  contact_phone text,
  billing_address jsonb,
  shipping_address jsonb,
  notes text,
  tags text[] default '{}',
  created_by uuid not null default auth.uid(),
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_customers_updated_at
  before update on public.customers
  for each row execute function public.update_updated_at();

create table public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  description text,
  unit text,
  base_price numeric(12,2) not null default 0,
  tax_rate numeric(5,2) not null default 0,
  currency char(3) not null default 'USD',
  is_active boolean not null default true,
  metadata jsonb,
  created_by uuid not null default auth.uid(),
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_catalog_items_updated_at
  before update on public.catalog_items
  for each row execute function public.update_updated_at();

-- Offers -----------------------------------------------------------------

create type public.offer_status as enum ('draft', 'submitted', 'approved', 'rejected', 'signed', 'archived');
create type public.approval_decision as enum ('submitted', 'approved', 'rejected');

create table public.offer_reference_counters (
  year int primary key,
  last_value int not null default 0
);

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  offer_reference text not null unique,
  customer_id uuid references public.customers(id) on delete set null,
  sales_rep_id uuid not null references public.profiles(id) on delete restrict,
  title text,
  status public.offer_status not null default 'draft',
  currency char(3) not null default 'USD',
  subtotal_amount numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  discount_percent numeric(5,2) default 0,
  tax_amount numeric(14,2) not null default 0,
  transport_cost numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,
  notes text,
  valid_from date not null default current_date,
  valid_until date not null default (current_date + interval '30 days'),
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references public.profiles(id) on delete set null,
  rejected_at timestamptz,
  rejected_reason text,
  signed_at timestamptz,
  pdf_storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_offers_updated_at
  before update on public.offers
  for each row execute function public.update_updated_at();

create trigger set_offers_reference
  before insert on public.offers
  for each row execute function public.set_offer_reference();

create table public.offer_items (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers(id) on delete cascade,
  catalog_item_id uuid references public.catalog_items(id) on delete set null,
  description text not null,
  quantity numeric(12,3) not null default 1,
  unit text,
  unit_price numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  tax_rate numeric(5,2) not null default 0,
  line_total numeric(14,2) not null default 0,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_offer_items_updated_at
  before update on public.offer_items
  for each row execute function public.update_updated_at();

create table public.offer_approvals (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers(id) on delete cascade,
  approver_id uuid not null references public.profiles(id) on delete restrict,
  decision public.approval_decision not null,
  comment text,
  decided_at timestamptz not null default now()
);

-- Documents --------------------------------------------------------------

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text,
  tags text[] default '{}',
  file_path text not null,
  file_size bigint,
  mime_type text,
  uploaded_by uuid not null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Indexes ----------------------------------------------------------------

create index idx_customers_name on public.customers using gin (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(contact_name,'')));
create index idx_catalog_items_name on public.catalog_items using gin (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(description,'')));
create index idx_offers_customer on public.offers(customer_id);
create index idx_offers_sales_rep on public.offers(sales_rep_id);
create index idx_offers_status on public.offers(status);
create index idx_offer_items_offer on public.offer_items(offer_id);
create index idx_documents_category on public.documents(category);
create index idx_documents_uploaded_by on public.documents(uploaded_by);

-- Triggers ----------------------------------------------------------------

create or replace function public.update_offer_item_totals()
returns trigger
language plpgsql
as $$
begin
  if new.quantity < 0 then
    raise exception 'Quantity cannot be negative';
  end if;
  if new.unit_price < 0 or new.discount_amount < 0 then
    raise exception 'Price and discount must be non-negative';
  end if;
  new.line_total = (new.quantity * new.unit_price) - new.discount_amount;
  if new.line_total < 0 then
    new.line_total = 0;
  end if;
  return new;
end;
$$;

-- Recalculate offer totals after item changes
create or replace function public.refresh_offer_totals()
returns trigger
language plpgsql
as $$
begin
  update public.offers o
     set subtotal_amount = coalesce((select sum(oi.line_total + oi.discount_amount) from public.offer_items oi where oi.offer_id = o.id), 0),
         discount_amount = coalesce((select sum(oi.discount_amount) from public.offer_items oi where oi.offer_id = o.id), 0),
         tax_amount = coalesce((select sum((oi.line_total) * (oi.tax_rate / 100.0)) from public.offer_items oi where oi.offer_id = o.id), 0),
         total_amount = coalesce((select sum(oi.line_total) from public.offer_items oi where oi.offer_id = o.id), 0)
   where o.id = coalesce(new.offer_id, old.offer_id);
  update public.offers o
     set total_amount = total_amount + tax_amount + transport_cost
   where o.id = coalesce(new.offer_id, old.offer_id);
  return null;
end;
$$;

create trigger set_offer_items_totals
  before insert or update on public.offer_items
  for each row
  execute function public.update_offer_item_totals();

create trigger refresh_offer_totals_after_item
  after insert or update or delete on public.offer_items
  for each row execute function public.refresh_offer_totals();

-- Hooks for auth.users ---------------------------------------------------

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row Level Security -----------------------------------------------------

alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.catalog_items enable row level security;
alter table public.offers enable row level security;
alter table public.offer_items enable row level security;
alter table public.offer_approvals enable row level security;
alter table public.documents enable row level security;

-- profiles policies
create policy "view own profile" on public.profiles
for select using (auth.uid() = id);

create policy "update own profile" on public.profiles
for update using (auth.uid() = id)
with check (auth.uid() = id);

create policy "admins manage profiles" on public.profiles
for all using (public.is_manager())
with check (public.is_manager());

-- customers policies
create policy "customers select" on public.customers
for select to authenticated
using (true);

create policy "customers insert" on public.customers
for insert to authenticated
with check (true);

create policy "customers update" on public.customers
for update to authenticated
using (created_by = auth.uid() or public.is_manager())
with check (created_by = auth.uid() or public.is_manager());

create policy "customers delete" on public.customers
for delete to authenticated
using (public.is_manager());

-- catalog policies
create policy "catalog select" on public.catalog_items
for select to authenticated
using (true);

create policy "catalog insert" on public.catalog_items
for insert to authenticated
with check (public.is_manager());

create policy "catalog update" on public.catalog_items
for update to authenticated
using (public.is_manager())
with check (public.is_manager());

create policy "catalog delete" on public.catalog_items
for delete to authenticated
using (public.is_manager());

-- offers policies
create policy "offers select" on public.offers
for select to authenticated
using (sales_rep_id = auth.uid() or public.is_manager());

create policy "offers insert" on public.offers
for insert to authenticated
with check (sales_rep_id = auth.uid() or public.is_manager());

create policy "offers update" on public.offers
for update to authenticated
using (sales_rep_id = auth.uid() or public.is_manager())
with check (sales_rep_id = auth.uid() or public.is_manager());

create policy "offers delete" on public.offers
for delete to authenticated
using (public.is_manager());

-- offer_items policies
create policy "offer_items select" on public.offer_items
for select to authenticated
using (exists (
  select 1 from public.offers o
   where o.id = offer_id
     and (o.sales_rep_id = auth.uid() or public.is_manager())
));

create policy "offer_items insert" on public.offer_items
for insert to authenticated
with check (exists (
  select 1 from public.offers o
   where o.id = offer_id
     and (o.sales_rep_id = auth.uid() or public.is_manager())
));

create policy "offer_items update" on public.offer_items
for update to authenticated
using (exists (
  select 1 from public.offers o
   where o.id = offer_id
     and (o.sales_rep_id = auth.uid() or public.is_manager())
))
with check (exists (
  select 1 from public.offers o
   where o.id = offer_id
     and (o.sales_rep_id = auth.uid() or public.is_manager())
));

create policy "offer_items delete" on public.offer_items
for delete to authenticated
using (exists (
  select 1 from public.offers o
   where o.id = offer_id
     and (o.sales_rep_id = auth.uid() or public.is_manager())
));

-- offer approvals policies
create policy "offer approvals select" on public.offer_approvals
for select to authenticated
using (public.is_manager() or exists (
  select 1 from public.offers o
   where o.id = offer_id and o.sales_rep_id = auth.uid()
));

create policy "offer approvals insert" on public.offer_approvals
for insert to authenticated
with check (public.is_manager());

create policy "offer approvals delete" on public.offer_approvals
for delete to authenticated
using (public.is_manager());

-- documents policies
create policy "documents select" on public.documents
for select to authenticated
using (true);

create policy "documents insert" on public.documents
for insert to authenticated
with check (auth.uid() = uploaded_by);

create policy "documents update" on public.documents
for update to authenticated
using (uploaded_by = auth.uid() or public.is_manager())
with check (uploaded_by = auth.uid() or public.is_manager());

create policy "documents delete" on public.documents
for delete to authenticated
using (uploaded_by = auth.uid() or public.is_manager());

-- Default grants ---------------------------------------------------------

grant usage on schema public to postgres, anon, authenticated, service_role;
