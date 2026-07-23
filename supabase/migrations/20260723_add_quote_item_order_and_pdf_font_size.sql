-- Quote-line ordering and per-quote PDF typography adjustment.
-- Existing quotes keep their current line order and normal text size.

alter table public.quotes
  add column if not exists pdf_font_size_adjustment smallint not null default 0;

alter table public.quotes
  drop constraint if exists quotes_pdf_font_size_adjustment_check;

alter table public.quotes
  add constraint quotes_pdf_font_size_adjustment_check
  check (pdf_font_size_adjustment in (-1, 0, 1));

comment on column public.quotes.pdf_font_size_adjustment is
  'Ajustement en points appliqué à toute la typographie du PDF du devis.';

-- Saves the complete room and item order in one transaction. The item room_id is
-- deliberately never changed here: moving an item to another room remains a
-- separate, explicit action in the quote builder.
create or replace function public.save_quote_order(
  p_quote_id uuid,
  p_room_order uuid[],
  p_item_order uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_room_count integer;
  v_item_count integer;
  v_room_offset integer;
  v_item_offset integer;
begin
  if p_quote_id is null or p_room_order is null or p_item_order is null then
    raise exception 'Ordre du devis invalide.' using errcode = '22023';
  end if;

  perform 1
  from public.quotes
  where quotes.id = p_quote_id
  for update;

  if not found then
    raise exception 'Devis introuvable.' using errcode = 'P0002';
  end if;

  select count(*)
  into v_room_count
  from public.quote_rooms
  where quote_rooms.quote_id = p_quote_id;

  select count(*)
  into v_item_count
  from public.quote_items
  where quote_items.quote_id = p_quote_id;

  if cardinality(p_room_order) <> v_room_count
     or cardinality(p_item_order) <> v_item_count then
    raise exception 'La liste à réorganiser est incomplète.' using errcode = '22023';
  end if;

  if (
    select count(distinct room_id)
    from unnest(p_room_order) as room_order(room_id)
  ) <> v_room_count then
    raise exception 'L’ordre des pièces contient un doublon.' using errcode = '22023';
  end if;

  if (
    select count(distinct item_id)
    from unnest(p_item_order) as item_order(item_id)
  ) <> v_item_count then
    raise exception 'L’ordre des lignes contient un doublon.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(p_room_order) as room_order(room_id)
    left join public.quote_rooms
      on quote_rooms.id = room_order.room_id
      and quote_rooms.quote_id = p_quote_id
    where quote_rooms.id is null
  ) then
    raise exception 'Une pièce ne fait pas partie de ce devis.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(p_item_order) as item_order(item_id)
    left join public.quote_items
      on quote_items.id = item_order.item_id
      and quote_items.quote_id = p_quote_id
    where quote_items.id is null
  ) then
    raise exception 'Une ligne ne fait pas partie de ce devis.' using errcode = '22023';
  end if;

  perform 1
  from public.quote_rooms
  where quote_rooms.quote_id = p_quote_id
  order by quote_rooms.id
  for update;

  perform 1
  from public.quote_items
  where quote_items.quote_id = p_quote_id
  order by quote_items.id
  for update;

  select coalesce(max(quote_rooms.sort_order), 0) + v_room_count + 100
  into v_room_offset
  from public.quote_rooms
  where quote_rooms.quote_id = p_quote_id;

  select coalesce(max(quote_items.sort_order), 0) + v_item_count + 100
  into v_item_offset
  from public.quote_items
  where quote_items.quote_id = p_quote_id;

  update public.quote_rooms
  set sort_order = quote_rooms.sort_order + v_room_offset
  where quote_rooms.quote_id = p_quote_id;

  with ordered_rooms as (
    select room_id, ordinality::integer as new_sort_order
    from unnest(p_room_order) with ordinality as room_order(room_id, ordinality)
  )
  update public.quote_rooms
  set sort_order = ordered_rooms.new_sort_order
  from ordered_rooms
  where quote_rooms.id = ordered_rooms.room_id
    and quote_rooms.quote_id = p_quote_id;

  update public.quote_items
  set sort_order = quote_items.sort_order + v_item_offset
  where quote_items.quote_id = p_quote_id;

  with ordered_items as (
    select item_id, ordinality::integer as new_sort_order
    from unnest(p_item_order) with ordinality as item_order(item_id, ordinality)
  )
  update public.quote_items
  set sort_order = ordered_items.new_sort_order
  from ordered_items
  where quote_items.id = ordered_items.item_id
    and quote_items.quote_id = p_quote_id;
end;
$$;

revoke all on function public.save_quote_order(uuid, uuid[], uuid[])
  from public, anon;
grant execute on function public.save_quote_order(uuid, uuid[], uuid[])
  to authenticated;

comment on function public.save_quote_order(uuid, uuid[], uuid[]) is
  'Enregistre atomiquement l’ordre complet des pièces et des lignes sans changer leur rattachement.';
