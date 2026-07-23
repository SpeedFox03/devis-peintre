-- Atomic save for the visual quote editor, including inline item edits.

create or replace function public.save_quote_editor(
  p_quote_id uuid,
  p_room_order uuid[],
  p_item_order uuid[],
  p_room_page_breaks jsonb,
  p_item_edits jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item_count integer;
  v_updated_count integer;
begin
  if p_item_edits is null
     or jsonb_typeof(p_item_edits) <> 'object' then
    raise exception 'Modifications de lignes invalides.' using errcode = '22023';
  end if;

  select count(*)
  into v_item_count
  from public.quote_items
  where quote_items.quote_id = p_quote_id;

  if (
    select count(*)
    from jsonb_object_keys(p_item_edits)
  ) <> v_item_count then
    raise exception 'Les modifications de lignes sont incomplètes.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_each(p_item_edits) as edit(item_id, payload)
    left join public.quote_items
      on quote_items.id::text = edit.item_id
      and quote_items.quote_id = p_quote_id
    where quote_items.id is null
       or jsonb_typeof(edit.payload) <> 'object'
       or nullif(btrim(edit.payload ->> 'label'), '') is null
  ) then
    raise exception 'Une ligne modifiée est invalide.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_each(p_item_edits) as edit(item_id, payload)
    where jsonb_typeof(edit.payload -> 'quantity') is distinct from 'number'
       or jsonb_typeof(edit.payload -> 'unit_price_ht') is distinct from 'number'
  ) then
    raise exception 'Une quantité ou un prix est invalide.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_each(p_item_edits) as edit(item_id, payload)
    where (edit.payload ->> 'quantity')::numeric < 0
       or (edit.payload ->> 'unit_price_ht')::numeric < 0
  ) then
    raise exception 'Une quantité ou un prix ne peut pas être négatif.' using errcode = '22023';
  end if;

  perform public.save_quote_layout(
    p_quote_id,
    p_room_order,
    p_item_order,
    p_room_page_breaks
  );

  update public.quote_items
  set
    label = btrim(edit.payload ->> 'label'),
    quantity = (edit.payload ->> 'quantity')::numeric,
    unit_price_ht = (edit.payload ->> 'unit_price_ht')::numeric
  from jsonb_each(p_item_edits) as edit(item_id, payload)
  where quote_items.id::text = edit.item_id
    and quote_items.quote_id = p_quote_id;

  get diagnostics v_updated_count = row_count;

  if v_updated_count <> v_item_count then
    raise exception 'Toutes les lignes n’ont pas pu être enregistrées.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.save_quote_editor(
  uuid,
  uuid[],
  uuid[],
  jsonb,
  jsonb
) from public, anon;

grant execute on function public.save_quote_editor(
  uuid,
  uuid[],
  uuid[],
  jsonb,
  jsonb
) to authenticated;

comment on function public.save_quote_editor(
  uuid,
  uuid[],
  uuid[],
  jsonb,
  jsonb
) is
  'Enregistre atomiquement le contenu éditable, l’ordre et la pagination du devis.';
