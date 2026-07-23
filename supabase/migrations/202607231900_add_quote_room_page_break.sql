-- Per-room PDF pagination controls for the quote layout editor.

alter table public.quote_rooms
  add column if not exists pdf_page_break text not null default 'auto';

alter table public.quote_rooms
  drop constraint if exists quote_rooms_pdf_page_break_check;

alter table public.quote_rooms
  add constraint quote_rooms_pdf_page_break_check
  check (pdf_page_break in ('auto', 'keep', 'before'));

comment on column public.quote_rooms.pdf_page_break is
  'Contrôle PDF de la pièce : auto, garder ensemble, ou commencer sur une nouvelle page.';

create or replace function public.save_quote_layout(
  p_quote_id uuid,
  p_room_order uuid[],
  p_item_order uuid[],
  p_room_page_breaks jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_room_count integer;
begin
  if p_room_page_breaks is null
     or jsonb_typeof(p_room_page_breaks) <> 'object' then
    raise exception 'Réglages de pagination invalides.' using errcode = '22023';
  end if;

  select count(*)
  into v_room_count
  from public.quote_rooms
  where quote_rooms.quote_id = p_quote_id;

  if (
    select count(*)
    from jsonb_object_keys(p_room_page_breaks)
  ) <> v_room_count then
    raise exception 'Les réglages de pagination sont incomplets.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_each_text(p_room_page_breaks) as setting(room_id, behavior)
    left join public.quote_rooms
      on quote_rooms.id::text = setting.room_id
      and quote_rooms.quote_id = p_quote_id
    where quote_rooms.id is null
       or setting.behavior is null
       or setting.behavior not in ('auto', 'keep', 'before')
  ) then
    raise exception 'Un réglage de pagination est invalide.' using errcode = '22023';
  end if;

  perform public.save_quote_order(
    p_quote_id,
    p_room_order,
    p_item_order
  );

  update public.quote_rooms
  set pdf_page_break = p_room_page_breaks ->> quote_rooms.id::text
  where quote_rooms.quote_id = p_quote_id;
end;
$$;

revoke all on function public.save_quote_layout(uuid, uuid[], uuid[], jsonb)
  from public, anon;
grant execute on function public.save_quote_layout(uuid, uuid[], uuid[], jsonb)
  to authenticated;

comment on function public.save_quote_layout(uuid, uuid[], uuid[], jsonb) is
  'Enregistre atomiquement l’ordre du devis et les réglages de pagination de chaque pièce.';
