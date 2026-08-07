-- Restreint l'accès à l'application à une liste blanche d'adresses e-mail
-- pendant la phase de test.
--
-- Deux garanties :
--   1. Aucun compte ne peut être créé (formulaire, API ou dashboard) si son
--      adresse n'est pas dans public.auth_allowed_emails.
--   2. Une adresse retirée de la liste perd l'accès à la prochaine
--      vérification de session côté application.
--
-- Les comptes déjà existants sont ajoutés automatiquement à la liste pour
-- éviter de couper l'accès au moment d'appliquer cette migration.

create table if not exists public.auth_allowed_emails (
  email text primary key,
  note text,
  created_at timestamptz not null default now()
);

comment on table public.auth_allowed_emails is
  'Adresses e-mail autorisées à créer un compte et à se connecter pendant la phase de test.';

alter table public.auth_allowed_emails enable row level security;
revoke all on table public.auth_allowed_emails
  from public, anon, authenticated;

-- Normalise les adresses saisies à la main depuis le dashboard Supabase :
-- casse, espaces superflus et validation minimale.
create or replace function public.normalize_auth_allowed_email()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.email := lower(btrim(coalesce(new.email, '')));

  if new.email = '' or position('@' in new.email) = 0 then
    raise exception 'Adresse e-mail invalide.' using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists normalize_auth_allowed_email
  on public.auth_allowed_emails;
create trigger normalize_auth_allowed_email
  before insert or update on public.auth_allowed_emails
  for each row
  execute function public.normalize_auth_allowed_email();

-- Autorise d'office les comptes qui existent déjà.
insert into public.auth_allowed_emails (email, note)
select
  lower(btrim(users.email)),
  'Compte existant à la mise en place de la liste blanche'
from auth.users
where users.email is not null
  and btrim(users.email) <> ''
on conflict (email) do nothing;

create or replace function public.is_email_allowed(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.auth_allowed_emails
    where auth_allowed_emails.email = lower(btrim(coalesce(p_email, '')))
  );
$$;

revoke all on function public.is_email_allowed(text)
  from public, anon, authenticated;

comment on function public.is_email_allowed(text) is
  'Indique si une adresse e-mail figure dans la liste blanche d''accès.';

-- Barrière à la création de compte, quel que soit le chemin utilisé.
create or replace function public.enforce_auth_email_allowlist()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_email_allowed(new.email) then
    raise exception
      'Inscription refusée : cette adresse e-mail n''est pas autorisée.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_auth_email_allowlist on auth.users;
create trigger enforce_auth_email_allowlist
  before insert on auth.users
  for each row
  execute function public.enforce_auth_email_allowlist();

-- Vérifiée par l'application à chaque chargement de session : permet de
-- révoquer un accès en supprimant simplement la ligne correspondante.
create or replace function public.current_user_is_allowed()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_email_allowed(auth.jwt() ->> 'email');
$$;

revoke all on function public.current_user_is_allowed() from public, anon;
grant execute on function public.current_user_is_allowed() to authenticated;

comment on function public.current_user_is_allowed() is
  'Indique si l''utilisateur connecté figure toujours dans la liste blanche d''accès.';
