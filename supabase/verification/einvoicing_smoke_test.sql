-- Test fonctionnel transactionnel du nouveau domaine de facturation.
-- Toutes les écritures sont annulées à la fin du script.

begin;

do $$
declare
  v_company_id uuid;
  v_customer_id uuid;
  v_user_id uuid;
  v_document_id uuid;
  v_payment_id uuid;
  v_other_company_id uuid;
  v_cross_company_rejected boolean := false;
  v_subtotal numeric(18, 2);
  v_tax numeric(18, 2);
  v_total numeric(18, 2);
  v_paid numeric(18, 2);
  v_payable numeric(18, 2);
  v_payment_status public.sales_payment_status;
begin
  select customer.company_id, customer.id, company.owner_user_id
  into v_company_id, v_customer_id, v_user_id
  from public.customers customer
  join public.companies company on company.id = customer.company_id
  where customer.company_id is not null
  order by customer.created_at, customer.id
  limit 1;

  if v_company_id is null or v_customer_id is null or v_user_id is null then
    raise exception 'Aucune entreprise avec client et propriétaire disponible pour le smoke test.';
  end if;

  select id
  into v_other_company_id
  from public.companies
  where id <> v_company_id
  order by created_at, id
  limit 1;

  if v_other_company_id is not null then
    begin
      insert into public.sales_documents (
        company_id,
        customer_id,
        created_by
      )
      values (
        v_other_company_id,
        v_customer_id,
        v_user_id
      );
    exception
      when foreign_key_violation then
        v_cross_company_rejected := true;
    end;

    if not v_cross_company_rejected then
      raise exception 'Un document a accepté le client d’une autre entreprise.';
    end if;
  end if;

  insert into public.sales_documents (
    company_id,
    customer_id,
    created_by,
    notes
  )
  values (
    v_company_id,
    v_customer_id,
    v_user_id,
    'Smoke test Storecove'
  )
  returning id into v_document_id;

  insert into public.sales_document_lines (
    document_id,
    company_id,
    position,
    line_identifier,
    label,
    quantity,
    unit_price_ht,
    discount_amount,
    vat_category_code,
    vat_rate
  )
  values
    (v_document_id, v_company_id, 1, '1', 'Préparation', 2, 50, 10, 'S', 21),
    (v_document_id, v_company_id, 2, '2', 'Peinture', 1, 25, 0, 'S', 6);

  select subtotal_ht, total_tax, total_ttc, amount_paid, payable_amount, payment_status
  into v_subtotal, v_tax, v_total, v_paid, v_payable, v_payment_status
  from public.sales_documents
  where id = v_document_id;

  if (v_subtotal, v_tax, v_total, v_paid, v_payable, v_payment_status)
     is distinct from (115.00, 20.40, 135.40, 0.00, 135.40, 'unpaid'::public.sales_payment_status) then
    raise exception 'Totaux inattendus: HT=%, TVA=%, TTC=%, payé=%, dû=%, statut=%',
      v_subtotal, v_tax, v_total, v_paid, v_payable, v_payment_status;
  end if;

  insert into public.sales_document_payments (
    document_id,
    company_id,
    amount,
    recorded_by
  )
  values (v_document_id, v_company_id, 35.40, v_user_id)
  returning id into v_payment_id;

  select amount_paid, payable_amount, payment_status
  into v_paid, v_payable, v_payment_status
  from public.sales_documents
  where id = v_document_id;

  if (v_paid, v_payable, v_payment_status)
     is distinct from (35.40, 100.00, 'partially_paid'::public.sales_payment_status) then
    raise exception 'Paiement inattendu: payé=%, dû=%, statut=%',
      v_paid, v_payable, v_payment_status;
  end if;

  update public.sales_document_payments
  set state = 'reversed',
      reversed_at = now(),
      reversed_by = v_user_id
  where id = v_payment_id;

  select amount_paid, payable_amount, payment_status
  into v_paid, v_payable, v_payment_status
  from public.sales_documents
  where id = v_document_id;

  if (v_paid, v_payable, v_payment_status)
     is distinct from (0.00, 135.40, 'unpaid'::public.sales_payment_status) then
    raise exception 'Annulation inattendue: payé=%, dû=%, statut=%',
      v_paid, v_payable, v_payment_status;
  end if;
end;
$$;

rollback;

select
  (
    select count(*)
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in (
        'invoices',
        'invoice_items',
        'invoice_payments',
        'invoice_peppol_events',
        'invoice_exports',
        'invoice_snapshots'
      )
  ) as legacy_invoice_tables_present,
  (select count(*) from public.sales_documents) as persisted_sales_documents;
