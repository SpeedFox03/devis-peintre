begin;

-- Suppression explicitement autorisée de l'ancien domaine de facturation de
-- test. Le nouveau domaine sales_documents* doit être installé au préalable.
do $$
declare
  v_external_dependencies text;
begin
  if to_regclass('public.sales_documents') is null then
    raise exception 'Le nouveau domaine sales_documents doit être installé avant le nettoyage legacy.';
  end if;

  select string_agg(
    format('%I.%I (%I)', source_namespace.nspname, source_table.relname, dependency.conname),
    ', '
    order by source_namespace.nspname, source_table.relname, dependency.conname
  )
  into v_external_dependencies
  from pg_constraint dependency
  join pg_class source_table on source_table.oid = dependency.conrelid
  join pg_namespace source_namespace on source_namespace.oid = source_table.relnamespace
  where dependency.contype = 'f'
    and dependency.confrelid in (
      to_regclass('public.invoices'),
      to_regclass('public.invoice_items'),
      to_regclass('public.invoice_payments'),
      to_regclass('public.invoice_peppol_events'),
      to_regclass('public.invoice_exports'),
      to_regclass('public.invoice_snapshots')
    )
    and source_table.relname not in (
      'invoices',
      'invoice_items',
      'invoice_payments',
      'invoice_peppol_events',
      'invoice_exports',
      'invoice_snapshots'
    );

  if v_external_dependencies is not null then
    raise exception 'Nettoyage facturation interrompu : dépendances externes détectées : %',
      v_external_dependencies;
  end if;
end;
$$;

drop trigger if exists invoice_items_recalculate_invoice_totals on public.invoice_items;
drop trigger if exists invoice_items_set_totals on public.invoice_items;
drop trigger if exists invoice_payments_recalculate_invoice_totals on public.invoice_payments;
drop trigger if exists invoices_set_updated_at on public.invoices;

drop function if exists public.create_invoice_from_quote(uuid, text);
drop function if exists public.delete_invoice_payment(uuid);
drop function if exists public.generate_invoice_number(uuid);
drop function if exists public.issue_invoice(uuid);
drop function if exists public.recalculate_invoice_totals(uuid);
drop function if exists public.recalculate_invoice_totals_after_item_change();
drop function if exists public.recalculate_invoice_totals_after_payment_change();
drop function if exists public.register_invoice_payment(uuid, numeric, date, text, text, text);
drop function if exists public.set_invoice_item_totals();

-- Les tables enfants sont retirées avant la table racine. Aucun CASCADE n'est
-- utilisé : toute dépendance non inventoriée provoquera l'échec de la migration.
drop table if exists public.invoice_exports;
drop table if exists public.invoice_snapshots;
drop table if exists public.invoice_peppol_events;
drop table if exists public.invoice_payments;
drop table if exists public.invoice_items;
drop table if exists public.invoices;

commit;
