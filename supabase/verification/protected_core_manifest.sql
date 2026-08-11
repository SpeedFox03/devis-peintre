-- Empreinte déterministe de toutes les données hors ancien domaine invoices*.
-- Exécuter avant et après la migration de nettoyage, puis comparer les sorties.

begin;

create temporary table protected_core_manifest (
  schema_name text not null,
  table_name text not null,
  row_count bigint not null,
  content_hash text not null
) on commit drop;

do $$
declare
  v_table record;
begin
  for v_table in
    select namespace.nspname as schema_name, relation.relname as table_name
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where relation.relkind in ('r', 'p')
      and namespace.nspname in ('auth', 'public', 'storage')
      and not (
        namespace.nspname = 'public'
        and relation.relname in (
          'invoices',
          'invoice_items',
          'invoice_payments',
          'invoice_peppol_events',
          'invoice_exports',
          'invoice_snapshots'
        )
      )
    order by namespace.nspname, relation.relname
  loop
    execute format(
      $query$
        insert into protected_core_manifest (schema_name, table_name, row_count, content_hash)
        select %L, %L, count(*), md5(
          coalesce(
            string_agg(md5(to_jsonb(source_row)::text), '' order by md5(to_jsonb(source_row)::text)),
            ''
          )
        )
        from %I.%I source_row
      $query$,
      v_table.schema_name,
      v_table.table_name,
      v_table.schema_name,
      v_table.table_name
    );
  end loop;
end;
$$;

select schema_name, table_name, row_count, content_hash
from protected_core_manifest
order by schema_name, table_name;

rollback;
