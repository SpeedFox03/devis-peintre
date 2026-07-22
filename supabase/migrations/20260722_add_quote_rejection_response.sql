-- Allows a client to accept or reject a public quote.
-- A rejection always requires an explicit reason.

alter table public.quote_responses
  drop constraint if exists quote_responses_rejection_reason_required;

alter table public.quote_responses
  add constraint quote_responses_rejection_reason_required
  check (
    decision <> 'rejected'
    or (comment is not null and char_length(btrim(comment)) >= 3)
  );

create or replace function public.respond_to_quote_with_public_token(
  p_token_hash text,
  p_decision text,
  p_comment text,
  p_user_agent text
)
returns table (
  response_id uuid,
  quote_id uuid,
  quote_number text,
  decision text,
  responded_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.quote_public_links%rowtype;
  v_decision text := lower(btrim(coalesce(p_decision, '')));
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
  v_user_agent text := nullif(left(btrim(coalesce(p_user_agent, '')), 500), '');
  v_quote_number text;
  v_quote_status text;
  v_response_id uuid;
  v_now timestamptz := now();
begin
  if coalesce(p_token_hash, '') !~ '^[0-9a-f]{64}$' then
    raise exception 'Lien de devis invalide.' using errcode = '22023';
  end if;

  if v_decision not in ('accepted', 'rejected') then
    raise exception 'La réponse au devis est invalide.' using errcode = '22023';
  end if;

  if v_comment is not null and char_length(v_comment) > 2000 then
    raise exception 'Le commentaire ne peut pas dépasser 2000 caractères.' using errcode = '22023';
  end if;

  if v_decision = 'rejected'
     and (v_comment is null or char_length(v_comment) < 3) then
    raise exception 'Le motif du refus est obligatoire (3 caractères minimum).' using errcode = '22023';
  end if;

  select links.*
  into v_link
  from public.quote_public_links as links
  where links.token_hash = p_token_hash
  for update;

  if not found then
    raise exception 'Lien de devis introuvable.' using errcode = 'P0002';
  end if;

  if v_link.revoked_at is not null then
    raise exception 'Ce lien a été révoqué.' using errcode = '22023';
  end if;

  if v_link.expires_at <= v_now then
    raise exception 'Ce lien a expiré.' using errcode = '22023';
  end if;

  if v_link.used_at is not null then
    raise exception 'Ce devis a déjà reçu une réponse.' using errcode = '22023';
  end if;

  select quotes.quote_number, quotes.status::text
  into v_quote_number, v_quote_status
  from public.quotes
  where quotes.id = v_link.quote_id
  for update;

  if not found then
    raise exception 'Devis introuvable.' using errcode = 'P0002';
  end if;

  if v_quote_status not in ('draft', 'sent') then
    raise exception 'Ce devis ne peut plus recevoir de réponse.' using errcode = '22023';
  end if;

  insert into public.quote_responses (
    quote_id,
    public_link_id,
    decision,
    comment,
    user_agent,
    responded_at
  )
  values (
    v_link.quote_id,
    v_link.id,
    v_decision,
    v_comment,
    v_user_agent,
    v_now
  )
  returning id into v_response_id;

  if v_decision = 'accepted' then
    update public.quotes
    set status = 'accepted'
    where id = v_link.quote_id;
  else
    update public.quotes
    set status = 'rejected'
    where id = v_link.quote_id;
  end if;

  update public.quote_public_links
  set used_at = v_now
  where id = v_link.id;

  update public.quote_public_links
  set revoked_at = v_now
  where quote_public_links.quote_id = v_link.quote_id
    and quote_public_links.id <> v_link.id
    and quote_public_links.revoked_at is null
    and quote_public_links.used_at is null;

  return query
  select v_response_id, v_link.quote_id, v_quote_number, v_decision, v_now;
end;
$$;

revoke all on function public.respond_to_quote_with_public_token(text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.respond_to_quote_with_public_token(text, text, text, text)
  to service_role;

comment on function public.respond_to_quote_with_public_token(text, text, text, text) is
  'Enregistre atomiquement l’acceptation ou le refus motivé d’un devis public.';
