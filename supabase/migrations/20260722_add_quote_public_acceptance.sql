-- Public, expiring quote links and append-only client responses.
-- Only a SHA-256 digest of the bearer token is stored.

create table if not exists public.quote_public_links (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  recipient_email text,
  quote_snapshot jsonb not null,
  snapshot_sha256 text not null check (snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  view_count integer not null default 0 check (view_count >= 0),
  last_viewed_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists quote_public_links_quote_id_idx
  on public.quote_public_links(quote_id);
create index if not exists quote_public_links_active_idx
  on public.quote_public_links(quote_id, expires_at)
  where revoked_at is null and used_at is null;

create table if not exists public.quote_responses (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  public_link_id uuid not null unique references public.quote_public_links(id) on delete restrict,
  decision text not null default 'accepted'
    check (decision in ('accepted', 'changes_requested', 'rejected')),
  comment text check (comment is null or char_length(comment) <= 2000),
  user_agent text check (user_agent is null or char_length(user_agent) <= 500),
  responded_at timestamptz not null default now()
);

create index if not exists quote_responses_quote_id_idx
  on public.quote_responses(quote_id, responded_at desc);

alter table public.quote_public_links enable row level security;
alter table public.quote_responses enable row level security;

drop policy if exists "Company owners can read public quote links"
  on public.quote_public_links;
create policy "Company owners can read public quote links"
  on public.quote_public_links
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.companies
      where companies.id = quote_public_links.company_id
        and companies.owner_user_id = auth.uid()
    )
  );

drop policy if exists "Company owners can read quote responses"
  on public.quote_responses;
create policy "Company owners can read quote responses"
  on public.quote_responses
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.quotes
      join public.companies on companies.id = quotes.company_id
      where quotes.id = quote_responses.quote_id
        and companies.owner_user_id = auth.uid()
    )
  );

revoke all on table public.quote_public_links from anon, authenticated;
grant select (
  id,
  quote_id,
  company_id,
  customer_id,
  recipient_email,
  snapshot_sha256,
  expires_at,
  used_at,
  revoked_at,
  view_count,
  last_viewed_at,
  created_at
) on table public.quote_public_links to authenticated;
grant all on table public.quote_public_links to service_role;

revoke all on table public.quote_responses from anon, authenticated;
grant select on table public.quote_responses to authenticated;
grant all on table public.quote_responses to service_role;

create or replace function public.accept_quote_with_public_token(
  p_token_hash text,
  p_comment text,
  p_user_agent text
)
returns table (
  response_id uuid,
  quote_id uuid,
  quote_number text,
  accepted_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.quote_public_links%rowtype;
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

  if v_comment is not null and char_length(v_comment) > 2000 then
    raise exception 'Le commentaire ne peut pas dépasser 2000 caractères.' using errcode = '22023';
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
    raise exception 'Ce devis ne peut plus être accepté.' using errcode = '22023';
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
    'accepted',
    v_comment,
    v_user_agent,
    v_now
  )
  returning id into v_response_id;

  update public.quotes
  set status = 'accepted'
  where id = v_link.quote_id;

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
  select v_response_id, v_link.quote_id, v_quote_number, v_now;
end;
$$;

revoke all on function public.accept_quote_with_public_token(text, text, text)
  from public, anon, authenticated;
grant execute on function public.accept_quote_with_public_token(text, text, text)
  to service_role;

comment on table public.quote_public_links is
  'Liens publics à jeton opaque, expirants et révocables, contenant un snapshot immuable du devis.';
comment on table public.quote_responses is
  'Historique immuable des décisions prises depuis les liens publics de devis.';
