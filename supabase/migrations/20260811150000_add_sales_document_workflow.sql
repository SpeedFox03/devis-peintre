begin;

-- Un devis accepté ne peut alimenter qu'une seule facture standard active.
-- Un brouillon supprimé ou annulé libère volontairement le devis.
create unique index if not exists sales_documents_standard_quote_unique
  on public.sales_documents (source_quote_id)
  where source_quote_id is not null
    and document_kind = 'invoice'
    and invoice_kind = 'standard'
    and document_status <> 'cancelled';

create or replace function public.create_sales_document_from_quote(p_quote_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_quote public.quotes%rowtype;
  v_document_id uuid;
  v_line_count integer;
begin
  if v_user_id is null then
    raise exception 'Une session authentifiée est requise.' using errcode = '42501';
  end if;

  select quote.*
  into v_quote
  from public.quotes quote
  where quote.id = p_quote_id
  for update;

  if not found then
    raise exception 'Devis introuvable.' using errcode = 'P0002';
  end if;

  if not public.is_company_member(v_quote.company_id, v_user_id) then
    raise exception 'Accès refusé à ce devis.' using errcode = '42501';
  end if;

  if v_quote.status::text <> 'accepted' then
    raise exception 'Seul un devis accepté peut être transformé en facture.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.sales_documents document
    where document.source_quote_id = p_quote_id
      and document.document_kind = 'invoice'
      and document.invoice_kind = 'standard'
      and document.document_status <> 'cancelled'
  ) then
    raise exception 'Une facture existe déjà pour ce devis.' using errcode = '23505';
  end if;

  select count(*)
  into v_line_count
  from public.quote_items item
  where item.quote_id = p_quote_id;

  if v_line_count = 0 then
    raise exception 'Le devis ne contient aucune ligne facturable.' using errcode = '22023';
  end if;

  insert into public.sales_documents (
    company_id,
    customer_id,
    project_id,
    source_quote_id,
    document_kind,
    invoice_kind,
    document_status,
    currency_code,
    customer_reference,
    payment_terms,
    notes,
    created_by,
    metadata
  )
  values (
    v_quote.company_id,
    v_quote.customer_id,
    v_quote.project_id,
    v_quote.id,
    'invoice',
    'standard',
    'draft',
    'EUR',
    v_quote.quote_number,
    v_quote.terms,
    v_quote.notes,
    v_user_id,
    jsonb_build_object(
      'source', 'accepted_quote',
      'sourceQuoteNumber', v_quote.quote_number,
      'sourceQuoteTitle', v_quote.title
    )
  )
  returning id into v_document_id;

  insert into public.sales_document_lines (
    document_id,
    company_id,
    source_quote_item_id,
    position,
    line_identifier,
    item_type,
    category,
    room_label,
    label,
    description,
    quantity,
    unit_code,
    unit_label,
    unit_price_ht,
    vat_category_code,
    vat_rate,
    metadata
  )
  select
    v_document_id,
    v_quote.company_id,
    item.id,
    row_number() over (order by item.sort_order, item.id)::integer,
    row_number() over (order by item.sort_order, item.id)::text,
    coalesce(item.item_type::text, 'service'),
    item.category,
    room.name,
    item.label,
    item.description,
    item.quantity,
    case lower(trim(coalesce(item.unit, '')))
      when 'm²' then 'MTK'
      when 'm2' then 'MTK'
      when 'm' then 'MTR'
      when 'ml' then 'MTR'
      when 'h' then 'HUR'
      when 'heure' then 'HUR'
      when 'heures' then 'HUR'
      when 'jour' then 'DAY'
      when 'jours' then 'DAY'
      when 'kg' then 'KGM'
      when 'l' then 'LTR'
      when 'litre' then 'LTR'
      when 'litres' then 'LTR'
      else 'C62'
    end,
    nullif(trim(item.unit), ''),
    item.unit_price_ht,
    case when item.tva_rate = 0 then 'Z' else 'S' end,
    item.tva_rate,
    jsonb_build_object('sourceQuoteItemSortOrder', item.sort_order)
  from public.quote_items item
  left join public.quote_rooms room on room.id = item.room_id
  where item.quote_id = p_quote_id
  order by item.sort_order, item.id;

  return v_document_id;
exception
  when unique_violation then
    raise exception 'Une facture existe déjà pour ce devis.' using errcode = '23505';
end;
$$;

comment on function public.create_sales_document_from_quote(uuid) is
  'Crée atomiquement un brouillon de facture neuf à partir d’un devis accepté, sans appeler Storecove.';

revoke all on function public.create_sales_document_from_quote(uuid) from public, anon;
grant execute on function public.create_sales_document_from_quote(uuid) to authenticated;

create or replace function public.issue_sales_document(
  p_document_id uuid,
  p_issue_date date default current_date,
  p_due_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_document public.sales_documents%rowtype;
  v_company public.companies%rowtype;
  v_customer public.customers%rowtype;
  v_seller_address public.addresses%rowtype;
  v_buyer_address public.addresses%rowtype;
  v_sequence public.sales_document_sequences%rowtype;
  v_document_number text;
  v_seller_country_code text;
  v_buyer_country_code text;
  v_buyer_name text;
  v_effective_due_date date;
begin
  if v_user_id is null then
    raise exception 'Une session authentifiée est requise.' using errcode = '42501';
  end if;

  if p_issue_date is null then
    raise exception 'La date d’émission est obligatoire.' using errcode = '22023';
  end if;

  select document.*
  into v_document
  from public.sales_documents document
  where document.id = p_document_id
  for update;

  if not found then
    raise exception 'Facture introuvable.' using errcode = 'P0002';
  end if;

  if not public.can_manage_company(v_document.company_id, v_user_id) then
    raise exception 'Seul un gestionnaire peut émettre cette facture.' using errcode = '42501';
  end if;

  if v_document.document_status <> 'draft' then
    raise exception 'Cette facture a déjà été émise ou clôturée.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.sales_document_lines line
    where line.document_id = p_document_id
  ) or v_document.total_ttc <= 0 then
    raise exception 'La facture doit contenir au moins une ligne avec un montant positif.' using errcode = '22023';
  end if;

  select company.*
  into v_company
  from public.companies company
  where company.id = v_document.company_id;

  select customer.*
  into v_customer
  from public.customers customer
  where customer.id = v_document.customer_id;

  select address.*
  into v_seller_address
  from public.addresses address
  where address.entity_type::text = 'company'
    and address.entity_id = v_document.company_id
  order by case address.role::text when 'main' then 0 when 'billing' then 1 else 2 end,
           address.created_at
  limit 1;

  select address.*
  into v_buyer_address
  from public.addresses address
  where address.entity_type::text = 'customer'
    and address.entity_id = v_document.customer_id
  order by case address.role::text when 'billing' then 0 when 'main' then 1 else 2 end,
           address.created_at
  limit 1;

  v_buyer_name := nullif(trim(coalesce(
    v_customer.company_name,
    concat_ws(' ', v_customer.first_name, v_customer.last_name)
  )), '');

  if nullif(trim(v_company.name), '') is null then
    raise exception 'Le nom de l’entreprise doit être renseigné avant l’émission.' using errcode = '22023';
  end if;

  if nullif(trim(coalesce(v_company.enterprise_number, v_company.vat_number)), '') is null then
    raise exception 'Le numéro d’entreprise ou de TVA du vendeur doit être renseigné avant l’émission.' using errcode = '22023';
  end if;

  if v_seller_address.id is null
    or nullif(trim(v_seller_address.line1), '') is null
    or nullif(trim(v_seller_address.postal_code), '') is null
    or nullif(trim(v_seller_address.city), '') is null then
    raise exception 'L’adresse complète de l’entreprise doit être renseignée avant l’émission.' using errcode = '22023';
  end if;

  if v_buyer_name is null then
    raise exception 'Le nom du client doit être renseigné avant l’émission.' using errcode = '22023';
  end if;

  if v_buyer_address.id is null
    or nullif(trim(v_buyer_address.line1), '') is null
    or nullif(trim(v_buyer_address.postal_code), '') is null
    or nullif(trim(v_buyer_address.city), '') is null then
    raise exception 'L’adresse de facturation du client doit être renseignée avant l’émission.' using errcode = '22023';
  end if;

  v_effective_due_date := coalesce(p_due_date, p_issue_date + 30);
  if v_effective_due_date < p_issue_date then
    raise exception 'La date d’échéance ne peut pas précéder la date d’émission.' using errcode = '22023';
  end if;

  v_seller_country_code := upper(coalesce(
    nullif(trim(v_company.country_code), ''),
    case lower(trim(coalesce(v_seller_address.country, '')))
      when 'belgique' then 'BE'
      when 'belgium' then 'BE'
      when 'france' then 'FR'
      when 'luxembourg' then 'LU'
      when 'pays-bas' then 'NL'
      when 'netherlands' then 'NL'
      else null
    end,
    'BE'
  ));

  v_buyer_country_code := upper(coalesce(
    nullif(trim(v_customer.country_code), ''),
    case lower(trim(coalesce(v_buyer_address.country, '')))
      when 'belgique' then 'BE'
      when 'belgium' then 'BE'
      when 'france' then 'FR'
      when 'luxembourg' then 'LU'
      when 'pays-bas' then 'NL'
      when 'netherlands' then 'NL'
      else null
    end,
    'BE'
  ));

  insert into public.sales_document_sequences (
    company_id,
    document_kind,
    fiscal_year,
    prefix,
    last_value
  )
  values (
    v_document.company_id,
    v_document.document_kind,
    extract(year from p_issue_date)::integer,
    case when v_document.document_kind = 'credit_note' then 'AVO-' else 'FAC-' end
      || extract(year from p_issue_date)::integer::text || '-',
    1
  )
  on conflict (company_id, document_kind, fiscal_year)
  do update set last_value = public.sales_document_sequences.last_value + 1,
                updated_at = now()
  returning * into v_sequence;

  v_document_number := v_sequence.prefix || lpad(v_sequence.last_value::text, 4, '0');

  update public.sales_documents
  set document_number = v_document_number,
      fiscal_year = extract(year from p_issue_date)::integer,
      issue_date = p_issue_date,
      due_date = v_effective_due_date,
      payment_account_iban = coalesce(payment_account_iban, v_company.iban),
      payment_account_bic = coalesce(payment_account_bic, v_company.bic),
      seller_snapshot = jsonb_build_object(
        'name', v_company.name,
        'enterpriseNumber', v_company.enterprise_number,
        'vatNumber', v_company.vat_number,
        'taxRegistered', coalesce(v_company.tax_registered, v_company.vat_number is not null),
        'countryCode', v_seller_country_code,
        'email', v_company.email,
        'phone', v_company.phone,
        'website', v_company.website,
        'iban', v_company.iban,
        'bic', v_company.bic,
        'address', jsonb_build_object(
          'street1', v_seller_address.line1,
          'street2', v_seller_address.line2,
          'zip', v_seller_address.postal_code,
          'city', v_seller_address.city,
          'country', v_seller_country_code
        )
      ),
      buyer_snapshot = jsonb_build_object(
        'name', v_buyer_name,
        'companyName', v_customer.company_name,
        'firstName', v_customer.first_name,
        'lastName', v_customer.last_name,
        'enterpriseNumber', v_customer.enterprise_number,
        'vatNumber', v_customer.vat_number,
        'countryCode', v_buyer_country_code,
        'email', v_customer.email,
        'phone', v_customer.phone,
        'address', jsonb_build_object(
          'street1', v_buyer_address.line1,
          'street2', v_buyer_address.line2,
          'zip', v_buyer_address.postal_code,
          'city', v_buyer_address.city,
          'country', v_buyer_country_code
        )
      ),
      document_status = 'issued',
      issued_by = v_user_id,
      issued_at = now(),
      updated_at = now()
  where id = p_document_id;

  if v_document.source_quote_id is not null then
    update public.quotes
    set status = 'invoiced',
        updated_at = now()
    where id = v_document.source_quote_id
      and status = 'accepted';
  end if;

  return p_document_id;
end;
$$;

comment on function public.issue_sales_document(uuid, date, date) is
  'Émet irréversiblement un brouillon : numéro séquentiel atomique, dates et instantanés vendeur/acheteur.';

revoke all on function public.issue_sales_document(uuid, date, date) from public, anon;
grant execute on function public.issue_sales_document(uuid, date, date) to authenticated;

commit;
