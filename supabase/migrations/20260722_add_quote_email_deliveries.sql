-- Audit trail for quote e-mails sent through a company's Resend account.

create table if not exists public.quote_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  public_link_id uuid references public.quote_public_links(id) on delete set null,
  company_id uuid not null references public.companies(id) on delete cascade,
  recipient_email text not null check (char_length(recipient_email) between 3 and 320),
  subject text not null check (char_length(subject) between 1 and 300),
  personal_message text check (
    personal_message is null or char_length(personal_message) <= 1000
  ),
  provider text not null default 'resend' check (provider = 'resend'),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  provider_message_id text,
  error_message text check (error_message is null or char_length(error_message) <= 1000),
  initiated_by uuid not null references auth.users(id) on delete restrict,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quote_email_deliveries_quote_id_idx
  on public.quote_email_deliveries(quote_id, created_at desc);

create unique index if not exists quote_email_deliveries_provider_message_id_idx
  on public.quote_email_deliveries(provider_message_id)
  where provider_message_id is not null;

alter table public.quote_email_deliveries enable row level security;

drop policy if exists "Company owners can read quote e-mail deliveries"
  on public.quote_email_deliveries;
create policy "Company owners can read quote e-mail deliveries"
  on public.quote_email_deliveries
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.companies
      where companies.id = quote_email_deliveries.company_id
        and companies.owner_user_id = auth.uid()
    )
  );

revoke all on table public.quote_email_deliveries from anon, authenticated;
grant select on table public.quote_email_deliveries to authenticated;
grant all on table public.quote_email_deliveries to service_role;

create or replace function public.finalize_quote_email_delivery(
  p_delivery_id uuid,
  p_provider_message_id text
)
returns table (
  quote_id uuid,
  sent_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote_id uuid;
  v_sent_at timestamptz := now();
begin
  if nullif(btrim(coalesce(p_provider_message_id, '')), '') is null then
    raise exception 'Identifiant du message manquant.' using errcode = '22023';
  end if;

  update public.quote_email_deliveries
  set status = 'sent',
      provider_message_id = left(btrim(p_provider_message_id), 500),
      error_message = null,
      sent_at = v_sent_at,
      updated_at = v_sent_at
  where id = p_delivery_id
    and status = 'pending'
  returning quote_email_deliveries.quote_id into v_quote_id;

  if v_quote_id is null then
    raise exception 'Envoi de devis introuvable ou déjà finalisé.' using errcode = 'P0002';
  end if;

  update public.quotes
  set status = 'sent'
  where id = v_quote_id
    and status::text in ('draft', 'sent');

  return query select v_quote_id, v_sent_at;
end;
$$;

revoke all on function public.finalize_quote_email_delivery(uuid, text)
  from public, anon, authenticated;
grant execute on function public.finalize_quote_email_delivery(uuid, text)
  to service_role;

comment on table public.quote_email_deliveries is
  'Historique des tentatives d’envoi de devis par e-mail via Resend.';
