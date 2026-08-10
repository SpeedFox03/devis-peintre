-- Expose uniquement les réglages e-mail non sensibles au propriétaire.
-- La table reste inaccessible directement et l'identifiant Vault n'est jamais renvoyé.

create or replace function public.get_company_email_settings(
  p_company_id uuid
)
returns table (
  provider text,
  from_name text,
  from_email text,
  reply_to_email text,
  api_key_last_four text,
  enabled boolean,
  last_tested_at timestamptz,
  last_test_status text,
  last_error_message text,
  subject_template text,
  heading text,
  intro_text text,
  button_label text,
  signature text,
  primary_color text,
  background_color text,
  show_logo boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    email_settings.provider,
    email_settings.from_name,
    email_settings.from_email,
    email_settings.reply_to_email,
    email_settings.api_key_last_four,
    email_settings.enabled,
    email_settings.last_tested_at,
    email_settings.last_test_status,
    email_settings.last_error_message,
    email_settings.subject_template,
    email_settings.heading,
    email_settings.intro_text,
    email_settings.button_label,
    email_settings.signature,
    email_settings.primary_color,
    email_settings.background_color,
    email_settings.show_logo
  from public.company_email_settings as email_settings
  where email_settings.company_id = p_company_id
    and exists (
      select 1
      from public.companies
      where companies.id = p_company_id
        and companies.owner_user_id = auth.uid()
    );
$$;

revoke all on function public.get_company_email_settings(uuid)
from public, anon;
grant execute on function public.get_company_email_settings(uuid)
to authenticated;

comment on function public.get_company_email_settings(uuid) is
  'Renvoie au propriétaire les réglages e-mail non sensibles de son entreprise.';
