-- Persist the visual position of the virtual "Autre" section.

alter table public.quotes
  add column if not exists pdf_other_section_position integer;

alter table public.quotes
  drop constraint if exists quotes_pdf_other_section_position_check;

alter table public.quotes
  add constraint quotes_pdf_other_section_position_check
  check (
    pdf_other_section_position is null
    or pdf_other_section_position >= 0
  );

comment on column public.quotes.pdf_other_section_position is
  'Position de la section virtuelle Autre parmi les pièces du devis, indexée à partir de zéro.';

create or replace function public.save_quote_editor(
  p_quote_id uuid,
  p_room_order uuid[],
  p_item_order uuid[],
  p_room_page_breaks jsonb,
  p_item_edits jsonb,
  p_other_section_position integer
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_room_count integer;
  v_has_other_section boolean;
begin
  select count(*)
  into v_room_count
  from public.quote_rooms
  where quote_rooms.quote_id = p_quote_id;

  select exists (
    select 1
    from public.quote_items
    where quote_items.quote_id = p_quote_id
      and quote_items.room_id is null
  )
  into v_has_other_section;

  if v_has_other_section and (
    p_other_section_position is null
    or p_other_section_position < 0
    or p_other_section_position > v_room_count
  ) then
    raise exception 'La position de la section Autre est invalide.' using errcode = '22023';
  end if;

  if not v_has_other_section and p_other_section_position is not null then
    raise exception 'Ce devis ne contient pas de section Autre.' using errcode = '22023';
  end if;

  perform public.save_quote_editor(
    p_quote_id,
    p_room_order,
    p_item_order,
    p_room_page_breaks,
    p_item_edits
  );

  update public.quotes
  set pdf_other_section_position = p_other_section_position
  where quotes.id = p_quote_id;
end;
$$;

revoke all on function public.save_quote_editor(
  uuid,
  uuid[],
  uuid[],
  jsonb,
  jsonb,
  integer
) from public, anon;

grant execute on function public.save_quote_editor(
  uuid,
  uuid[],
  uuid[],
  jsonb,
  jsonb,
  integer
) to authenticated;

comment on function public.save_quote_editor(
  uuid,
  uuid[],
  uuid[],
  jsonb,
  jsonb,
  integer
) is
  'Enregistre le devis visuel, y compris la position de la section virtuelle Autre.';
