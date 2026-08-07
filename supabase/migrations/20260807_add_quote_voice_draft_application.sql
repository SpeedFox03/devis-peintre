-- Applies a validated voice-assistant draft to a quote in one transaction.
-- Prices, VAT, labels and units are always reloaded from the authenticated
-- user's service catalog. The draft id makes retries idempotent.

create table if not exists public.quote_voice_rate_limits (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  window_started_at timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (owner_user_id, window_started_at)
);

alter table public.quote_voice_rate_limits enable row level security;
revoke all on table public.quote_voice_rate_limits
  from public, anon, authenticated;

create or replace function public.reserve_quote_voice_request(
  p_quote_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_window_started_at timestamptz := date_trunc('hour', now());
  v_request_count integer;
begin
  if v_user_id is null then
    raise exception 'Utilisateur non connecté.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.quotes
    where quotes.id = p_quote_id
      and quotes.owner_user_id = v_user_id
      and quotes.status in ('draft', 'sent')
  ) then
    raise exception 'Devis introuvable ou non modifiable.'
      using errcode = '42501';
  end if;

  insert into public.quote_voice_rate_limits (
    owner_user_id,
    window_started_at,
    request_count,
    updated_at
  )
  values (
    v_user_id,
    v_window_started_at,
    1,
    now()
  )
  on conflict (owner_user_id, window_started_at)
  do update
  set request_count = quote_voice_rate_limits.request_count + 1,
      updated_at = now()
  where quote_voice_rate_limits.request_count < 30
  returning request_count into v_request_count;

  if v_request_count is null then
    raise exception
      'Limite atteinte : réessayez dans moins d’une heure.'
      using errcode = 'P0001';
  end if;

  delete from public.quote_voice_rate_limits
  where quote_voice_rate_limits.owner_user_id = v_user_id
    and quote_voice_rate_limits.window_started_at < now() - interval '31 days';
end;
$$;

revoke all on function public.reserve_quote_voice_request(uuid)
  from public, anon;
grant execute on function public.reserve_quote_voice_request(uuid)
  to authenticated;

comment on function public.reserve_quote_voice_request(uuid) is
  'Réserve un appel de dictée et limite chaque utilisateur à 30 analyses par heure.';

create table if not exists public.quote_voice_operations (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (owner_user_id, draft_id)
);

alter table public.quote_voice_operations enable row level security;

drop policy if exists "quote_voice_operations_select_own"
  on public.quote_voice_operations;
create policy "quote_voice_operations_select_own"
  on public.quote_voice_operations
  for select
  to authenticated
  using (owner_user_id = auth.uid());

drop policy if exists "quote_voice_operations_insert_own"
  on public.quote_voice_operations;
create policy "quote_voice_operations_insert_own"
  on public.quote_voice_operations
  for insert
  to authenticated
  with check (
    owner_user_id = auth.uid()
    and exists (
      select 1
      from public.quotes
      where quotes.id = quote_voice_operations.quote_id
        and quotes.owner_user_id = auth.uid()
    )
  );

revoke all on table public.quote_voice_operations from public, anon;
grant select, insert on public.quote_voice_operations to authenticated;

create or replace function public.apply_quote_voice_draft(
  p_quote_id uuid,
  p_draft_id uuid,
  p_rooms jsonb,
  p_items jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_quote public.quotes%rowtype;
  v_existing_operation public.quote_voice_operations%rowtype;
  v_room jsonb;
  v_item jsonb;
  v_room_key text;
  v_room_name text;
  v_room_notes text;
  v_room_action text;
  v_room_id uuid;
  v_existing_room_id uuid;
  v_service_id uuid;
  v_service public.service_catalog%rowtype;
  v_item_id uuid;
  v_quantity numeric;
  v_requested_coats integer;
  v_source_excerpt text;
  v_description text;
  v_next_room_sort_order integer;
  v_next_item_sort_order integer;
  v_room_map jsonb := '{}'::jsonb;
  v_room_ids jsonb := '[]'::jsonb;
  v_item_ids jsonb := '[]'::jsonb;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Utilisateur non connecté.' using errcode = '42501';
  end if;

  if p_quote_id is null or p_draft_id is null then
    raise exception 'Brouillon vocal invalide.' using errcode = '22023';
  end if;

  if jsonb_typeof(coalesce(p_rooms, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' then
    raise exception 'Structure du brouillon invalide.' using errcode = '22023';
  end if;

  if jsonb_array_length(coalesce(p_rooms, '[]'::jsonb)) > 20
     or jsonb_array_length(coalesce(p_items, '[]'::jsonb)) > 50 then
    raise exception 'Le brouillon contient trop de pièces ou de lignes.'
      using errcode = '22023';
  end if;

  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'Sélectionnez au moins une ligne.' using errcode = '22023';
  end if;

  select quotes.*
  into v_quote
  from public.quotes
  where quotes.id = p_quote_id
    and quotes.owner_user_id = v_user_id
  for update;

  if not found then
    raise exception 'Devis introuvable ou accès refusé.' using errcode = '42501';
  end if;

  if v_quote.status not in ('draft', 'sent') then
    raise exception 'Ce devis ne peut plus recevoir de nouvelles lignes.'
      using errcode = '22023';
  end if;

  select quote_voice_operations.*
  into v_existing_operation
  from public.quote_voice_operations
  where quote_voice_operations.owner_user_id = v_user_id
    and quote_voice_operations.draft_id = p_draft_id;

  if found then
    if v_existing_operation.quote_id <> p_quote_id then
      raise exception 'Ce brouillon a déjà été utilisé pour un autre devis.'
        using errcode = '22023';
    end if;

    return v_existing_operation.result
      || jsonb_build_object('already_applied', true);
  end if;

  select coalesce(max(quote_rooms.sort_order), 0)
  into v_next_room_sort_order
  from public.quote_rooms
  where quote_rooms.quote_id = p_quote_id;

  for v_room in
    select value
    from jsonb_array_elements(coalesce(p_rooms, '[]'::jsonb))
  loop
    v_room_key := left(btrim(coalesce(v_room ->> 'key', '')), 80);
    v_room_action := coalesce(v_room ->> 'action', '');

    if v_room_key = '' then
      raise exception 'Une clé de pièce est manquante.' using errcode = '22023';
    end if;

    if v_room_map ? v_room_key then
      raise exception 'Le brouillon contient deux fois la même pièce.'
        using errcode = '22023';
    end if;

    if v_room_action = 'reuse' then
      begin
        v_existing_room_id := nullif(v_room ->> 'existing_room_id', '')::uuid;
      exception
        when invalid_text_representation then
          raise exception 'Identifiant de pièce existante invalide.'
            using errcode = '22023';
      end;

      select quote_rooms.id
      into v_room_id
      from public.quote_rooms
      where quote_rooms.id = v_existing_room_id
        and quote_rooms.quote_id = p_quote_id
      for share;

      if not found then
        raise exception 'Une pièce sélectionnée ne fait pas partie du devis.'
          using errcode = '22023';
      end if;
    elsif v_room_action = 'create' then
      v_room_name := left(btrim(coalesce(v_room ->> 'name', '')), 120);
      v_room_notes := nullif(left(btrim(coalesce(v_room ->> 'notes', '')), 500), '');

      if v_room_name = '' then
        raise exception 'Le nom de la nouvelle pièce est obligatoire.'
          using errcode = '22023';
      end if;

      v_next_room_sort_order := v_next_room_sort_order + 1;

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
        v_room_name,
        v_room_notes,
        v_next_room_sort_order,
        'auto'
      )
      returning id into v_room_id;

      v_room_ids := v_room_ids || jsonb_build_array(v_room_id);
    else
      raise exception 'Action de pièce invalide.' using errcode = '22023';
    end if;

    v_room_map := v_room_map || jsonb_build_object(v_room_key, v_room_id);
  end loop;

  select coalesce(max(quote_items.sort_order), 0)
  into v_next_item_sort_order
  from public.quote_items
  where quote_items.quote_id = p_quote_id;

  for v_item in
    select value
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    begin
      v_service_id := nullif(v_item ->> 'service_catalog_id', '')::uuid;
    exception
      when invalid_text_representation then
        raise exception 'Identifiant de prestation invalide.'
          using errcode = '22023';
    end;

    select service_catalog.*
    into v_service
    from public.service_catalog
    where service_catalog.id = v_service_id
      and service_catalog.owner_user_id = v_user_id
      and service_catalog.is_active = true
    for share;

    if not found then
      raise exception 'Une prestation n’existe plus dans le catalogue actif.'
        using errcode = '22023';
    end if;

    begin
      v_quantity := nullif(v_item ->> 'quantity', '')::numeric;
    exception
      when invalid_text_representation or numeric_value_out_of_range then
        raise exception 'Quantité de ligne invalide.' using errcode = '22023';
    end;

    if v_quantity is null or v_quantity <= 0 or v_quantity > 1000000 then
      raise exception 'La quantité doit être supérieure à zéro.'
        using errcode = '22023';
    end if;

    begin
      v_requested_coats :=
        nullif(v_item ->> 'requested_coats', '')::integer;
    exception
      when invalid_text_representation or numeric_value_out_of_range then
        raise exception 'Nombre de couches invalide.' using errcode = '22023';
    end;

    if v_requested_coats is not null
       and (v_requested_coats <= 0 or v_requested_coats > 20) then
      raise exception 'Le nombre de couches doit être compris entre 1 et 20.'
        using errcode = '22023';
    end if;

    v_room_key := nullif(left(btrim(coalesce(v_item ->> 'room_key', '')), 80), '');
    if v_room_key is null then
      v_room_id := null;
    else
      begin
        v_room_id := nullif(v_room_map ->> v_room_key, '')::uuid;
      exception
        when invalid_text_representation then
          raise exception 'Référence de pièce invalide.' using errcode = '22023';
      end;

      if v_room_id is null then
        raise exception 'La pièce d’une ligne n’a pas été trouvée.'
          using errcode = '22023';
      end if;
    end if;

    v_source_excerpt :=
      nullif(left(btrim(coalesce(v_item ->> 'source_excerpt', '')), 300), '');
    v_description := nullif(btrim(coalesce(v_service.default_description, '')), '');

    if v_requested_coats is not null
       and lower(v_service.name || ' ' || coalesce(v_description, ''))
         !~ ('(^|[^0-9])' || v_requested_coats::text || '[[:space:]]*couche') then
      v_description := concat_ws(
        ' ',
        v_description,
        v_requested_coats::text || ' couche'
          || case when v_requested_coats > 1 then 's' else '' end
          || ' prévue'
          || case when v_requested_coats > 1 then 's' else '' end
          || '.'
      );
    end if;

    v_next_item_sort_order := v_next_item_sort_order + 1;

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
    values (
      p_quote_id,
      v_room_id,
      v_quote.owner_user_id,
      'service',
      v_service.category,
      v_service.name,
      v_description,
      v_service.default_unit,
      v_quantity,
      v_service.default_unit_price_ht,
      v_service.default_tva_rate,
      jsonb_build_object(
        'source', 'voice_assistant',
        'voice_draft_id', p_draft_id,
        'source_excerpt', v_source_excerpt,
        'requested_coats', v_requested_coats,
        'service_catalog_id', v_service.id,
        'service_catalog_snapshot', jsonb_build_object(
          'name', v_service.name,
          'category', v_service.category,
          'default_unit', v_service.default_unit,
          'default_unit_price_ht', v_service.default_unit_price_ht,
          'default_tva_rate', v_service.default_tva_rate
        )
      ),
      v_next_item_sort_order
    )
    returning id into v_item_id;

    v_item_ids := v_item_ids || jsonb_build_array(v_item_id);
  end loop;

  v_result := jsonb_build_object(
    'draft_id', p_draft_id,
    'room_ids', v_room_ids,
    'item_ids', v_item_ids,
    'already_applied', false
  );

  insert into public.quote_voice_operations (
    draft_id,
    quote_id,
    owner_user_id,
    result
  )
  values (
    p_draft_id,
    p_quote_id,
    v_user_id,
    v_result
  );

  return v_result;
end;
$$;

revoke all on function public.apply_quote_voice_draft(uuid, uuid, jsonb, jsonb)
  from public, anon;
grant execute on function public.apply_quote_voice_draft(uuid, uuid, jsonb, jsonb)
  to authenticated;

comment on function public.apply_quote_voice_draft(uuid, uuid, jsonb, jsonb) is
  'Crée atomiquement les pièces et lignes validées d’un brouillon vocal en rechargeant toute la tarification depuis le catalogue.';
