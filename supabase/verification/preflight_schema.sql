-- Lecture seule : à exécuter sur la restauration de test avant la migration.
-- Le résultat documente le schéma réel dont les migrations historiques locales
-- ne donnent aujourd'hui qu'une vue partielle.

select
  columns.table_schema,
  columns.table_name,
  columns.ordinal_position,
  columns.column_name,
  columns.data_type,
  columns.udt_name,
  columns.is_nullable,
  columns.column_default
from information_schema.columns columns
where columns.table_schema in ('public', 'storage')
order by columns.table_schema, columns.table_name, columns.ordinal_position;

select
  namespace.nspname as function_schema,
  procedure.proname as function_name,
  pg_get_function_identity_arguments(procedure.oid) as arguments,
  pg_get_function_result(procedure.oid) as result_type,
  procedure.prosecdef as security_definer
from pg_proc procedure
join pg_namespace namespace on namespace.oid = procedure.pronamespace
where namespace.nspname = 'public'
order by procedure.proname, arguments;

select
  policies.schemaname,
  policies.tablename,
  policies.policyname,
  policies.cmd,
  policies.roles,
  policies.qual,
  policies.with_check
from pg_policies policies
where policies.schemaname in ('public', 'storage')
order by policies.schemaname, policies.tablename, policies.policyname;

select
  constraints.table_schema,
  constraints.table_name,
  constraints.constraint_name,
  constraints.constraint_type
from information_schema.table_constraints constraints
where constraints.table_schema = 'public'
order by constraints.table_name, constraints.constraint_type, constraints.constraint_name;

-- Contrôle spécifique nécessaire au rattachement Projet → Devis.
select
  procedure.proname,
  pg_get_function_identity_arguments(procedure.oid) as arguments,
  pg_get_function_result(procedure.oid) as result_type
from pg_proc procedure
join pg_namespace namespace on namespace.oid = procedure.pronamespace
where namespace.nspname = 'public'
  and procedure.proname in ('create_quote', 'duplicate_quote');
