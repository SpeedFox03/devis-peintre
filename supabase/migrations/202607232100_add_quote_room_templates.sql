-- Reusable room templates for quotes.
-- A template keeps the room name, its internal notes, PDF pagination and lines.
-- Room photos are intentionally excluded.

create table if not exists public.quote_room_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null check (length(btrim(name)) > 0),
  room_name text not null check (length(btrim(room_name)) > 0),
  notes text,
  pdf_page_break text not null default 'auto'
    check (pdf_page_break in ('auto', 'keep', 'before')),
  created_at timestamptz not null default now()
);

create table if not exists public.quote_room_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null
    references public.quote_room_templates(id) on delete cascade,
  item_type text not null,
  category text,
  label text not null,
  description text,
  unit text not null,
  quantity numeric not null,
  unit_price_ht numeric not null,
  tva_rate numeric not null,
  metadata jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0
);

create index if not exists quote_room_templates_company_id_idx
  on public.quote_room_templates(company_id, name);

create index if not exists quote_room_template_items_template_id_idx
  on public.quote_room_template_items(template_id, sort_order, id);

alter table public.quote_room_templates enable row level security;
alter table public.quote_room_template_items enable row level security;

create policy "Company owners can view room templates"
  on public.quote_room_templates
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.companies
      where companies.id = quote_room_templates.company_id
        and companies.owner_user_id = auth.uid()
    )
  );

create policy "Company owners can create room templates"
  on public.quote_room_templates
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1
      from public.companies
      where companies.id = quote_room_templates.company_id
        and companies.owner_user_id = auth.uid()
    )
  );

create policy "Company owners can update room templates"
  on public.quote_room_templates
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.companies
      where companies.id = quote_room_templates.company_id
        and companies.owner_user_id = auth.uid()
    )
  )
  with check (
    created_by = auth.uid()
    and exists (
      select 1
      from public.companies
      where companies.id = quote_room_templates.company_id
        and companies.owner_user_id = auth.uid()
    )
  );

create policy "Company owners can delete room templates"
  on public.quote_room_templates
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.companies
      where companies.id = quote_room_templates.company_id
        and companies.owner_user_id = auth.uid()
    )
  );

create policy "Company owners can view room template items"
  on public.quote_room_template_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.quote_room_templates
      where quote_room_templates.id = quote_room_template_items.template_id
    )
  );

create policy "Company owners can create room template items"
  on public.quote_room_template_items
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.quote_room_templates
      where quote_room_templates.id = quote_room_template_items.template_id
        and quote_room_templates.created_by = auth.uid()
    )
  );

create policy "Company owners can update room template items"
  on public.quote_room_template_items
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.quote_room_templates
      where quote_room_templates.id = quote_room_template_items.template_id
    )
  )
  with check (
    exists (
      select 1
      from public.quote_room_templates
      where quote_room_templates.id = quote_room_template_items.template_id
        and quote_room_templates.created_by = auth.uid()
    )
  );

create policy "Company owners can delete room template items"
  on public.quote_room_template_items
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.quote_room_templates
      where quote_room_templates.id = quote_room_template_items.template_id
    )
  );

grant select, insert, update, delete
  on public.quote_room_templates
  to authenticated;

grant select, insert, update, delete
  on public.quote_room_template_items
  to authenticated;

create or replace function public.create_quote_room_template(
  p_room_id uuid,
  p_template_name text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_room public.quote_rooms%rowtype;
  v_company_id uuid;
  v_template_id uuid;
  v_template_name text := btrim(coalesce(p_template_name, ''));
begin
  if v_template_name = '' then
    raise exception 'Le nom du modèle est obligatoire.'
      using errcode = '22023';
  end if;

  select quote_rooms.*
  into v_room
  from public.quote_rooms
  where quote_rooms.id = p_room_id
  for share;

  if not found then
    raise exception 'Pièce introuvable.' using errcode = 'P0002';
  end if;

  select quotes.company_id
  into v_company_id
  from public.quotes
  where quotes.id = v_room.quote_id
  for share;

  if not found then
    raise exception 'Devis introuvable.' using errcode = 'P0002';
  end if;

  insert into public.quote_room_templates (
    company_id,
    created_by,
    name,
    room_name,
    notes,
    pdf_page_break
  )
  values (
    v_company_id,
    auth.uid(),
    v_template_name,
    v_room.name,
    v_room.notes,
    v_room.pdf_page_break
  )
  returning id into v_template_id;

  insert into public.quote_room_template_items (
    template_id,
    item_type,
    category,
    label,
    description,
    unit,
    quantity,
    unit_price_ht,
    tva_rate,
    metadata,
    sort_order
  )
  select
    v_template_id,
    quote_items.item_type,
    quote_items.category,
    quote_items.label,
    quote_items.description,
    quote_items.unit,
    quote_items.quantity,
    quote_items.unit_price_ht,
    quote_items.tva_rate,
    coalesce(quote_items.metadata, '{}'::jsonb),
    row_number() over (
      order by quote_items.sort_order, quote_items.id
    )::integer
  from public.quote_items
  where quote_items.room_id = p_room_id;

  return v_template_id;
end;
$$;

create or replace function public.insert_quote_room_template(
  p_quote_id uuid,
  p_template_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_quote public.quotes%rowtype;
  v_template public.quote_room_templates%rowtype;
  v_new_room_id uuid;
  v_next_room_sort_order integer;
  v_last_item_sort_order integer;
begin
  select quotes.*
  into v_quote
  from public.quotes
  where quotes.id = p_quote_id
  for update;

  if not found then
    raise exception 'Devis introuvable.' using errcode = 'P0002';
  end if;

  select quote_room_templates.*
  into v_template
  from public.quote_room_templates
  where quote_room_templates.id = p_template_id
  for share;

  if not found then
    raise exception 'Modèle de pièce introuvable.' using errcode = 'P0002';
  end if;

  if v_template.company_id <> v_quote.company_id then
    raise exception 'Ce modèle appartient à une autre entreprise.'
      using errcode = '42501';
  end if;

  select coalesce(max(quote_rooms.sort_order), 0) + 1
  into v_next_room_sort_order
  from public.quote_rooms
  where quote_rooms.quote_id = p_quote_id;

  insert into public.quote_rooms (
    quote_id,
    owner_user_id,
    name,
    notes,
    sort_order,
    pdf_page_break
  )
  values (
    p_quote_id,
    v_quote.owner_user_id,
    v_template.room_name,
    v_template.notes,
    v_next_room_sort_order,
    v_template.pdf_page_break
  )
  returning id into v_new_room_id;

  select coalesce(max(quote_items.sort_order), 0)
  into v_last_item_sort_order
  from public.quote_items
  where quote_items.quote_id = p_quote_id;

  insert into public.quote_items (
    quote_id,
    room_id,
    owner_user_id,
    item_type,
    category,
    label,
    description,
    unit,
    quantity,
    unit_price_ht,
    tva_rate,
    metadata,
    sort_order
  )
  select
    p_quote_id,
    v_new_room_id,
    v_quote.owner_user_id,
    quote_room_template_items.item_type,
    quote_room_template_items.category,
    quote_room_template_items.label,
    quote_room_template_items.description,
    quote_room_template_items.unit,
    quote_room_template_items.quantity,
    quote_room_template_items.unit_price_ht,
    quote_room_template_items.tva_rate,
    quote_room_template_items.metadata,
    v_last_item_sort_order + row_number() over (
      order by quote_room_template_items.sort_order,
        quote_room_template_items.id
    )::integer
  from public.quote_room_template_items
  where quote_room_template_items.template_id = p_template_id;

  return v_new_room_id;
end;
$$;

revoke all on function public.create_quote_room_template(uuid, text)
  from public, anon;
grant execute on function public.create_quote_room_template(uuid, text)
  to authenticated;

revoke all on function public.insert_quote_room_template(uuid, uuid)
  from public, anon;
grant execute on function public.insert_quote_room_template(uuid, uuid)
  to authenticated;

comment on function public.create_quote_room_template(uuid, text) is
  'Enregistre une pièce et ses lignes comme modèle réutilisable, sans les photos.';

comment on function public.insert_quote_room_template(uuid, uuid) is
  'Ajoute à un devis une nouvelle pièce créée depuis un modèle de la même entreprise.';
