-- Vérification en lecture seule après suppression du domaine invoices* de test.

do $$
declare
  v_legacy_tables integer;
  v_legacy_functions integer;
begin
  select count(*)
  into v_legacy_tables
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
    );

  select count(*)
  into v_legacy_functions
  from pg_proc routine
  join pg_namespace namespace on namespace.oid = routine.pronamespace
  where namespace.nspname = 'public'
    and routine.proname in (
      'create_invoice_from_quote',
      'delete_invoice_payment',
      'generate_invoice_number',
      'issue_invoice',
      'recalculate_invoice_totals',
      'recalculate_invoice_totals_after_item_change',
      'recalculate_invoice_totals_after_payment_change',
      'register_invoice_payment',
      'set_invoice_item_totals'
    );

  if v_legacy_tables <> 0 or v_legacy_functions <> 0 then
    raise exception 'Nettoyage legacy incomplet : % table(s), % fonction(s).',
      v_legacy_tables,
      v_legacy_functions;
  end if;

  if to_regclass('public.sales_documents') is null
    or to_regclass('public.sales_document_lines') is null
    or to_regclass('public.sales_document_payments') is null then
    raise exception 'Le nouveau domaine de facturation est incomplet.';
  end if;
end;
$$;

select
  0 as legacy_tables,
  0 as legacy_functions,
  3 as required_sales_document_tables;
