begin;

-- Une formule fonctionnelle unique. Les deux prix ne diffèrent que par leur
-- fréquence de facturation.
insert into public.subscription_plans (code, name, entitlements, active)
values (
  'artisan-essential',
  'Essentiel artisan',
  jsonb_build_object(
    'quotes', 'unlimited',
    'customers', 'unlimited',
    'projects', true,
    'catalog', true,
    'quote_photos', true,
    'custom_quote_design', true,
    'custom_email_design', true,
    'public_quote_response', true,
    'voice_assistant', true
  ),
  true
)
on conflict (code) do update
set name = excluded.name,
    entitlements = excluded.entitlements,
    active = excluded.active;

insert into public.plan_prices (
  plan_id,
  billing_interval,
  amount_cents,
  currency,
  active,
  valid_from,
  valid_until
)
select id, 'month'::public.billing_interval, 1990, 'EUR', true, now(), null
from public.subscription_plans
where code = 'artisan-essential'
on conflict (plan_id, billing_interval)
where active and valid_until is null
do update set
  amount_cents = excluded.amount_cents,
  currency = excluded.currency,
  active = true;

insert into public.plan_prices (
  plan_id,
  billing_interval,
  amount_cents,
  currency,
  active,
  valid_from,
  valid_until
)
select id, 'year'::public.billing_interval, 19900, 'EUR', true, now(), null
from public.subscription_plans
where code = 'artisan-essential'
on conflict (plan_id, billing_interval)
where active and valid_until is null
do update set
  amount_cents = excluded.amount_cents,
  currency = excluded.currency,
  active = true;

create table if not exists public.subscription_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  price_id uuid not null references public.plan_prices(id),
  promo_code_id uuid references public.promo_codes(id),
  subscription_id uuid references public.subscriptions(id),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  requested_by uuid not null references auth.users(id),
  requested_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);

create unique index if not exists subscription_requests_one_pending_company
on public.subscription_requests(company_id)
where status = 'pending';

create index if not exists subscription_requests_status_requested_idx
on public.subscription_requests(status, requested_at);

alter table public.subscription_requests enable row level security;

create policy subscription_requests_manager_read
on public.subscription_requests
for select to authenticated
using (public.can_manage_company(company_id));

create or replace function public.request_subscription(
  p_price_id uuid,
  p_promo_code text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_company_id uuid;
  v_request_id uuid;
  v_promo public.promo_codes%rowtype;
  v_promo_id uuid;
  v_total_redemptions integer;
  v_company_redemptions integer;
begin
  if auth.uid() is null then
    raise exception 'Session requise.' using errcode = '42501';
  end if;

  v_company_id := public.resolve_user_company(auth.uid());
  if v_company_id is null or not public.can_manage_company(v_company_id) then
    raise exception 'Entreprise introuvable ou accès refusé.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.plan_prices price
    join public.subscription_plans plan on plan.id = price.plan_id
    where price.id = p_price_id
      and price.active
      and price.valid_until is null
      and plan.active
  ) then
    raise exception 'Cette offre n''est plus disponible.' using errcode = '22023';
  end if;

  if nullif(btrim(coalesce(p_promo_code, '')), '') is not null then
    select promo.* into v_promo
    from public.promo_codes promo
    where lower(promo.code) = lower(btrim(p_promo_code))
      and promo.active
      and (promo.starts_at is null or promo.starts_at <= now())
      and (promo.ends_at is null or promo.ends_at > now());

    if not found then
      raise exception 'Ce code promotionnel est invalide ou expiré.' using errcode = '22023';
    end if;

    select count(*) into v_total_redemptions
    from public.promo_redemptions redemption
    where redemption.promo_code_id = v_promo.id;

    select count(*) into v_company_redemptions
    from public.promo_redemptions redemption
    where redemption.promo_code_id = v_promo.id
      and redemption.company_id = v_company_id;

    if v_promo.max_redemptions is not null
      and v_total_redemptions >= v_promo.max_redemptions then
      raise exception 'Ce code promotionnel a atteint sa limite d''utilisation.' using errcode = '22023';
    end if;

    if v_company_redemptions >= v_promo.max_redemptions_per_company then
      raise exception 'Ce code promotionnel a déjà été utilisé pour cette entreprise.' using errcode = '22023';
    end if;

    if exists (
      select 1 from public.promo_code_prices restriction
      where restriction.promo_code_id = v_promo.id
    ) and not exists (
      select 1 from public.promo_code_prices restriction
      where restriction.promo_code_id = v_promo.id
        and restriction.plan_price_id = p_price_id
    ) then
      raise exception 'Ce code ne s''applique pas à la fréquence choisie.' using errcode = '22023';
    end if;

    v_promo_id := v_promo.id;
  end if;

  select request.id into v_request_id
  from public.subscription_requests request
  where request.company_id = v_company_id
    and request.status = 'pending';

  if v_request_id is null then
    insert into public.subscription_requests (
      company_id,
      price_id,
      promo_code_id,
      requested_by
    )
    values (v_company_id, p_price_id, v_promo_id, auth.uid())
    returning id into v_request_id;
  else
    update public.subscription_requests
    set price_id = p_price_id,
        promo_code_id = v_promo_id,
        requested_by = auth.uid(),
        requested_at = now(),
        updated_at = now()
    where id = v_request_id;
  end if;

  return v_request_id;
end;
$$;

revoke all on function public.request_subscription(uuid, text) from public, anon;
grant execute on function public.request_subscription(uuid, text) to authenticated;

create or replace function public.has_quote_access(
  p_company_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    public.is_platform_admin(p_user_id)
    or (
      public.is_company_member(p_company_id, p_user_id)
      and exists (
        select 1
        from public.companies company
        where company.id = p_company_id
          and company.account_status = 'active'
      )
      and exists (
        select 1
        from public.subscriptions subscription
        where subscription.company_id = p_company_id
          and subscription.status in ('trialing', 'active')
          and (
            subscription.current_period_end is null
            or subscription.current_period_end > now()
          )
      )
    );
$$;

revoke all on function public.has_quote_access(uuid, uuid) from public, anon;
grant execute on function public.has_quote_access(uuid, uuid) to authenticated;

create or replace function public.get_current_subscription_access()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_company_id uuid;
  v_company_name text;
  v_status text;
  v_period_end timestamptz;
  v_interval public.billing_interval;
  v_is_admin boolean;
  v_has_access boolean;
  v_has_pending boolean;
begin
  if auth.uid() is null then
    raise exception 'Session requise.' using errcode = '42501';
  end if;

  v_company_id := public.resolve_user_company(auth.uid());
  v_is_admin := public.is_platform_admin(auth.uid());

  if v_company_id is not null then
    select company.name into v_company_name
    from public.companies company
    where company.id = v_company_id;

    select subscription.status::text,
           subscription.current_period_end,
           price.billing_interval
    into v_status, v_period_end, v_interval
    from public.subscriptions subscription
    join public.plan_prices price on price.id = subscription.price_id
    where subscription.company_id = v_company_id
    order by
      case subscription.status
        when 'active' then 0
        when 'trialing' then 1
        when 'past_due' then 2
        else 3
      end,
      subscription.created_at desc
    limit 1;

    select exists (
      select 1
      from public.subscription_requests request
      where request.company_id = v_company_id
        and request.status = 'pending'
    ) into v_has_pending;
  end if;

  v_has_access := v_is_admin
    or (v_company_id is not null and public.has_quote_access(v_company_id, auth.uid()));

  return jsonb_build_object(
    'company_id', v_company_id,
    'company_name', v_company_name,
    'status', v_status,
    'current_period_end', v_period_end,
    'billing_interval', v_interval,
    'has_access', coalesce(v_has_access, false),
    'is_platform_admin', coalesce(v_is_admin, false),
    'has_pending_request', coalesce(v_has_pending, false)
  );
end;
$$;

revoke all on function public.get_current_subscription_access() from public, anon;
grant execute on function public.get_current_subscription_access() to authenticated;

-- Les anciennes politiques restent en place pour l'isolation par entreprise.
-- Ces politiques restrictives ajoutent l'abonnement comme condition obligatoire.
create policy quotes_subscription_read
on public.quotes as restrictive
for select to authenticated
using (public.has_quote_access(company_id));

create policy quotes_subscription_insert
on public.quotes as restrictive
for insert to authenticated
with check (public.has_quote_access(company_id));

create policy quotes_subscription_update
on public.quotes as restrictive
for update to authenticated
using (public.has_quote_access(company_id))
with check (public.has_quote_access(company_id));

create policy quotes_subscription_delete
on public.quotes as restrictive
for delete to authenticated
using (public.has_quote_access(company_id));

create policy quote_items_subscription_read
on public.quote_items as restrictive
for select to authenticated
using (public.has_quote_access(company_id));

create policy quote_items_subscription_write
on public.quote_items as restrictive
for all to authenticated
using (public.has_quote_access(company_id))
with check (public.has_quote_access(company_id));

create policy quote_rooms_subscription_read
on public.quote_rooms as restrictive
for select to authenticated
using (public.has_quote_access(company_id));

create policy quote_rooms_subscription_write
on public.quote_rooms as restrictive
for all to authenticated
using (public.has_quote_access(company_id))
with check (public.has_quote_access(company_id));

create policy quote_room_photos_subscription_read
on public.quote_room_photos as restrictive
for select to authenticated
using (public.has_quote_access(company_id));

create policy quote_room_photos_subscription_write
on public.quote_room_photos as restrictive
for all to authenticated
using (public.has_quote_access(company_id))
with check (public.has_quote_access(company_id));

-- Les triggers couvrent aussi les fonctions SECURITY DEFINER historiques :
-- l'identité JWT reste disponible lors de leur exécution.
create or replace function public.enforce_quote_subscription_write_access()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_company_id uuid;
begin
  if auth.role() = 'service_role' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    v_company_id := old.company_id;
  else
    v_company_id := new.company_id;
  end if;

  if auth.uid() is null or not public.has_quote_access(v_company_id, auth.uid()) then
    raise exception 'Un abonnement actif est requis pour modifier les devis.'
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'quotes_require_subscription_write') then
    create trigger quotes_require_subscription_write
    before insert or update or delete on public.quotes
    for each row execute function public.enforce_quote_subscription_write_access();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'quote_items_require_subscription_write') then
    create trigger quote_items_require_subscription_write
    before insert or update or delete on public.quote_items
    for each row execute function public.enforce_quote_subscription_write_access();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'quote_rooms_require_subscription_write') then
    create trigger quote_rooms_require_subscription_write
    before insert or update or delete on public.quote_rooms
    for each row execute function public.enforce_quote_subscription_write_access();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'quote_room_photos_require_subscription_write') then
    create trigger quote_room_photos_require_subscription_write
    before insert or update or delete on public.quote_room_photos
    for each row execute function public.enforce_quote_subscription_write_access();
  end if;
end;
$$;

-- L'inscription publique remplace la liste blanche. La table historique est
-- conservée intacte pour ne supprimer aucune donnée.
create or replace function public.enforce_auth_email_allowlist()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  return new;
end;
$$;

create or replace function public.current_user_is_allowed()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select auth.uid() is not null
    and coalesce(
      (select profile.account_status from public.profiles profile where profile.id = auth.uid()),
      'active'
    ) <> 'suspended';
$$;

revoke all on function public.current_user_is_allowed() from public, anon;
grant execute on function public.current_user_is_allowed() to authenticated;

create or replace function public.bootstrap_auth_user_account()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_company_id uuid;
  v_company_name text;
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''))
  on conflict (id) do update
  set full_name = coalesce(public.profiles.full_name, excluded.full_name);

  select company.id into v_company_id
  from public.companies company
  where company.owner_user_id = new.id
  order by company.created_at, company.id
  limit 1;

  if v_company_id is null then
    v_company_name := coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'company_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(coalesce(new.email, 'Mon entreprise'), '@', 1),
      'Mon entreprise'
    );

    insert into public.companies (owner_user_id, name, email)
    values (new.id, v_company_name, new.email)
    returning id into v_company_id;
  end if;

  insert into public.company_settings (
    company_id,
    pdf_theme,
    pdf_color_mode,
    default_tva_rate,
    default_quote_validity_days,
    default_deposit_percent
  )
  values (v_company_id, 'normal', true, 21, 30, 0)
  on conflict (company_id) do nothing;

  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'bootstrap_auth_user_account') then
    create trigger bootstrap_auth_user_account
    after insert on auth.users
    for each row execute function public.bootstrap_auth_user_account();
  end if;
end;
$$;

-- Le compte client protégé conserve un accès permanent. Aucune donnée métier
-- existante n'est modifiée ou supprimée.
insert into public.subscriptions (
  company_id,
  plan_id,
  price_id,
  status,
  current_period_start,
  current_period_end,
  cancel_at_period_end
)
select
  company.id,
  plan.id,
  price.id,
  'active'::public.subscription_status,
  now(),
  null,
  false
from auth.users app_user
join public.companies company on company.owner_user_id = app_user.id
join public.subscription_plans plan on plan.code = 'artisan-essential'
join public.plan_prices price
  on price.plan_id = plan.id
 and price.billing_interval = 'year'
 and price.active
 and price.valid_until is null
where lower(app_user.email) = 'contact@momentdart.be'
  and not exists (
    select 1
    from public.subscriptions current_subscription
    where current_subscription.company_id = company.id
      and current_subscription.status in ('trialing', 'active', 'past_due')
  );

commit;
