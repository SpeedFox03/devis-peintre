begin;

alter table public.plan_prices
  add column if not exists setup_fee_cents integer not null default 0
    check (setup_fee_cents >= 0);

update public.subscription_plans
set name = 'Premium artisan',
    entitlements = jsonb_build_object(
      'quotes', 'unlimited',
      'customers', 'unlimited',
      'projects', true,
      'catalog', true,
      'quote_photos', true,
      'custom_quote_design', true,
      'custom_email_design', true,
      'catalog_setup', true,
      'individual_onboarding', true,
      'priority_support', true,
      'public_quote_response', true,
      'voice_assistant', true,
      'included_seats', 1,
      'extra_seat_amount_cents', 1500
    ),
    active = true
where code = 'artisan-essential';

update public.plan_prices price
set amount_cents = 7500,
    setup_fee_cents = 29000,
    currency = 'EUR',
    active = true
from public.subscription_plans plan
where price.plan_id = plan.id
  and plan.code = 'artisan-essential'
  and price.billing_interval = 'month'
  and price.valid_until is null;

update public.plan_prices price
set amount_cents = 75000,
    setup_fee_cents = 0,
    currency = 'EUR',
    active = true
from public.subscription_plans plan
where price.plan_id = plan.id
  and plan.code = 'artisan-essential'
  and price.billing_interval = 'year'
  and price.valid_until is null;

commit;
