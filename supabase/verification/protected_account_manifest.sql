-- Requête en lecture seule. Exécuter avant et après chaque migration sur la
-- restauration de test, puis comparer chaque compteur et chaque montant.

with protected_user as (
  select id
  from auth.users
  where lower(email) = 'contact@momentdart.be'
), protected_companies as (
  select id
  from public.companies
  where owner_user_id in (select id from protected_user)
), protected_customers as (
  select id from public.customers where owner_user_id in (select id from protected_user)
), protected_quotes as (
  select id from public.quotes where owner_user_id in (select id from protected_user)
), protected_rooms as (
  select id from public.quote_rooms where quote_id in (select id from protected_quotes)
), protected_public_links as (
  select id from public.quote_public_links where quote_id in (select id from protected_quotes)
)
select 'auth_users' as object_type, count(*)::numeric as object_count, null::numeric as financial_total from protected_user
union all
select 'profiles', count(*)::numeric, null::numeric from public.profiles where id in (select id from protected_user)
union all
select 'companies', count(*)::numeric, null::numeric from protected_companies
union all
select 'company_settings', count(*)::numeric, null::numeric from public.company_settings where company_id in (select id from protected_companies)
union all
select 'company_email_settings', count(*)::numeric, null::numeric from public.company_email_settings where company_id in (select id from protected_companies)
union all
select 'customers', count(*)::numeric, null::numeric from protected_customers
union all
select 'addresses', count(*)::numeric, null::numeric from public.addresses where owner_user_id in (select id from protected_user)
union all
select 'quotes', count(*)::numeric, coalesce(sum(total_ttc), 0)::numeric from public.quotes where id in (select id from protected_quotes)
union all
select 'quote_items', count(*)::numeric, null::numeric from public.quote_items where quote_id in (select id from protected_quotes)
union all
select 'quote_rooms', count(*)::numeric, null::numeric from protected_rooms
union all
select 'quote_room_photos', count(*)::numeric, coalesce(sum(size_bytes), 0)::numeric from public.quote_room_photos where room_id in (select id from protected_rooms)
union all
select 'quote_room_templates', count(*)::numeric, null::numeric from public.quote_room_templates where company_id in (select id from protected_companies)
union all
select 'quote_public_links', count(*)::numeric, null::numeric from protected_public_links
union all
select 'quote_responses', count(*)::numeric, null::numeric from public.quote_responses where public_link_id in (select id from protected_public_links)
union all
select 'quote_email_deliveries', count(*)::numeric, null::numeric from public.quote_email_deliveries where quote_id in (select id from protected_quotes)
union all
select 'service_catalog', count(*)::numeric, null::numeric from public.service_catalog where owner_user_id in (select id from protected_user)
order by object_type;

-- Inventaire des chemins Storage à copier physiquement.
with protected_user as (
  select id from auth.users where lower(email) = 'contact@momentdart.be'
), protected_companies as (
  select id from public.companies where owner_user_id in (select id from protected_user)
), protected_quotes as (
  select id from public.quotes where owner_user_id in (select id from protected_user)
), protected_rooms as (
  select id from public.quote_rooms where quote_id in (select id from protected_quotes)
)
select 'company_logo' as file_type, logo_url as file_reference
from public.companies
where id in (select id from protected_companies) and logo_url is not null
union all
select 'quote_room_photo', storage_path
from public.quote_room_photos
where room_id in (select id from protected_rooms)
order by file_type, file_reference;

-- Inventaire Storage complémentaire : couvre aussi les fichiers dont le chemin
-- contient l'identifiant de l'utilisateur ou de l'entreprise protégée.
with protected_ids as (
  select id::text as id from auth.users where lower(email) = 'contact@momentdart.be'
  union
  select company.id::text
  from public.companies company
  join auth.users app_user on app_user.id = company.owner_user_id
  where lower(app_user.email) = 'contact@momentdart.be'
)
select
  storage_object.bucket_id,
  storage_object.name,
  storage_object.metadata ->> 'size' as size_bytes,
  storage_object.created_at,
  storage_object.updated_at
from storage.objects storage_object
where exists (
  select 1 from protected_ids
  where storage_object.name like '%' || protected_ids.id || '%'
)
order by storage_object.bucket_id, storage_object.name;
