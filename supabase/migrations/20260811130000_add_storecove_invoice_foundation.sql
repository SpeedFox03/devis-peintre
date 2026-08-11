begin;

-- Nouveau domaine de facturation. Les tables historiques invoices* restent
-- intactes et ne sont pas utilisées par cette fondation.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'einvoicing_environment') then
    create type public.einvoicing_environment as enum ('sandbox', 'production');
  end if;
  if not exists (select 1 from pg_type where typname = 'einvoicing_connection_status') then
    create type public.einvoicing_connection_status as enum (
      'not_configured',
      'pending_validation',
      'active',
      'suspended',
      'error'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'einvoicing_party_type') then
    create type public.einvoicing_party_type as enum ('business', 'consumer', 'government');
  end if;
  if not exists (select 1 from pg_type where typname = 'einvoicing_discovery_status') then
    create type public.einvoicing_discovery_status as enum (
      'unknown',
      'available',
      'unavailable',
      'error'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'sales_document_kind') then
    create type public.sales_document_kind as enum ('invoice', 'credit_note');
  end if;
  if not exists (select 1 from pg_type where typname = 'sales_invoice_kind') then
    create type public.sales_invoice_kind as enum ('standard', 'deposit', 'final');
  end if;
  if not exists (select 1 from pg_type where typname = 'sales_document_status') then
    create type public.sales_document_status as enum ('draft', 'issued', 'cancelled', 'credited');
  end if;
  if not exists (select 1 from pg_type where typname = 'sales_delivery_status') then
    create type public.sales_delivery_status as enum (
      'not_submitted',
      'queued',
      'submitted',
      'cleared',
      'succeeded',
      'accepted',
      'rejected',
      'failed'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'sales_payment_status') then
    create type public.sales_payment_status as enum ('unpaid', 'partially_paid', 'paid');
  end if;
  if not exists (select 1 from pg_type where typname = 'sales_payment_state') then
    create type public.sales_payment_state as enum ('recorded', 'reversed');
  end if;
end;
$$;

alter table public.companies
  add column if not exists enterprise_number text,
  add column if not exists country_code text,
  add column if not exists tax_registered boolean;

alter table public.customers
  add column if not exists enterprise_number text,
  add column if not exists vat_number text,
  add column if not exists country_code text;

-- Ces index permettent aux clés étrangères composites ci-dessous de garantir
-- qu'un client, projet ou devis appartient bien à la même entreprise que le
-- document de vente, y compris pour les écritures réalisées par le service role.
create unique index if not exists customers_id_company_unique
  on public.customers (id, company_id);

create unique index if not exists projects_id_company_unique
  on public.projects (id, company_id);

create unique index if not exists quotes_id_company_unique
  on public.quotes (id, company_id);

create table public.company_einvoicing_profiles (
  company_id uuid not null references public.companies(id),
  environment public.einvoicing_environment not null,
  provider text not null default 'storecove',
  connection_status public.einvoicing_connection_status not null default 'not_configured',
  storecove_legal_entity_id bigint,
  storecove_tenant_id text,
  peppol_scheme text,
  peppol_identifier text,
  acts_as_sender boolean not null default true,
  acts_as_receiver boolean not null default false,
  public_directory_entry boolean not null default true,
  last_verified_at timestamptz,
  last_error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, environment),
  check (provider = 'storecove'),
  check (storecove_tenant_id is null or char_length(storecove_tenant_id) between 1 and 64),
  check (
    (peppol_scheme is null and peppol_identifier is null)
    or (peppol_scheme is not null and peppol_identifier is not null)
  )
);

comment on table public.company_einvoicing_profiles is
  'Configuration Storecove et Peppol d’une entreprise, séparée entre sandbox et production.';

create unique index company_einvoicing_profiles_legal_entity_unique
  on public.company_einvoicing_profiles (environment, storecove_legal_entity_id)
  where storecove_legal_entity_id is not null;

create unique index company_einvoicing_profiles_tenant_unique
  on public.company_einvoicing_profiles (environment, storecove_tenant_id)
  where storecove_tenant_id is not null;

create unique index company_einvoicing_profiles_peppol_unique
  on public.company_einvoicing_profiles (environment, peppol_scheme, peppol_identifier)
  where peppol_identifier is not null;

create table public.customer_einvoicing_profiles (
  customer_id uuid not null references public.customers(id),
  company_id uuid not null references public.companies(id),
  environment public.einvoicing_environment not null,
  party_type public.einvoicing_party_type not null default 'business',
  endpoint_scheme text,
  endpoint_identifier text,
  discovery_status public.einvoicing_discovery_status not null default 'unknown',
  discovered_network text,
  last_discovered_at timestamptz,
  last_error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (customer_id, environment),
  foreign key (customer_id, company_id)
    references public.customers(id, company_id),
  check (
    (endpoint_scheme is null and endpoint_identifier is null)
    or (endpoint_scheme is not null and endpoint_identifier is not null)
  )
);

comment on table public.customer_einvoicing_profiles is
  'Identité de routage et résultat de découverte Peppol d’un client.';

create index customer_einvoicing_profiles_company_idx
  on public.customer_einvoicing_profiles (company_id, environment, discovery_status);

create table public.sales_document_sequences (
  company_id uuid not null references public.companies(id),
  document_kind public.sales_document_kind not null,
  fiscal_year integer not null,
  prefix text not null,
  last_value integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (company_id, document_kind, fiscal_year),
  check (fiscal_year between 2000 and 9999),
  check (char_length(prefix) between 1 and 20),
  check (last_value >= 0)
);

comment on table public.sales_document_sequences is
  'Compteur atomique par entreprise, année et type de document.';

create table public.sales_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  customer_id uuid not null references public.customers(id),
  project_id uuid references public.projects(id),
  source_quote_id uuid references public.quotes(id),
  credited_document_id uuid references public.sales_documents(id),
  document_kind public.sales_document_kind not null default 'invoice',
  invoice_kind public.sales_invoice_kind not null default 'standard',
  document_status public.sales_document_status not null default 'draft',
  delivery_status public.sales_delivery_status not null default 'not_submitted',
  payment_status public.sales_payment_status not null default 'unpaid',
  document_number text,
  fiscal_year integer,
  issue_date date,
  due_date date,
  currency_code text not null default 'EUR',
  tax_currency_code text,
  customer_reference text,
  buyer_reference text,
  purchase_order_reference text,
  payment_terms text,
  payment_means_code text not null default '30',
  payment_account_iban text,
  payment_account_bic text,
  notes text,
  seller_snapshot jsonb not null default '{}'::jsonb,
  buyer_snapshot jsonb not null default '{}'::jsonb,
  subtotal_ht numeric(18, 2) not null default 0,
  allowance_total numeric(18, 2) not null default 0,
  charge_total numeric(18, 2) not null default 0,
  total_tax numeric(18, 2) not null default 0,
  total_ttc numeric(18, 2) not null default 0,
  prepaid_amount numeric(18, 2) not null default 0,
  amount_paid numeric(18, 2) not null default 0,
  payable_amount numeric(18, 2) not null default 0,
  created_by uuid not null references auth.users(id),
  issued_by uuid references auth.users(id),
  issued_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  check (char_length(currency_code) = 3),
  check (tax_currency_code is null or char_length(tax_currency_code) = 3),
  check (fiscal_year is null or fiscal_year between 2000 and 9999),
  check (due_date is null or issue_date is null or due_date >= issue_date),
  check (subtotal_ht >= 0),
  check (allowance_total >= 0),
  check (charge_total >= 0),
  check (total_tax >= 0),
  check (total_ttc >= 0),
  check (prepaid_amount >= 0),
  check (amount_paid >= 0),
  check (payable_amount >= 0),
  check (document_kind = 'invoice' or invoice_kind = 'standard'),
  check (document_kind = 'invoice' or credited_document_id is not null),
  check (
    document_status = 'draft'
    or (
      document_number is not null
      and issue_date is not null
      and issued_at is not null
      and issued_by is not null
      and seller_snapshot <> '{}'::jsonb
      and buyer_snapshot <> '{}'::jsonb
    )
  )
);

comment on table public.sales_documents is
  'Nouveau document de vente Storecove-first. Aucun lien fonctionnel avec les anciennes tables invoices*.';

create unique index sales_documents_number_unique
  on public.sales_documents (company_id, document_number)
  where document_number is not null;

create unique index sales_documents_id_company_unique
  on public.sales_documents (id, company_id);

alter table public.sales_documents
  add constraint sales_documents_customer_company_fk
    foreign key (customer_id, company_id)
    references public.customers(id, company_id),
  add constraint sales_documents_project_company_fk
    foreign key (project_id, company_id)
    references public.projects(id, company_id),
  add constraint sales_documents_quote_company_fk
    foreign key (source_quote_id, company_id)
    references public.quotes(id, company_id),
  add constraint sales_documents_credit_company_fk
    foreign key (credited_document_id, company_id)
    references public.sales_documents(id, company_id);

create index sales_documents_company_status_idx
  on public.sales_documents (company_id, document_status, issue_date desc);

create index sales_documents_customer_idx
  on public.sales_documents (company_id, customer_id, created_at desc);

create index sales_documents_quote_idx
  on public.sales_documents (source_quote_id)
  where source_quote_id is not null;

create table public.sales_document_lines (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.sales_documents(id) on delete cascade,
  company_id uuid not null references public.companies(id),
  source_quote_item_id uuid references public.quote_items(id),
  position integer not null,
  line_identifier text not null,
  item_type text not null default 'service',
  category text,
  room_label text,
  label text not null,
  description text,
  quantity numeric(18, 4) not null default 1,
  unit_code text not null default 'C62',
  unit_label text,
  unit_price_ht numeric(18, 6) not null default 0,
  discount_amount numeric(18, 2) not null default 0,
  line_extension_amount numeric(18, 2) not null default 0,
  vat_category_code text not null default 'S',
  vat_rate numeric(7, 4) not null default 21,
  tax_exemption_reason_code text,
  tax_exemption_reason text,
  tax_amount numeric(18, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (document_id, position),
  unique (document_id, line_identifier),
  foreign key (document_id, company_id)
    references public.sales_documents(id, company_id) on delete cascade,
  check (position > 0),
  check (char_length(line_identifier) between 1 and 64),
  check (quantity > 0),
  check (unit_price_ht >= 0),
  check (discount_amount >= 0),
  check (line_extension_amount >= 0),
  check (vat_rate >= 0),
  check (tax_amount >= 0),
  check (
    vat_category_code not in ('E', 'AE', 'O')
    or tax_exemption_reason is not null
    or tax_exemption_reason_code is not null
  )
);

comment on table public.sales_document_lines is
  'Lignes normalisées avec codes d’unité et catégories TVA nécessaires à Peppol BIS Billing.';

create index sales_document_lines_document_idx
  on public.sales_document_lines (document_id, position);

create table public.sales_document_payments (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.sales_documents(id),
  company_id uuid not null references public.companies(id),
  state public.sales_payment_state not null default 'recorded',
  payment_date date not null default current_date,
  amount numeric(18, 2) not null,
  currency_code text not null default 'EUR',
  payment_method text not null default 'bank_transfer',
  reference text,
  notes text,
  recorded_by uuid not null references auth.users(id),
  recorded_at timestamptz not null default now(),
  reversed_at timestamptz,
  reversed_by uuid references auth.users(id),
  metadata jsonb not null default '{}'::jsonb,
  foreign key (document_id, company_id)
    references public.sales_documents(id, company_id),
  check (amount > 0),
  check (char_length(currency_code) = 3),
  check (
    state = 'recorded'
    or (reversed_at is not null and reversed_by is not null)
  )
);

create index sales_document_payments_document_idx
  on public.sales_document_payments (document_id, payment_date);

create table public.einvoice_submissions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.sales_documents(id),
  company_id uuid not null references public.companies(id),
  environment public.einvoicing_environment not null,
  provider text not null default 'storecove',
  provider_legal_entity_id bigint not null,
  idempotency_guid uuid not null default gen_random_uuid(),
  provider_guid uuid,
  status text not null default 'created',
  network text,
  routing_scheme text,
  routing_identifier text,
  payload_version date not null default date '2026-08-10',
  request_payload jsonb,
  response_payload jsonb,
  attempt_count integer not null default 0,
  requested_at timestamptz not null default now(),
  submitted_at timestamptz,
  completed_at timestamptz,
  error_code text,
  error_message text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (idempotency_guid),
  foreign key (document_id, company_id)
    references public.sales_documents(id, company_id),
  check (provider = 'storecove'),
  check (attempt_count >= 0),
  check (
    (routing_scheme is null and routing_identifier is null)
    or (routing_scheme is not null and routing_identifier is not null)
  )
);

comment on table public.einvoice_submissions is
  'Tentative idempotente d’envoi d’un document à Storecove.';

create unique index einvoice_submissions_provider_guid_unique
  on public.einvoice_submissions (environment, provider_guid)
  where provider_guid is not null;

create unique index einvoice_submissions_id_company_environment_unique
  on public.einvoice_submissions (id, company_id, environment);

create index einvoice_submissions_document_idx
  on public.einvoice_submissions (document_id, created_at desc);

create index einvoice_submissions_status_idx
  on public.einvoice_submissions (company_id, environment, status, created_at desc);

create table public.einvoice_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  document_id uuid references public.sales_documents(id),
  submission_id uuid references public.einvoice_submissions(id),
  environment public.einvoicing_environment not null,
  provider text not null default 'storecove',
  deduplication_key text not null unique,
  provider_guid uuid,
  idempotency_guid uuid,
  event_type text not null,
  event_group text,
  event_name text not null,
  details text,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text,
  foreign key (document_id, company_id)
    references public.sales_documents(id, company_id),
  foreign key (submission_id, company_id, environment)
    references public.einvoice_submissions(id, company_id, environment),
  check (provider = 'storecove'),
  check (char_length(deduplication_key) between 1 and 200)
);

comment on table public.einvoice_events is
  'Journal append-only des webhooks Storecove, avec clé de déduplication.';

create index einvoice_events_document_idx
  on public.einvoice_events (document_id, received_at desc);

create index einvoice_events_unprocessed_idx
  on public.einvoice_events (environment, received_at)
  where processed_at is null;

create table public.einvoice_artifacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  document_id uuid not null references public.sales_documents(id),
  submission_id uuid references public.einvoice_submissions(id),
  environment public.einvoicing_environment not null,
  artifact_type text not null,
  evidence_type text,
  network text,
  mime_type text not null,
  storage_bucket text,
  storage_path text,
  sha256 text,
  provider_url text,
  provider_url_expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (document_id, company_id)
    references public.sales_documents(id, company_id),
  foreign key (submission_id, company_id, environment)
    references public.einvoice_submissions(id, company_id, environment),
  check (
    (storage_bucket is null and storage_path is null)
    or (storage_bucket is not null and storage_path is not null)
  ),
  check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$')
);

comment on table public.einvoice_artifacts is
  'Copies durables des XML, PDF et preuves de transport ; les URL Storecove temporaires ne constituent pas l’archive.';

create index einvoice_artifacts_document_idx
  on public.einvoice_artifacts (document_id, created_at desc);

create or replace function public.set_sales_document_line_amounts()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_gross numeric(18, 2);
begin
  v_gross := round((new.quantity * new.unit_price_ht)::numeric, 2);

  if new.discount_amount > v_gross then
    raise exception 'La remise de ligne ne peut pas dépasser son montant brut.';
  end if;

  new.line_extension_amount := v_gross - new.discount_amount;
  new.tax_amount := round((new.line_extension_amount * new.vat_rate / 100)::numeric, 2);
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.recalculate_sales_document_totals(p_document_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_subtotal numeric(18, 2);
  v_tax numeric(18, 2);
begin
  select
    coalesce(sum(line_extension_amount), 0),
    coalesce(sum(tax_amount), 0)
  into v_subtotal, v_tax
  from public.sales_document_lines
  where document_id = p_document_id;

  update public.sales_documents
  set subtotal_ht = v_subtotal,
      total_tax = v_tax,
      total_ttc = greatest(v_subtotal - allowance_total + charge_total + v_tax, 0),
      payable_amount = greatest(
        v_subtotal - allowance_total + charge_total + v_tax - prepaid_amount - amount_paid,
        0
      ),
      updated_at = now()
  where id = p_document_id;
end;
$$;

revoke all on function public.recalculate_sales_document_totals(uuid) from public, anon, authenticated;

create or replace function public.recalculate_sales_document_after_line_change()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform public.recalculate_sales_document_totals(coalesce(new.document_id, old.document_id));
  return coalesce(new, old);
end;
$$;

create or replace function public.recalculate_sales_document_payments(p_document_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_amount_paid numeric(18, 2);
  v_total_ttc numeric(18, 2);
begin
  select coalesce(sum(amount), 0)
  into v_amount_paid
  from public.sales_document_payments
  where document_id = p_document_id
    and state = 'recorded';

  select total_ttc
  into v_total_ttc
  from public.sales_documents
  where id = p_document_id;

  update public.sales_documents
  set amount_paid = v_amount_paid,
      payable_amount = greatest(v_total_ttc - prepaid_amount - v_amount_paid, 0),
      payment_status = case
        when v_total_ttc > 0 and v_amount_paid >= v_total_ttc - prepaid_amount then 'paid'::public.sales_payment_status
        when v_amount_paid > 0 then 'partially_paid'::public.sales_payment_status
        else 'unpaid'::public.sales_payment_status
      end,
      updated_at = now()
  where id = p_document_id;
end;
$$;

revoke all on function public.recalculate_sales_document_payments(uuid) from public, anon, authenticated;

create or replace function public.recalculate_sales_document_after_payment_change()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform public.recalculate_sales_document_payments(coalesce(new.document_id, old.document_id));
  return coalesce(new, old);
end;
$$;

create trigger company_einvoicing_profiles_set_updated_at
before update on public.company_einvoicing_profiles
for each row execute function public.set_updated_at();

create trigger customer_einvoicing_profiles_set_updated_at
before update on public.customer_einvoicing_profiles
for each row execute function public.set_updated_at();

create trigger sales_document_sequences_set_updated_at
before update on public.sales_document_sequences
for each row execute function public.set_updated_at();

create trigger sales_documents_set_updated_at
before update on public.sales_documents
for each row execute function public.set_updated_at();

create trigger sales_document_lines_set_amounts
before insert or update
on public.sales_document_lines
for each row execute function public.set_sales_document_line_amounts();

create trigger sales_document_lines_recalculate_document
after insert or update or delete on public.sales_document_lines
for each row execute function public.recalculate_sales_document_after_line_change();

create trigger sales_document_payments_recalculate_document
after insert or update or delete on public.sales_document_payments
for each row execute function public.recalculate_sales_document_after_payment_change();

create trigger einvoice_submissions_set_updated_at
before update on public.einvoice_submissions
for each row execute function public.set_updated_at();

create or replace view public.sales_document_tax_totals
with (security_invoker = true)
as
select
  line.document_id,
  line.company_id,
  line.vat_category_code,
  line.vat_rate,
  line.tax_exemption_reason_code,
  line.tax_exemption_reason,
  sum(line.line_extension_amount)::numeric(18, 2) as taxable_amount,
  sum(line.tax_amount)::numeric(18, 2) as tax_amount
from public.sales_document_lines line
group by
  line.document_id,
  line.company_id,
  line.vat_category_code,
  line.vat_rate,
  line.tax_exemption_reason_code,
  line.tax_exemption_reason;

comment on view public.sales_document_tax_totals is
  'Synthèse TVA dérivée des lignes pour construire les taxSubtotals Storecove sans duplication.';

alter table public.company_einvoicing_profiles enable row level security;
alter table public.customer_einvoicing_profiles enable row level security;
alter table public.sales_document_sequences enable row level security;
alter table public.sales_documents enable row level security;
alter table public.sales_document_lines enable row level security;
alter table public.sales_document_payments enable row level security;
alter table public.einvoice_submissions enable row level security;
alter table public.einvoice_events enable row level security;
alter table public.einvoice_artifacts enable row level security;

create policy company_einvoicing_profiles_member_read
on public.company_einvoicing_profiles for select
using (public.is_company_member(company_id));

create policy company_einvoicing_profiles_manager_insert
on public.company_einvoicing_profiles for insert
with check (public.can_manage_company(company_id));

create policy company_einvoicing_profiles_manager_update
on public.company_einvoicing_profiles for update
using (public.can_manage_company(company_id))
with check (public.can_manage_company(company_id));

create policy customer_einvoicing_profiles_member_read
on public.customer_einvoicing_profiles for select
using (public.is_company_member(company_id));

create policy customer_einvoicing_profiles_member_insert
on public.customer_einvoicing_profiles for insert
with check (
  public.is_company_member(company_id)
  and exists (
    select 1 from public.customers customer
    where customer.id = customer_id
      and customer.company_id = company_id
  )
);

create policy customer_einvoicing_profiles_member_update
on public.customer_einvoicing_profiles for update
using (public.is_company_member(company_id))
with check (
  public.is_company_member(company_id)
  and exists (
    select 1 from public.customers customer
    where customer.id = customer_id
      and customer.company_id = company_id
  )
);

create policy sales_document_sequences_manager_read
on public.sales_document_sequences for select
using (public.can_manage_company(company_id));

create policy sales_documents_member_read
on public.sales_documents for select
using (public.is_company_member(company_id));

create policy sales_documents_member_insert
on public.sales_documents for insert
with check (
  public.is_company_member(company_id)
  and created_by = auth.uid()
  and exists (
    select 1 from public.customers customer
    where customer.id = customer_id
      and customer.company_id = company_id
  )
);

create policy sales_documents_member_update_draft
on public.sales_documents for update
using (public.is_company_member(company_id) and document_status = 'draft')
with check (
  public.is_company_member(company_id)
  and document_status = 'draft'
  and exists (
    select 1 from public.customers customer
    where customer.id = customer_id
      and customer.company_id = company_id
  )
);

create policy sales_documents_manager_delete_draft
on public.sales_documents for delete
using (public.can_manage_company(company_id) and document_status = 'draft');

create policy sales_document_lines_member_read
on public.sales_document_lines for select
using (public.is_company_member(company_id));

create policy sales_document_lines_member_insert_draft
on public.sales_document_lines for insert
with check (
  public.is_company_member(company_id)
  and exists (
    select 1 from public.sales_documents document
    where document.id = document_id
      and document.company_id = company_id
      and document.document_status = 'draft'
  )
);

create policy sales_document_lines_member_update_draft
on public.sales_document_lines for update
using (
  public.is_company_member(company_id)
  and exists (
    select 1 from public.sales_documents document
    where document.id = document_id
      and document.company_id = company_id
      and document.document_status = 'draft'
  )
)
with check (
  public.is_company_member(company_id)
  and exists (
    select 1 from public.sales_documents document
    where document.id = document_id
      and document.company_id = company_id
      and document.document_status = 'draft'
  )
);

create policy sales_document_lines_member_delete_draft
on public.sales_document_lines for delete
using (
  public.is_company_member(company_id)
  and exists (
    select 1 from public.sales_documents document
    where document.id = document_id
      and document.company_id = company_id
      and document.document_status = 'draft'
  )
);

create policy sales_document_payments_member_read
on public.sales_document_payments for select
using (public.is_company_member(company_id));

create policy einvoice_submissions_member_read
on public.einvoice_submissions for select
using (public.is_company_member(company_id));

create policy einvoice_events_member_read
on public.einvoice_events for select
using (public.is_company_member(company_id));

create policy einvoice_artifacts_member_read
on public.einvoice_artifacts for select
using (public.is_company_member(company_id));

grant select, insert, update on public.company_einvoicing_profiles to authenticated;
grant select, insert, update on public.customer_einvoicing_profiles to authenticated;
grant select on public.sales_document_sequences to authenticated;
grant select, insert, update, delete on public.sales_documents to authenticated;
grant select, insert, update, delete on public.sales_document_lines to authenticated;
grant select on public.sales_document_payments to authenticated;
grant select on public.einvoice_submissions to authenticated;
grant select on public.einvoice_events to authenticated;
grant select on public.einvoice_artifacts to authenticated;
grant select on public.sales_document_tax_totals to authenticated;

commit;
