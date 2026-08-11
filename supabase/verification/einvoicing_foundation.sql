-- Lecture seule, à exécuter après la migration de fondation e-facturation.

select
  table_name,
  row_count
from (
  select 'legacy_invoice_tables_present' as table_name, count(*)::bigint as row_count
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
  union all
  select 'company_einvoicing_profiles', count(*) from public.company_einvoicing_profiles
  union all
  select 'customer_einvoicing_profiles', count(*) from public.customer_einvoicing_profiles
  union all
  select 'sales_documents', count(*) from public.sales_documents
  union all
  select 'sales_document_lines', count(*) from public.sales_document_lines
  union all
  select 'sales_document_payments', count(*) from public.sales_document_payments
  union all
  select 'einvoice_submissions', count(*) from public.einvoice_submissions
  union all
  select 'einvoice_events', count(*) from public.einvoice_events
  union all
  select 'einvoice_artifacts', count(*) from public.einvoice_artifacts
) counts
order by table_name;

select
  document_id,
  vat_category_code,
  vat_rate,
  taxable_amount,
  tax_amount
from public.sales_document_tax_totals
order by document_id, vat_category_code, vat_rate;

select
  schemaname,
  tablename,
  policyname,
  cmd
from pg_policies
where schemaname = 'public'
  and (
    tablename like 'sales_document%'
    or tablename like 'einvoice_%'
    or tablename in ('company_einvoicing_profiles', 'customer_einvoicing_profiles')
  )
order by tablename, policyname;
