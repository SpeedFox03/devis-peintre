-- Personnalisation additive des e-mails de devis par entreprise.
-- Les identifiants Resend existants et les historiques d'envoi restent inchangés.

alter table public.company_email_settings
  add column if not exists subject_template text not null
    default 'Votre devis {{quote_number}} – {{company_name}}',
  add column if not exists heading text not null
    default 'Votre devis est prêt',
  add column if not exists intro_text text not null
    default '{{company_name}} vous invite à consulter son devis en ligne.',
  add column if not exists button_label text not null
    default 'Consulter et répondre au devis',
  add column if not exists signature text not null
    default 'Merci pour votre confiance.',
  add column if not exists primary_color text not null
    default '#6f523c',
  add column if not exists background_color text not null
    default '#f6efe6',
  add column if not exists show_logo boolean not null
    default true;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'company_email_settings_subject_template_check'
      and conrelid = 'public.company_email_settings'::regclass
  ) then
    alter table public.company_email_settings
      add constraint company_email_settings_subject_template_check
      check (char_length(subject_template) between 1 and 200);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'company_email_settings_heading_check'
      and conrelid = 'public.company_email_settings'::regclass
  ) then
    alter table public.company_email_settings
      add constraint company_email_settings_heading_check
      check (char_length(heading) between 1 and 120);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'company_email_settings_intro_text_check'
      and conrelid = 'public.company_email_settings'::regclass
  ) then
    alter table public.company_email_settings
      add constraint company_email_settings_intro_text_check
      check (char_length(intro_text) between 1 and 600);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'company_email_settings_button_label_check'
      and conrelid = 'public.company_email_settings'::regclass
  ) then
    alter table public.company_email_settings
      add constraint company_email_settings_button_label_check
      check (char_length(button_label) between 1 and 60);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'company_email_settings_signature_check'
      and conrelid = 'public.company_email_settings'::regclass
  ) then
    alter table public.company_email_settings
      add constraint company_email_settings_signature_check
      check (char_length(signature) <= 300);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'company_email_settings_primary_color_check'
      and conrelid = 'public.company_email_settings'::regclass
  ) then
    alter table public.company_email_settings
      add constraint company_email_settings_primary_color_check
      check (primary_color ~ '^#[0-9A-Fa-f]{6}$');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'company_email_settings_background_color_check'
      and conrelid = 'public.company_email_settings'::regclass
  ) then
    alter table public.company_email_settings
      add constraint company_email_settings_background_color_check
      check (background_color ~ '^#[0-9A-Fa-f]{6}$');
  end if;
end
$$;

create or replace function public.save_company_email_branding(
  p_company_id uuid,
  p_subject_template text,
  p_heading text,
  p_intro_text text,
  p_button_label text,
  p_signature text,
  p_primary_color text,
  p_background_color text,
  p_show_logo boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_subject_template text := btrim(coalesce(p_subject_template, ''));
  v_heading text := btrim(coalesce(p_heading, ''));
  v_intro_text text := btrim(coalesce(p_intro_text, ''));
  v_button_label text := btrim(coalesce(p_button_label, ''));
  v_signature text := btrim(coalesce(p_signature, ''));
  v_primary_color text := lower(btrim(coalesce(p_primary_color, '')));
  v_background_color text := lower(btrim(coalesce(p_background_color, '')));
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

  if char_length(v_subject_template) < 1 or char_length(v_subject_template) > 200 then
    raise exception 'L''objet de l''e-mail est invalide.' using errcode = '22023';
  end if;
  if char_length(v_heading) < 1 or char_length(v_heading) > 120 then
    raise exception 'Le titre de l''e-mail est invalide.' using errcode = '22023';
  end if;
  if char_length(v_intro_text) < 1 or char_length(v_intro_text) > 600 then
    raise exception 'Le texte d''introduction est invalide.' using errcode = '22023';
  end if;
  if char_length(v_button_label) < 1 or char_length(v_button_label) > 60 then
    raise exception 'Le libellé du bouton est invalide.' using errcode = '22023';
  end if;
  if char_length(v_signature) > 300 then
    raise exception 'La signature est trop longue.' using errcode = '22023';
  end if;
  if v_primary_color !~ '^#[0-9a-f]{6}$'
     or v_background_color !~ '^#[0-9a-f]{6}$' then
    raise exception 'Une couleur d''e-mail est invalide.' using errcode = '22023';
  end if;

  update public.company_email_settings
  set subject_template = v_subject_template,
      heading = v_heading,
      intro_text = v_intro_text,
      button_label = v_button_label,
      signature = v_signature,
      primary_color = v_primary_color,
      background_color = v_background_color,
      show_logo = coalesce(p_show_logo, true),
      updated_at = now()
  where company_email_settings.company_id = p_company_id;

  if not found then
    raise exception 'Enregistre d''abord la connexion au compte d''envoi.' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.save_company_email_branding(
  uuid, text, text, text, text, text, text, text, boolean
) from public, anon;
grant execute on function public.save_company_email_branding(
  uuid, text, text, text, text, text, text, text, boolean
) to authenticated;

comment on function public.save_company_email_branding(
  uuid, text, text, text, text, text, text, text, boolean
) is 'Enregistre le contenu et le design des e-mails de devis pour l’entreprise connectée.';
