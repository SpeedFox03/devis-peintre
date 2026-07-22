-- Per-company transactional e-mail settings.
-- Resend API keys are stored encrypted with Supabase Vault and are never
-- exposed through the company_email_settings table.

create extension if not exists supabase_vault with schema vault;

create table if not exists public.company_email_settings (
  company_id uuid primary key references public.companies(id) on delete cascade,
  provider text not null default 'resend' check (provider = 'resend'),
  from_name text not null check (char_length(from_name) between 1 and 120),
  from_email text not null check (char_length(from_email) between 3 and 320),
  reply_to_email text check (reply_to_email is null or char_length(reply_to_email) between 3 and 320),
  api_key_secret_id uuid,
  api_key_last_four text check (api_key_last_four is null or char_length(api_key_last_four) = 4),
  enabled boolean not null default false,
  last_tested_at timestamptz,
  last_test_status text check (last_test_status is null or last_test_status in ('success', 'error')),
  last_error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.company_email_settings enable row level security;

drop policy if exists "Company owners can read e-mail settings"
  on public.company_email_settings;

create policy "Company owners can read e-mail settings"
  on public.company_email_settings
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.companies
      where companies.id = company_email_settings.company_id
        and companies.owner_user_id = auth.uid()
    )
  );

revoke all on table public.company_email_settings from anon, authenticated;
grant select (
  company_id,
  provider,
  from_name,
  from_email,
  reply_to_email,
  api_key_last_four,
  enabled,
  last_tested_at,
  last_test_status,
  last_error_message,
  created_at,
  updated_at
) on table public.company_email_settings to authenticated;
grant all on table public.company_email_settings to service_role;

create or replace function public.save_company_email_settings(
  p_company_id uuid,
  p_from_name text,
  p_from_email text,
  p_reply_to_email text,
  p_api_key text,
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_from_name text := btrim(coalesce(p_from_name, ''));
  v_from_email text := lower(btrim(coalesce(p_from_email, '')));
  v_reply_to_email text := nullif(lower(btrim(coalesce(p_reply_to_email, ''))), '');
  v_api_key text := nullif(btrim(coalesce(p_api_key, '')), '');
  v_secret_id uuid;
  v_last_four text;
  v_secret_name text := 'resend_api_key_' || replace(p_company_id::text, '-', '_');
begin
  if v_user_id is null then
    raise exception 'Utilisateur non connecté.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.companies
    where companies.id = p_company_id
      and companies.owner_user_id = v_user_id
  ) then
    raise exception 'Entreprise introuvable ou accès refusé.' using errcode = '42501';
  end if;

  if char_length(v_from_name) < 1 or char_length(v_from_name) > 120
     or v_from_name ~ E'[\\r\\n]' then
    raise exception 'Le nom de l''expéditeur est invalide.' using errcode = '22023';
  end if;

  if v_from_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'L''adresse d''expédition est invalide.' using errcode = '22023';
  end if;

  if v_reply_to_email is not null
     and v_reply_to_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'L''adresse de réponse est invalide.' using errcode = '22023';
  end if;

  select email_settings.api_key_secret_id, email_settings.api_key_last_four
  into v_secret_id, v_last_four
  from public.company_email_settings as email_settings
  where email_settings.company_id = p_company_id;

  if v_api_key is not null then
    if v_api_key !~ '^re_[A-Za-z0-9_-]{12,}$' then
      raise exception 'La clé API Resend est invalide.' using errcode = '22023';
    end if;

    if v_secret_id is null then
      select secrets.id
      into v_secret_id
      from vault.secrets
      where secrets.name = v_secret_name
      limit 1;
    end if;

    if v_secret_id is null then
      v_secret_id := vault.create_secret(
        v_api_key,
        v_secret_name,
        'Clé API Resend de l''entreprise ' || p_company_id::text
      );
    else
      perform vault.update_secret(
        v_secret_id,
        v_api_key,
        v_secret_name,
        'Clé API Resend de l''entreprise ' || p_company_id::text
      );
    end if;

    v_last_four := right(v_api_key, 4);
  end if;

  if coalesce(p_enabled, false) and v_secret_id is null then
    raise exception 'Ajoute une clé API avant d''activer l''envoi.' using errcode = '22023';
  end if;

  insert into public.company_email_settings (
    company_id,
    provider,
    from_name,
    from_email,
    reply_to_email,
    api_key_secret_id,
    api_key_last_four,
    enabled,
    updated_at
  )
  values (
    p_company_id,
    'resend',
    v_from_name,
    v_from_email,
    v_reply_to_email,
    v_secret_id,
    v_last_four,
    coalesce(p_enabled, false),
    now()
  )
  on conflict (company_id) do update
  set provider = excluded.provider,
      from_name = excluded.from_name,
      from_email = excluded.from_email,
      reply_to_email = excluded.reply_to_email,
      api_key_secret_id = excluded.api_key_secret_id,
      api_key_last_four = excluded.api_key_last_four,
      enabled = excluded.enabled,
      updated_at = now();
end;
$$;

revoke all on function public.save_company_email_settings(uuid, text, text, text, text, boolean)
  from public, anon;
grant execute on function public.save_company_email_settings(uuid, text, text, text, text, boolean)
  to authenticated;

create or replace function public.get_company_resend_credentials(p_company_id uuid)
returns table (
  provider text,
  from_name text,
  from_email text,
  reply_to_email text,
  enabled boolean,
  api_key text
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    email_settings.provider,
    email_settings.from_name,
    email_settings.from_email,
    email_settings.reply_to_email,
    email_settings.enabled,
    decrypted.decrypted_secret
  from public.company_email_settings as email_settings
  join vault.decrypted_secrets as decrypted
    on decrypted.id = email_settings.api_key_secret_id
  where email_settings.company_id = p_company_id;
$$;

revoke all on function public.get_company_resend_credentials(uuid)
  from public, anon, authenticated;
grant execute on function public.get_company_resend_credentials(uuid)
  to service_role;

comment on table public.company_email_settings is
  'Configuration d''envoi transactionnel par entreprise. Les clés sont stockées dans Supabase Vault.';
comment on function public.get_company_resend_credentials(uuid) is
  'Réservée aux traitements serveur utilisant la clé service_role.';
