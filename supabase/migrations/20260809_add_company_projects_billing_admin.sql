begin;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'company_member_role') then
    create type public.company_member_role as enum ('owner', 'admin', 'member');
  end if;
  if not exists (select 1 from pg_type where typname = 'project_status') then
    create type public.project_status as enum ('lead', 'planned', 'in_progress', 'completed', 'archived');
  end if;
  if not exists (select 1 from pg_type where typname = 'billing_interval') then
    create type public.billing_interval as enum ('month', 'year');
  end if;
  if not exists (select 1 from pg_type where typname = 'subscription_status') then
    create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'canceled', 'expired');
  end if;
  if not exists (select 1 from pg_type where typname = 'quote_design_visibility') then
    create type public.quote_design_visibility as enum ('public', 'private');
  end if;
  if not exists (select 1 from pg_type where typname = 'quote_density') then
    create type public.quote_density as enum ('compact', 'normal', 'aere');
  end if;
  if not exists (select 1 from pg_type where typname = 'promotion_discount_type') then
    create type public.promotion_discount_type as enum ('percentage', 'fixed');
  end if;
end;
$$;

alter table public.profiles
  add column if not exists full_name text,
  add column if not exists last_seen_at timestamptz,
  add column if not exists account_status text not null default 'active'
    check (account_status in ('active', 'suspended'));

alter table public.companies
  add column if not exists account_status text not null default 'active'
    check (account_status in ('active', 'suspended'));

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id)
);

create table if not exists public.company_members (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.company_member_role not null default 'member',
  status text not null default 'active' check (status in ('invited', 'active', 'suspended')),
  joined_at timestamptz not null default now(),
  primary key (company_id, user_id)
);

insert into public.company_members (company_id, user_id, role, status)
select id, owner_user_id, 'owner'::public.company_member_role, 'active'
from public.companies
where owner_user_id is not null
on conflict (company_id, user_id) do update
set role = excluded.role,
    status = excluded.status;

insert into public.platform_admins (user_id)
select id
from auth.users
where lower(email) = 'jordix2003@gmail.com'
on conflict (user_id) do nothing;

create or replace function public.is_platform_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from public.platform_admins where user_id = p_user_id
  );
$$;

create or replace function public.is_company_member(p_company_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.company_members
    where company_id = p_company_id
      and user_id = p_user_id
      and status = 'active'
  );
$$;

create or replace function public.can_manage_company(p_company_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.is_platform_admin(p_user_id) or exists (
    select 1
    from public.company_members
    where company_id = p_company_id
      and user_id = p_user_id
      and status = 'active'
      and role in ('owner', 'admin')
  );
$$;

revoke all on function public.is_platform_admin(uuid) from public, anon;
revoke all on function public.is_company_member(uuid, uuid) from public, anon;
revoke all on function public.can_manage_company(uuid, uuid) from public, anon;
grant execute on function public.is_platform_admin(uuid) to authenticated;
grant execute on function public.is_company_member(uuid, uuid) to authenticated;
grant execute on function public.can_manage_company(uuid, uuid) to authenticated;

alter table public.customers add column if not exists company_id uuid references public.companies(id);
alter table public.service_catalog add column if not exists company_id uuid references public.companies(id);
alter table public.addresses add column if not exists company_id uuid references public.companies(id);
alter table public.quote_items add column if not exists company_id uuid references public.companies(id);
alter table public.quote_rooms add column if not exists company_id uuid references public.companies(id);
alter table public.quote_room_photos add column if not exists company_id uuid references public.companies(id);

update public.customers customer
set company_id = (
  select id
  from public.companies
  where owner_user_id = customer.owner_user_id
  order by created_at, id
  limit 1
)
where customer.company_id is null;

update public.service_catalog service
set company_id = (
  select id
  from public.companies
  where owner_user_id = service.owner_user_id
  order by created_at, id
  limit 1
)
where service.company_id is null;

update public.addresses address
set company_id = case
  when address.entity_type = 'company' then address.entity_id
  when address.entity_type = 'customer' then (
    select customer.company_id from public.customers customer where customer.id = address.entity_id
  )
  else (
    select company.id
    from public.companies company
    where company.owner_user_id = address.owner_user_id
    order by company.created_at, company.id
    limit 1
  )
end
where address.company_id is null;

-- Le trigger historique de recalcul s'exécute sur tout UPDATE de quote_items,
-- même lorsqu'aucune donnée tarifaire ne change. Le suspendre uniquement
-- pendant ce backfill évite de modifier les totaux enregistrés des devis.
do $$
begin
  if exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.quote_items'::regclass
      and tgname = 'trg_quote_items_recalc_update'
      and not tgisinternal
  ) then
    execute 'alter table public.quote_items disable trigger trg_quote_items_recalc_update';
  end if;
end
$$;

update public.quote_items item
set company_id = quote.company_id
from public.quotes quote
where quote.id = item.quote_id and item.company_id is null;

do $$
begin
  if exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.quote_items'::regclass
      and tgname = 'trg_quote_items_recalc_update'
      and not tgisinternal
  ) then
    execute 'alter table public.quote_items enable trigger trg_quote_items_recalc_update';
  end if;
end
$$;

update public.quote_rooms room
set company_id = quote.company_id
from public.quotes quote
where quote.id = room.quote_id and room.company_id is null;

update public.quote_room_photos photo
set company_id = room.company_id
from public.quote_rooms room
where room.id = photo.room_id and photo.company_id is null;

create or replace function public.resolve_user_company(p_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select candidate.company_id
  from (
    select company.id as company_id, 0 as priority
    from public.companies company
    where company.owner_user_id = p_user_id
    union all
    select membership.company_id,
      case membership.role when 'owner' then 1 when 'admin' then 2 else 3 end as priority
    from public.company_members membership
    where membership.user_id = p_user_id and membership.status = 'active'
  ) candidate
  order by candidate.priority, candidate.company_id
  limit 1;
$$;

revoke all on function public.resolve_user_company(uuid) from public, anon;

create or replace function public.apply_owner_company_scope()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.company_id is null and new.owner_user_id is not null then
    new.company_id := public.resolve_user_company(new.owner_user_id);
  end if;
  return new;
end;
$$;

create or replace function public.apply_address_company_scope()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.company_id is null then
    if new.entity_type = 'company' then
      new.company_id := new.entity_id;
    elsif new.entity_type = 'customer' then
      select customer.company_id into new.company_id
      from public.customers customer where customer.id = new.entity_id;
    end if;
    if new.company_id is null and new.owner_user_id is not null then
      new.company_id := public.resolve_user_company(new.owner_user_id);
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.apply_quote_child_company_scope()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.company_id is null then
    select quote.company_id into new.company_id
    from public.quotes quote where quote.id = new.quote_id;
  end if;
  return new;
end;
$$;

create or replace function public.apply_room_photo_company_scope()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.company_id is null then
    select room.company_id into new.company_id
    from public.quote_rooms room where room.id = new.room_id;
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'customers_apply_company_scope') then
    create trigger customers_apply_company_scope before insert or update of owner_user_id, company_id on public.customers
    for each row execute function public.apply_owner_company_scope();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'service_catalog_apply_company_scope') then
    create trigger service_catalog_apply_company_scope before insert or update of owner_user_id, company_id on public.service_catalog
    for each row execute function public.apply_owner_company_scope();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'addresses_apply_company_scope') then
    create trigger addresses_apply_company_scope before insert or update of owner_user_id, company_id, entity_type, entity_id on public.addresses
    for each row execute function public.apply_address_company_scope();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'quote_items_apply_company_scope') then
    create trigger quote_items_apply_company_scope before insert or update of quote_id, company_id on public.quote_items
    for each row execute function public.apply_quote_child_company_scope();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'quote_rooms_apply_company_scope') then
    create trigger quote_rooms_apply_company_scope before insert or update of quote_id, company_id on public.quote_rooms
    for each row execute function public.apply_quote_child_company_scope();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'quote_room_photos_apply_company_scope') then
    create trigger quote_room_photos_apply_company_scope before insert or update of room_id, company_id on public.quote_room_photos
    for each row execute function public.apply_room_photo_company_scope();
  end if;
end;
$$;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid not null references public.customers(id),
  name text not null check (length(trim(name)) between 1 and 180),
  status public.project_status not null default 'lead',
  address_line1 text,
  address_line2 text,
  postal_code text,
  city text,
  country text not null default 'Belgique',
  start_date date,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.quotes add column if not exists project_id uuid references public.projects(id);

create or replace function public.validate_project_company_scope()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  customer_company_id uuid;
begin
  select customer.company_id into customer_company_id
  from public.customers customer where customer.id = new.customer_id;
  if customer_company_id is distinct from new.company_id then
    raise exception 'Le client et le projet doivent appartenir à la même entreprise.';
  end if;
  return new;
end;
$$;

create or replace function public.validate_quote_project_scope()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  project_company_id uuid;
begin
  if new.project_id is not null then
    select project.company_id into project_company_id
    from public.projects project where project.id = new.project_id;
    if project_company_id is distinct from new.company_id then
      raise exception 'Le devis et le projet doivent appartenir à la même entreprise.';
    end if;
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'projects_validate_company_scope') then
    create trigger projects_validate_company_scope
    before insert or update of company_id, customer_id on public.projects
    for each row execute function public.validate_project_company_scope();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'quotes_validate_project_scope') then
    create trigger quotes_validate_project_scope
    before insert or update of company_id, project_id on public.quotes
    for each row execute function public.validate_quote_project_scope();
  end if;
end;
$$;

create table if not exists public.project_photos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  quote_room_id uuid references public.quote_rooms(id),
  storage_path text not null,
  original_name text,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  caption text,
  sort_order integer not null default 0,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (project_id, storage_path)
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-photos',
  'project-photos',
  false,
  12582912,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create table if not exists public.quote_designs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  renderer_key text not null,
  renderer_version integer not null default 1 check (renderer_version > 0),
  visibility public.quote_design_visibility not null default 'public',
  active boolean not null default true,
  preview_path text,
  config jsonb not null default '{}'::jsonb,
  created_by_admin uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_quote_designs (
  company_id uuid not null references public.companies(id) on delete cascade,
  design_id uuid not null references public.quote_designs(id) on delete cascade,
  enabled boolean not null default true,
  assigned_by uuid references auth.users(id),
  assigned_at timestamptz not null default now(),
  primary key (company_id, design_id)
);

create table if not exists public.company_quote_preferences (
  company_id uuid primary key references public.companies(id) on delete cascade,
  default_design_id uuid not null references public.quote_designs(id),
  default_density public.quote_density not null default 'normal',
  updated_at timestamptz not null default now()
);

insert into public.quote_designs (slug, name, description, renderer_key, renderer_version, visibility, active)
values
  ('artisan-standard', 'Standard artisan', 'Présentation claire et professionnelle.', 'standard', 1, 'public', true),
  ('elegant-moment-d-art', 'Élégant', 'Composition éditoriale privée avec gestes de peinture.', 'elegant', 1, 'private', true)
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    renderer_key = excluded.renderer_key,
    renderer_version = excluded.renderer_version,
    visibility = excluded.visibility,
    active = excluded.active;

insert into public.company_quote_designs (company_id, design_id)
select company.id, design.id
from public.companies company
cross join public.quote_designs design
where design.slug = 'artisan-standard'
on conflict (company_id, design_id) do nothing;

insert into public.company_quote_designs (company_id, design_id)
select company.id, design.id
from auth.users app_user
join public.companies company on company.owner_user_id = app_user.id
cross join public.quote_designs design
where lower(app_user.email) = 'contact@momentdart.be'
  and design.slug = 'elegant-moment-d-art'
on conflict (company_id, design_id) do nothing;

insert into public.company_quote_preferences (company_id, default_design_id, default_density)
select
  company.id,
  case
    when lower(app_user.email) = 'contact@momentdart.be' and settings.pdf_theme = 'elegant'
      then elegant.id
    else standard.id
  end,
  case settings.pdf_theme
    when 'compact' then 'compact'::public.quote_density
    when 'aere' then 'aere'::public.quote_density
    else 'normal'::public.quote_density
  end
from public.companies company
join auth.users app_user on app_user.id = company.owner_user_id
left join public.company_settings settings on settings.company_id = company.id
cross join lateral (select id from public.quote_designs where slug = 'artisan-standard') standard
cross join lateral (select id from public.quote_designs where slug = 'elegant-moment-d-art') elegant
on conflict (company_id) do nothing;

create or replace function public.bootstrap_new_company_access()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  standard_design_id uuid;
begin
  if new.owner_user_id is not null then
    insert into public.company_members (company_id, user_id, role, status)
    values (new.id, new.owner_user_id, 'owner', 'active')
    on conflict (company_id, user_id) do update
    set role = excluded.role, status = excluded.status;
  end if;

  select id into standard_design_id
  from public.quote_designs
  where slug = 'artisan-standard';

  if standard_design_id is not null then
    insert into public.company_quote_designs (company_id, design_id)
    values (new.id, standard_design_id)
    on conflict (company_id, design_id) do nothing;

    insert into public.company_quote_preferences (company_id, default_design_id, default_density)
    values (new.id, standard_design_id, 'normal')
    on conflict (company_id) do nothing;
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'companies_bootstrap_access') then
    create trigger companies_bootstrap_access
    after insert on public.companies
    for each row execute function public.bootstrap_new_company_access();
  end if;
end;
$$;

create or replace function public.touch_current_profile_last_seen()
returns void
language sql
security definer
set search_path = public, auth
as $$
  update public.profiles
  set last_seen_at = now()
  where id = auth.uid();
$$;

revoke all on function public.touch_current_profile_last_seen() from public, anon;
grant execute on function public.touch_current_profile_last_seen() to authenticated;

alter table public.quotes
  add column if not exists quote_design_id uuid references public.quote_designs(id),
  add column if not exists quote_density public.quote_density,
  add column if not exists quote_renderer_version integer;

update public.quotes quote
set quote_design_id = preferences.default_design_id,
    quote_density = preferences.default_density,
    quote_renderer_version = design.renderer_version
from public.company_quote_preferences preferences
join public.quote_designs design on design.id = preferences.default_design_id
where quote.company_id = preferences.company_id
  and quote.quote_design_id is null;

create or replace function public.apply_quote_design_defaults()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  preference public.company_quote_preferences%rowtype;
  renderer_version integer;
begin
  if new.quote_design_id is null or new.quote_density is null or new.quote_renderer_version is null then
    select * into preference
    from public.company_quote_preferences
    where company_id = new.company_id;

    new.quote_design_id := coalesce(new.quote_design_id, preference.default_design_id);
    new.quote_density := coalesce(new.quote_density, preference.default_density);
    if new.quote_renderer_version is null and new.quote_design_id is not null then
      select design.renderer_version into renderer_version
      from public.quote_designs design where design.id = new.quote_design_id;
      new.quote_renderer_version := renderer_version;
    end if;
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'quotes_apply_design_defaults') then
    create trigger quotes_apply_design_defaults
    before insert on public.quotes
    for each row execute function public.apply_quote_design_defaults();
  end if;
end;
$$;

create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  entitlements jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.plan_prices (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.subscription_plans(id) on delete cascade,
  billing_interval public.billing_interval not null,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'EUR' check (length(currency) = 3),
  external_price_id text unique,
  active boolean not null default true,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  check (valid_until is null or valid_until > valid_from)
);

create unique index if not exists plan_prices_one_current_interval
on public.plan_prices(plan_id, billing_interval)
where active and valid_until is null;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  plan_id uuid not null references public.subscription_plans(id),
  price_id uuid not null references public.plan_prices(id),
  status public.subscription_status not null,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  provider_customer_id text,
  provider_subscription_id text unique,
  trial_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists subscriptions_one_current_company
on public.subscriptions(company_id)
where status in ('trialing', 'active', 'past_due');

create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  external_event_id text not null unique,
  event_type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text
);

create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  discount_type public.promotion_discount_type not null,
  percent_off numeric(5,2),
  amount_off_cents integer,
  currency text,
  starts_at timestamptz,
  ends_at timestamptz,
  max_redemptions integer,
  max_redemptions_per_company integer not null default 1,
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at),
  check (max_redemptions is null or max_redemptions > 0),
  check (max_redemptions_per_company > 0),
  check (
    (discount_type = 'percentage' and percent_off > 0 and percent_off <= 100 and amount_off_cents is null)
    or
    (discount_type = 'fixed' and amount_off_cents > 0 and percent_off is null and currency is not null)
  )
);

create unique index if not exists promo_codes_normalized_code on public.promo_codes(lower(code));

create table if not exists public.promo_code_prices (
  promo_code_id uuid not null references public.promo_codes(id) on delete cascade,
  plan_price_id uuid not null references public.plan_prices(id) on delete cascade,
  primary key (promo_code_id, plan_price_id)
);

create table if not exists public.promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  promo_code_id uuid not null references public.promo_codes(id),
  company_id uuid not null references public.companies(id),
  subscription_id uuid references public.subscriptions(id),
  discount_amount_cents integer check (discount_amount_cents is null or discount_amount_cents >= 0),
  redeemed_at timestamptz not null default now()
);

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id),
  action text not null,
  target_type text not null,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists company_members_user_idx on public.company_members(user_id, status);
create index if not exists customers_company_archived_idx on public.customers(company_id, archived_at);
create index if not exists service_catalog_company_active_idx on public.service_catalog(company_id, is_active);
create index if not exists addresses_company_entity_idx on public.addresses(company_id, entity_type, entity_id);
create index if not exists projects_company_status_updated_idx on public.projects(company_id, status, updated_at desc);
create index if not exists projects_customer_idx on public.projects(customer_id);
create index if not exists quotes_company_status_created_idx on public.quotes(company_id, status, created_at desc);
create index if not exists quotes_project_idx on public.quotes(project_id);
create index if not exists quote_items_company_idx on public.quote_items(company_id);
create index if not exists quote_rooms_company_idx on public.quote_rooms(company_id);
create index if not exists quote_room_photos_company_idx on public.quote_room_photos(company_id);
create index if not exists project_photos_project_sort_idx on public.project_photos(project_id, sort_order, created_at);
create index if not exists subscriptions_company_status_idx on public.subscriptions(company_id, status);
create index if not exists promo_redemptions_company_idx on public.promo_redemptions(company_id, redeemed_at desc);
create index if not exists admin_audit_created_idx on public.admin_audit_log(created_at desc);

alter table public.platform_admins enable row level security;
alter table public.company_members enable row level security;
alter table public.projects enable row level security;
alter table public.project_photos enable row level security;
alter table public.quote_designs enable row level security;
alter table public.company_quote_designs enable row level security;
alter table public.company_quote_preferences enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.plan_prices enable row level security;
alter table public.subscriptions enable row level security;
alter table public.billing_events enable row level security;
alter table public.promo_codes enable row level security;
alter table public.promo_code_prices enable row level security;
alter table public.promo_redemptions enable row level security;
alter table public.admin_audit_log enable row level security;

create policy platform_admins_self_read on public.platform_admins
for select to authenticated
using (user_id = auth.uid() or public.is_platform_admin());

create policy company_members_member_read on public.company_members
for select to authenticated
using (public.is_company_member(company_id) or public.is_platform_admin());

create policy company_members_manager_insert on public.company_members
for insert to authenticated
with check (public.can_manage_company(company_id));

create policy company_members_manager_update on public.company_members
for update to authenticated
using (public.can_manage_company(company_id))
with check (public.can_manage_company(company_id));

create policy projects_member_read on public.projects
for select to authenticated
using (public.is_company_member(company_id));

create policy projects_member_insert on public.projects
for insert to authenticated
with check (public.is_company_member(company_id) and created_by = auth.uid());

create policy projects_member_update on public.projects
for update to authenticated
using (public.is_company_member(company_id))
with check (public.is_company_member(company_id));

create policy project_photos_member_read on public.project_photos
for select to authenticated
using (public.is_company_member(company_id));

create policy project_photos_member_insert on public.project_photos
for insert to authenticated
with check (public.is_company_member(company_id) and uploaded_by = auth.uid());

create policy project_photos_member_update on public.project_photos
for update to authenticated
using (public.is_company_member(company_id))
with check (public.is_company_member(company_id));

create policy project_photos_storage_member_read on storage.objects
for select to authenticated
using (
  bucket_id = 'project-photos'
  and exists (
    select 1 from public.company_members membership
    where membership.company_id::text = (storage.foldername(name))[1]
      and membership.user_id = auth.uid()
      and membership.status = 'active'
  )
);

create policy project_photos_storage_member_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'project-photos'
  and exists (
    select 1 from public.company_members membership
    where membership.company_id::text = (storage.foldername(name))[1]
      and membership.user_id = auth.uid()
      and membership.status = 'active'
  )
);

create policy project_photos_storage_member_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'project-photos'
  and exists (
    select 1 from public.company_members membership
    where membership.company_id::text = (storage.foldername(name))[1]
      and membership.user_id = auth.uid()
      and membership.status = 'active'
  )
);

create policy quote_designs_available_read on public.quote_designs
for select to authenticated
using (
  active and (
    visibility = 'public'
    or exists (
      select 1
      from public.company_quote_designs assignment
      where assignment.design_id = quote_designs.id
        and assignment.enabled
        and public.is_company_member(assignment.company_id)
    )
  )
);

create policy company_quote_designs_member_read on public.company_quote_designs
for select to authenticated
using (public.is_company_member(company_id));

create policy company_quote_preferences_member_read on public.company_quote_preferences
for select to authenticated
using (public.is_company_member(company_id));

create policy company_quote_preferences_manager_update on public.company_quote_preferences
for update to authenticated
using (public.can_manage_company(company_id))
with check (public.can_manage_company(company_id));

create policy subscription_plans_authenticated_read on public.subscription_plans
for select to authenticated using (active);

create policy plan_prices_authenticated_read on public.plan_prices
for select to authenticated using (active);

create policy subscriptions_member_read on public.subscriptions
for select to authenticated using (public.is_company_member(company_id));

create policy promo_redemptions_member_read on public.promo_redemptions
for select to authenticated using (public.is_company_member(company_id));

create policy admin_audit_admin_read on public.admin_audit_log
for select to authenticated using (public.is_platform_admin());

create policy customers_company_member_read on public.customers
for select to authenticated using (public.is_company_member(company_id));

create policy customers_company_member_insert on public.customers
for insert to authenticated with check (public.is_company_member(company_id));

create policy customers_company_member_update on public.customers
for update to authenticated using (public.is_company_member(company_id))
with check (public.is_company_member(company_id));

create policy service_catalog_company_member_read on public.service_catalog
for select to authenticated using (public.is_company_member(company_id));

create policy service_catalog_company_member_insert on public.service_catalog
for insert to authenticated with check (public.is_company_member(company_id));

create policy service_catalog_company_member_update on public.service_catalog
for update to authenticated using (public.is_company_member(company_id))
with check (public.is_company_member(company_id));

create policy addresses_company_member_read on public.addresses
for select to authenticated using (public.is_company_member(company_id));

create policy addresses_company_member_insert on public.addresses
for insert to authenticated with check (public.is_company_member(company_id));

create policy addresses_company_member_update on public.addresses
for update to authenticated using (public.is_company_member(company_id))
with check (public.is_company_member(company_id));

create policy quotes_company_member_read on public.quotes
for select to authenticated using (public.is_company_member(company_id));

create policy quotes_company_member_insert on public.quotes
for insert to authenticated with check (public.is_company_member(company_id));

create policy quotes_company_member_update on public.quotes
for update to authenticated using (public.is_company_member(company_id))
with check (public.is_company_member(company_id));

create policy quote_items_company_member_read on public.quote_items
for select to authenticated using (public.is_company_member(company_id));

create policy quote_items_company_member_insert on public.quote_items
for insert to authenticated with check (public.is_company_member(company_id));

create policy quote_items_company_member_update on public.quote_items
for update to authenticated using (public.is_company_member(company_id))
with check (public.is_company_member(company_id));

create policy quote_rooms_company_member_read on public.quote_rooms
for select to authenticated using (public.is_company_member(company_id));

create policy quote_rooms_company_member_insert on public.quote_rooms
for insert to authenticated with check (public.is_company_member(company_id));

create policy quote_rooms_company_member_update on public.quote_rooms
for update to authenticated using (public.is_company_member(company_id))
with check (public.is_company_member(company_id));

create policy quote_room_photos_company_member_read on public.quote_room_photos
for select to authenticated using (public.is_company_member(company_id));

create policy quote_room_photos_company_member_insert on public.quote_room_photos
for insert to authenticated with check (public.is_company_member(company_id));

create policy quote_room_photos_company_member_update on public.quote_room_photos
for update to authenticated using (public.is_company_member(company_id))
with check (public.is_company_member(company_id));

commit;
