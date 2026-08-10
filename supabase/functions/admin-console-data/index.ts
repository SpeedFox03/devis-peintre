import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (request.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization) return json({ error: "Session manquante." }, 401);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authorization } } });
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: "Session invalide." }, 401);

  const { data: admin } = await adminClient.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!admin) return json({ error: "Accès administrateur requis." }, 403);

  let view = "overview";
  try { view = String((await request.json())?.view ?? "overview"); } catch { return json({ error: "Corps invalide." }, 400); }

  try {
    if (view === "overview") {
      const [companies, users, subscriptions, designs] = await Promise.all([
        adminClient.from("companies").select("id", { head: true, count: "exact" }),
        adminClient.from("profiles").select("id", { head: true, count: "exact" }),
        adminClient.from("subscriptions").select("id", { head: true, count: "exact" }).in("status", ["trialing", "active"]),
        adminClient.from("quote_designs").select("id", { head: true, count: "exact" }).eq("visibility", "private").eq("active", true),
      ]);
      return json({ metrics: { companies: companies.count ?? 0, users: users.count ?? 0, activeSubscriptions: subscriptions.count ?? 0, privateDesigns: designs.count ?? 0 } });
    }

    if (view === "accounts") {
      const [{ data: authData, error: authError }, profilesResult, membershipsResult, subscriptionsResult] = await Promise.all([
        adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 }),
        adminClient.from("profiles").select("id, full_name, last_seen_at, account_status"),
        adminClient.from("company_members").select("user_id, role, status, company_id, companies(name)"),
        adminClient.from("subscriptions").select("company_id, status, current_period_end, plan_prices(billing_interval)").in("status", ["trialing", "active", "past_due"]),
      ]);
      if (authError || profilesResult.error || membershipsResult.error || subscriptionsResult.error) throw authError ?? profilesResult.error ?? membershipsResult.error ?? subscriptionsResult.error;
      const profiles = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile]));
      const memberships = new Map((membershipsResult.data ?? []).map((membership) => [membership.user_id, membership]));
      const subscriptions = new Map((subscriptionsResult.data ?? []).map((subscription) => [subscription.company_id, subscription]));
      const accounts = authData.users.map((authUser) => {
        const profile = profiles.get(authUser.id);
        const membership = memberships.get(authUser.id) as { company_id?: string; role?: string; status?: string; companies?: { name?: string } | Array<{ name?: string }> } | undefined;
        const company = Array.isArray(membership?.companies) ? membership?.companies[0] : membership?.companies;
        const subscription = membership?.company_id ? subscriptions.get(membership.company_id) : undefined;
        const price = subscription?.plan_prices as { billing_interval?: string } | null | undefined;
        return {
          user_id: authUser.id,
          email: authUser.email ?? "",
          full_name: profile?.full_name ?? null,
          company_id: membership?.company_id ?? null,
          company_name: company?.name ?? null,
          role: membership?.role ?? null,
          created_at: authUser.created_at,
          last_seen_at: profile?.last_seen_at ?? authUser.last_sign_in_at ?? null,
          status: profile?.account_status ?? membership?.status ?? "active",
          subscription_status: subscription?.status ?? "inactive",
          billing_interval: price?.billing_interval ?? null,
          current_period_end: subscription?.current_period_end ?? null,
        };
      });
      return json({ accounts });
    }

    if (view === "subscriptions") {
      const [subscriptionsResult, requestsResult, pricesResult, companiesResult] = await Promise.all([
        adminClient
          .from("subscriptions")
          .select("id, company_id, price_id, status, current_period_end, companies(name), subscription_plans(name), plan_prices(billing_interval)")
          .order("created_at", { ascending: false }),
        adminClient
          .from("subscription_requests")
          .select("id, company_id, price_id, requested_at, companies(name), plan_prices(billing_interval, amount_cents, setup_fee_cents, currency), promo_codes(code)")
          .eq("status", "pending")
          .order("requested_at", { ascending: true }),
        adminClient
          .from("plan_prices")
          .select("id, billing_interval, amount_cents, setup_fee_cents, currency, subscription_plans!inner(name)")
          .eq("active", true)
          .is("valid_until", null),
        adminClient.from("companies").select("id, name").order("name"),
      ]);

      const loadError = subscriptionsResult.error ?? requestsResult.error ?? pricesResult.error ?? companiesResult.error;
      if (loadError) throw loadError;

      return json({
        subscriptions: (subscriptionsResult.data ?? []).map((row) => ({
          id: row.id,
          company_id: row.company_id,
          company_name: (row.companies as { name?: string } | null)?.name ?? "—",
          plan_name: (row.subscription_plans as { name?: string } | null)?.name ?? "—",
          price_id: row.price_id,
          billing_interval: (row.plan_prices as { billing_interval?: string } | null)?.billing_interval ?? "month",
          status: row.status,
          current_period_end: row.current_period_end,
        })),
        subscriptionRequests: (requestsResult.data ?? []).map((row) => ({
          id: row.id,
          company_id: row.company_id,
          company_name: (row.companies as { name?: string } | null)?.name ?? "—",
          price_id: row.price_id,
          billing_interval: (row.plan_prices as { billing_interval?: string } | null)?.billing_interval ?? "month",
          amount_cents: (row.plan_prices as { amount_cents?: number } | null)?.amount_cents ?? 0,
          setup_fee_cents: (row.plan_prices as { setup_fee_cents?: number } | null)?.setup_fee_cents ?? 0,
          currency: (row.plan_prices as { currency?: string } | null)?.currency ?? "EUR",
          promo_code: (row.promo_codes as { code?: string } | null)?.code ?? null,
          requested_at: row.requested_at,
        })),
        planPrices: (pricesResult.data ?? []).map((row) => ({
          id: row.id,
          plan_name: (row.subscription_plans as { name?: string } | null)?.name ?? "Premium artisan",
          billing_interval: row.billing_interval,
          amount_cents: row.amount_cents,
          setup_fee_cents: row.setup_fee_cents,
          currency: row.currency,
        })),
        companies: companiesResult.data ?? [],
      });
    }

    if (view === "designs") {
      const [designsResult, assignmentsResult, preferencesResult, companiesResult] = await Promise.all([
        adminClient.from("quote_designs").select("id, name, slug, description, renderer_key, visibility, active").order("created_at"),
        adminClient.from("company_quote_designs").select("design_id, company_id, enabled"),
        adminClient.from("company_quote_preferences").select("company_id, default_design_id"),
        adminClient.from("companies").select("id, name").order("name"),
      ]);
      if (designsResult.error || assignmentsResult.error || preferencesResult.error || companiesResult.error) throw designsResult.error ?? assignmentsResult.error ?? preferencesResult.error ?? companiesResult.error;
      const counts = new Map<string, number>();
      for (const assignment of assignmentsResult.data ?? []) {
        if (assignment.enabled) counts.set(assignment.design_id, (counts.get(assignment.design_id) ?? 0) + 1);
      }
      return json({
        designs: (designsResult.data ?? []).map((design) => ({ ...design, assigned_companies: counts.get(design.id) ?? 0 })),
        designAssignments: assignmentsResult.data ?? [],
        designPreferences: preferencesResult.data ?? [],
        companies: companiesResult.data ?? [],
      });
    }

    if (view === "promotions") {
      const [promotionsResult, redemptionsResult] = await Promise.all([
        adminClient.from("promo_codes").select("id, code, discount_type, percent_off, amount_off_cents, currency, starts_at, ends_at, max_redemptions, active").order("created_at", { ascending: false }),
        adminClient.from("promo_redemptions").select("promo_code_id"),
      ]);
      if (promotionsResult.error || redemptionsResult.error) throw promotionsResult.error ?? redemptionsResult.error;
      const counts = new Map<string, number>();
      for (const redemption of redemptionsResult.data ?? []) counts.set(redemption.promo_code_id, (counts.get(redemption.promo_code_id) ?? 0) + 1);
      return json({ promotions: (promotionsResult.data ?? []).map((promotion) => ({ id: promotion.id, code: promotion.code, discount_label: promotion.discount_type === "percentage" ? `${promotion.percent_off}%` : `${((promotion.amount_off_cents ?? 0) / 100).toFixed(2)} ${promotion.currency ?? "EUR"}`, starts_at: promotion.starts_at, ends_at: promotion.ends_at, redemption_count: counts.get(promotion.id) ?? 0, max_redemptions: promotion.max_redemptions, active: promotion.active })) });
    }

    return json({ error: "Vue inconnue." }, 400);
  } catch (error) {
    console.error(error);
    return json({ error: "Impossible de charger les données administrateur." }, 500);
  }
});
