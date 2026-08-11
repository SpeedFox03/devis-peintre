begin;

-- Catalogue d'achats prive a chaque entreprise. Le produit physique est
-- separe de l'offre commerciale afin de pouvoir comparer plusieurs
-- fournisseurs sans dupliquer les besoins lies aux prestations.
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  name text not null check (btrim(name) <> ''),
  contact_name text,
  email text,
  phone text,
  website text,
  ordering_url text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index suppliers_company_name_unique
on public.suppliers(company_id, lower(name));

create index suppliers_company_active_idx
on public.suppliers(company_id, is_active, name);

create table public.supply_products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  name text not null check (btrim(name) <> ''),
  brand text,
  category text,
  package_quantity numeric(12, 3) not null default 1
    check (package_quantity > 0),
  package_unit text not null default 'pot'
    check (btrim(package_unit) <> ''),
  coverage_quantity numeric(12, 3) not null
    check (coverage_quantity > 0),
  coverage_unit text not null default 'm2'
    check (btrim(coverage_unit) <> ''),
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index supply_products_company_active_idx
on public.supply_products(company_id, is_active, category, name);

create table public.supplier_product_offers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  product_id uuid not null references public.supply_products(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  created_by uuid references auth.users(id) on delete set null,
  supplier_sku text,
  unit_price_ht numeric(12, 2) not null default 0
    check (unit_price_ht >= 0),
  tva_rate numeric(5, 2) not null default 21
    check (tva_rate >= 0 and tva_rate <= 100),
  product_url text,
  price_updated_at date not null default current_date,
  is_preferred boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, supplier_id)
);

create index supplier_product_offers_product_price_idx
on public.supplier_product_offers(product_id, is_active, unit_price_ht);

create index supplier_product_offers_supplier_idx
on public.supplier_product_offers(supplier_id, is_active);

create table public.service_material_requirements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  service_catalog_id uuid not null references public.service_catalog(id) on delete cascade,
  product_id uuid not null references public.supply_products(id) on delete restrict,
  created_by uuid references auth.users(id) on delete set null,
  usage_role text not null default 'Fourniture'
    check (btrim(usage_role) <> ''),
  coats numeric(6, 2) not null default 1
    check (coats > 0),
  waste_percent numeric(5, 2) not null default 10
    check (waste_percent >= 0 and waste_percent <= 100),
  coverage_override numeric(12, 3)
    check (coverage_override is null or coverage_override > 0),
  notes text,
  is_optional boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_catalog_id, product_id, usage_role)
);

create index service_material_requirements_service_idx
on public.service_material_requirements(service_catalog_id, is_active, sort_order);

create index service_material_requirements_product_idx
on public.service_material_requirements(product_id, is_active);

-- Cle normalisee vers le catalogue. Les metadonnees historiques restent en
-- place pour figer le libelle et le tarif visibles au moment de la creation.
alter table public.quote_items
add column if not exists service_catalog_id uuid
references public.service_catalog(id) on delete set null;

create index if not exists quote_items_service_catalog_idx
on public.quote_items(service_catalog_id)
where service_catalog_id is not null;

-- Le trigger historique recalcule les totaux sur tout UPDATE, meme si seule
-- la cle catalogue change. Le suspendre pendant ce backfill protege les
-- montants deja enregistres dans les devis existants.
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

  if exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.quote_items'::regclass
      and tgname = 'quote_items_require_subscription_write'
      and not tgisinternal
  ) then
    execute 'alter table public.quote_items disable trigger quote_items_require_subscription_write';
  end if;
end
$$;

update public.quote_items item
set service_catalog_id = service.id
from public.service_catalog service
where item.service_catalog_id is null
  and service.id::text = item.metadata ->> 'service_catalog_id'
  and service.company_id = item.company_id;

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

  if exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.quote_items'::regclass
      and tgname = 'quote_items_require_subscription_write'
      and not tgisinternal
  ) then
    execute 'alter table public.quote_items enable trigger quote_items_require_subscription_write';
  end if;
end
$$;

create or replace function public.apply_supply_catalog_scope()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_company_id uuid;
  v_related_company_id uuid;
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;

  if tg_table_name = 'suppliers' or tg_table_name = 'supply_products' then
    v_company_id := coalesce(new.company_id, public.resolve_user_company(new.created_by));
  elsif tg_table_name = 'supplier_product_offers' then
    select product.company_id into v_company_id
    from public.supply_products product
    where product.id = new.product_id;

    select supplier.company_id into v_related_company_id
    from public.suppliers supplier
    where supplier.id = new.supplier_id;

    if v_company_id is null or v_related_company_id is null
      or v_company_id <> v_related_company_id then
      raise exception 'Le produit et le fournisseur doivent appartenir a la meme entreprise.'
        using errcode = '23514';
    end if;
  elsif tg_table_name = 'service_material_requirements' then
    select service.company_id into v_company_id
    from public.service_catalog service
    where service.id = new.service_catalog_id;

    select product.company_id into v_related_company_id
    from public.supply_products product
    where product.id = new.product_id;

    if v_company_id is null or v_related_company_id is null
      or v_company_id <> v_related_company_id then
      raise exception 'La prestation et le produit doivent appartenir a la meme entreprise.'
        using errcode = '23514';
    end if;
  end if;

  if v_company_id is null then
    raise exception 'Entreprise introuvable pour ce catalogue.' using errcode = '23502';
  end if;

  if new.company_id is not null and new.company_id <> v_company_id then
    raise exception 'Le catalogue ne peut pas changer d''entreprise.' using errcode = '42501';
  end if;

  new.company_id := v_company_id;
  return new;
end;
$$;

create or replace function public.touch_supply_catalog_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger suppliers_apply_company_scope
before insert or update on public.suppliers
for each row execute function public.apply_supply_catalog_scope();

create trigger supply_products_apply_company_scope
before insert or update on public.supply_products
for each row execute function public.apply_supply_catalog_scope();

create trigger supplier_product_offers_apply_company_scope
before insert or update on public.supplier_product_offers
for each row execute function public.apply_supply_catalog_scope();

create trigger service_material_requirements_apply_company_scope
before insert or update on public.service_material_requirements
for each row execute function public.apply_supply_catalog_scope();

create trigger suppliers_touch_updated_at
before update on public.suppliers
for each row execute function public.touch_supply_catalog_updated_at();

create trigger supply_products_touch_updated_at
before update on public.supply_products
for each row execute function public.touch_supply_catalog_updated_at();

create trigger supplier_product_offers_touch_updated_at
before update on public.supplier_product_offers
for each row execute function public.touch_supply_catalog_updated_at();

create trigger service_material_requirements_touch_updated_at
before update on public.service_material_requirements
for each row execute function public.touch_supply_catalog_updated_at();

create or replace function public.sync_quote_item_service_catalog()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_metadata_service_id uuid;
  v_service_company_id uuid;
begin
  if new.service_catalog_id is null
    and coalesce(new.metadata ->> 'service_catalog_id', '') ~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    v_metadata_service_id := (new.metadata ->> 'service_catalog_id')::uuid;
    new.service_catalog_id := v_metadata_service_id;
  end if;

  if new.service_catalog_id is not null then
    select service.company_id into v_service_company_id
    from public.service_catalog service
    where service.id = new.service_catalog_id;

    if v_service_company_id is null or v_service_company_id <> new.company_id then
      raise exception 'La prestation du catalogue ne correspond pas au devis.'
        using errcode = '23514';
    end if;

    new.metadata := coalesce(new.metadata, '{}'::jsonb)
      || jsonb_build_object('service_catalog_id', new.service_catalog_id);
  end if;

  return new;
end;
$$;

create trigger quote_items_sync_service_catalog
before insert or update of service_catalog_id, metadata, company_id
on public.quote_items
for each row execute function public.sync_quote_item_service_catalog();

alter table public.suppliers enable row level security;
alter table public.supply_products enable row level security;
alter table public.supplier_product_offers enable row level security;
alter table public.service_material_requirements enable row level security;

create policy suppliers_company_member_access
on public.suppliers for all to authenticated
using (public.is_company_member(company_id))
with check (public.is_company_member(company_id));

create policy supply_products_company_member_access
on public.supply_products for all to authenticated
using (public.is_company_member(company_id))
with check (public.is_company_member(company_id));

create policy supplier_product_offers_company_member_access
on public.supplier_product_offers for all to authenticated
using (public.is_company_member(company_id))
with check (public.is_company_member(company_id));

create policy service_material_requirements_company_member_access
on public.service_material_requirements for all to authenticated
using (public.is_company_member(company_id))
with check (public.is_company_member(company_id));

revoke all on table public.suppliers from anon;
revoke all on table public.supply_products from anon;
revoke all on table public.supplier_product_offers from anon;
revoke all on table public.service_material_requirements from anon;

grant select, insert, update, delete on table public.suppliers to authenticated;
grant select, insert, update, delete on table public.supply_products to authenticated;
grant select, insert, update, delete on table public.supplier_product_offers to authenticated;
grant select, insert, update, delete on table public.service_material_requirements to authenticated;

commit;
