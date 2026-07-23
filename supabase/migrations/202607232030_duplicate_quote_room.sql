-- Duplicate a quote room and all of its quote lines in one transaction.
-- Photos are intentionally not copied.

create or replace function public.duplicate_quote_room(
  p_room_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_source_room public.quote_rooms%rowtype;
  v_new_room_id uuid;
  v_next_room_sort_order integer;
  v_last_item_sort_order integer;
begin
  select quote_rooms.*
  into v_source_room
  from public.quote_rooms
  where quote_rooms.id = p_room_id
  for update;

  if not found then
    raise exception 'Pièce introuvable.' using errcode = 'P0002';
  end if;

  perform 1
  from public.quote_items
  where quote_items.room_id = p_room_id
  order by quote_items.id
  for share;

  select coalesce(max(quote_rooms.sort_order), 0) + 1
  into v_next_room_sort_order
  from public.quote_rooms
  where quote_rooms.quote_id = v_source_room.quote_id;

  insert into public.quote_rooms (
    quote_id,
    owner_user_id,
    name,
    notes,
    sort_order,
    pdf_page_break
  )
  values (
    v_source_room.quote_id,
    v_source_room.owner_user_id,
    v_source_room.name || ' (copie)',
    v_source_room.notes,
    v_next_room_sort_order,
    v_source_room.pdf_page_break
  )
  returning id into v_new_room_id;

  select coalesce(max(quote_items.sort_order), 0)
  into v_last_item_sort_order
  from public.quote_items
  where quote_items.quote_id = v_source_room.quote_id;

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
    quote_items.quote_id,
    v_new_room_id,
    quote_items.owner_user_id,
    quote_items.item_type,
    quote_items.category,
    quote_items.label,
    quote_items.description,
    quote_items.unit,
    quote_items.quantity,
    quote_items.unit_price_ht,
    quote_items.tva_rate,
    quote_items.metadata,
    v_last_item_sort_order + row_number() over (
      order by quote_items.sort_order, quote_items.id
    )::integer
  from public.quote_items
  where quote_items.room_id = p_room_id;

  return v_new_room_id;
end;
$$;

revoke all on function public.duplicate_quote_room(uuid)
  from public, anon;
grant execute on function public.duplicate_quote_room(uuid)
  to authenticated;

comment on function public.duplicate_quote_room(uuid) is
  'Duplique une pièce, ses notes, sa pagination et toutes ses lignes, sans copier ses photos.';
