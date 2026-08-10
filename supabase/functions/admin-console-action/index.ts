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

function getPeriodEnd(interval: "month" | "year") {
  const end = new Date();
  if (interval === "year") end.setUTCFullYear(end.getUTCFullYear() + 1);
  else end.setUTCMonth(end.getUTCMonth() + 1);
  return end.toISOString();
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

  let body: { action?: string; payload?: Record<string, unknown> };
  try { body = await request.json(); } catch { return json({ error: "Corps invalide." }, 400); }
  const action = String(body.action ?? "");
  const payload = body.payload ?? {};

  try {
    let targetType = "unknown";
    let targetId: string | null = null;

    if (action === "activate_subscription") {
      const companyId = String(payload.company_id ?? "");
      const priceId = String(payload.price_id ?? "");
      if (!companyId || !priceId) {
        return json({ error: "Entreprise ou offre manquante." }, 422);
      }

      const [companyResult, priceResult] = await Promise.all([
        adminClient.from("companies").select("id").eq("id", companyId).maybeSingle(),
        adminClient
          .from("plan_prices")
          .select("id, plan_id, billing_interval, active, valid_until")
          .eq("id", priceId)
          .maybeSingle(),
      ]);
      if (companyResult.error || priceResult.error) {
        throw companyResult.error ?? priceResult.error;
      }
      if (!companyResult.data || !priceResult.data?.active || priceResult.data.valid_until) {
        return json({ error: "Entreprise ou offre inactive." }, 422);
      }

      const interval = priceResult.data.billing_interval as "month" | "year";
      const now = new Date().toISOString();
      const periodEnd = getPeriodEnd(interval);
      const { data: currentSubscription, error: currentError } = await adminClient
        .from("subscriptions")
        .select("id")
        .eq("company_id", companyId)
        .in("status", ["trialing", "active", "past_due"])
        .maybeSingle();
      if (currentError) throw currentError;

      if (currentSubscription) {
        const { error } = await adminClient
          .from("subscriptions")
          .update({
            plan_id: priceResult.data.plan_id,
            price_id: priceId,
            status: "active",
            current_period_start: now,
            current_period_end: periodEnd,
            cancel_at_period_end: false,
            updated_at: now,
          })
          .eq("id", currentSubscription.id);
        if (error) throw error;
        targetId = currentSubscription.id;
      } else {
        const { data, error } = await adminClient
          .from("subscriptions")
          .insert({
            company_id: companyId,
            plan_id: priceResult.data.plan_id,
            price_id: priceId,
            status: "active",
            current_period_start: now,
            current_period_end: periodEnd,
          })
          .select("id")
          .single();
        if (error) throw error;
        targetId = data.id;
      }

      const { error: requestError } = await adminClient
        .from("subscription_requests")
        .update({
          status: "approved",
          reviewed_by: user.id,
          reviewed_at: now,
          subscription_id: targetId,
          updated_at: now,
        })
        .eq("company_id", companyId)
        .eq("status", "pending");
      if (requestError) throw requestError;
      targetType = "subscription";
    } else if (action === "create_promotion") {
      const discountType = payload.discount_type === "fixed" ? "fixed" : "percentage";
      const value = Number(payload.value);
      if (!String(payload.code ?? "").trim() || !Number.isFinite(value) || value <= 0) return json({ error: "Code et remise invalides." }, 422);
      const { data, error } = await adminClient.from("promo_codes").insert({
        code: String(payload.code).trim().toUpperCase(),
        discount_type: discountType,
        percent_off: discountType === "percentage" ? value : null,
        amount_off_cents: discountType === "fixed" ? Math.round(value * 100) : null,
        currency: discountType === "fixed" ? "EUR" : null,
        starts_at: payload.starts_at || null,
        ends_at: payload.ends_at || null,
        max_redemptions: payload.max_redemptions || null,
        max_redemptions_per_company: payload.max_redemptions_per_company || 1,
        created_by: user.id,
      }).select("id").single();
      if (error) throw error;
      targetType = "promo_code";
      targetId = data.id;
    } else if (action === "set_design_active") {
      targetId = String(payload.design_id ?? "");
      const { error } = await adminClient.from("quote_designs").update({ active: payload.active === true }).eq("id", targetId);
      if (error) throw error;
      targetType = "quote_design";
    } else if (action === "create_design") {
      const name = String(payload.name ?? "").trim();
      const slug = String(payload.slug ?? "").trim().toLowerCase();
      const rendererKey = payload.renderer_key === "elegant" ? "elegant" : "standard";
      if (!name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return json({ error: "Nom ou identifiant de modèle invalide." }, 422);
      const { data, error } = await adminClient.from("quote_designs").insert({
        name,
        slug,
        description: String(payload.description ?? "").trim() || null,
        renderer_key: rendererKey,
        visibility: payload.visibility === "private" ? "private" : "public",
        active: true,
        created_by_admin: user.id,
      }).select("id").single();
      if (error) throw error;
      targetId = data.id;
      targetType = "quote_design";
    } else if (action === "assign_design") {
      targetId = String(payload.design_id ?? "");
      const companyId = String(payload.company_id ?? "");
      if (!targetId || !companyId) return json({ error: "Entreprise ou modèle manquant." }, 422);
      const { error } = await adminClient.from("company_quote_designs").upsert({ company_id: companyId, design_id: targetId, enabled: true, assigned_by: user.id }, { onConflict: "company_id,design_id" });
      if (error) throw error;
      targetType = "company_quote_design";
    } else if (action === "unassign_design") {
      targetId = String(payload.design_id ?? "");
      const companyId = String(payload.company_id ?? "");
      const { data: preference, error: preferenceError } = await adminClient.from("company_quote_preferences").select("default_design_id").eq("company_id", companyId).maybeSingle();
      if (preferenceError) throw preferenceError;
      if (preference?.default_design_id === targetId) return json({ error: "Choisissez d’abord un autre modèle par défaut." }, 409);
      const { error } = await adminClient.from("company_quote_designs").delete().eq("company_id", companyId).eq("design_id", targetId);
      if (error) throw error;
      targetType = "company_quote_design";
    } else if (action === "set_default_design") {
      targetId = String(payload.design_id ?? "");
      const companyId = String(payload.company_id ?? "");
      if (!targetId || !companyId) return json({ error: "Entreprise ou modèle manquant." }, 422);
      const { error: assignmentError } = await adminClient.from("company_quote_designs").upsert({ company_id: companyId, design_id: targetId, enabled: true, assigned_by: user.id }, { onConflict: "company_id,design_id" });
      if (assignmentError) throw assignmentError;
      const { error } = await adminClient.from("company_quote_preferences").upsert({ company_id: companyId, default_design_id: targetId }, { onConflict: "company_id" });
      if (error) throw error;
      targetType = "company_quote_preference";
    } else if (action === "set_promotion_active") {
      targetId = String(payload.promotion_id ?? "");
      const { error } = await adminClient.from("promo_codes").update({ active: payload.active === true }).eq("id", targetId);
      if (error) throw error;
      targetType = "promo_code";
    } else {
      return json({ error: "Action inconnue." }, 400);
    }

    await adminClient.from("admin_audit_log").insert({ actor_user_id: user.id, action, target_type: targetType, target_id: targetId, details: payload });
    return json({ ok: true, targetId });
  } catch (error) {
    console.error(error);
    return json({ error: "L’action administrateur a échoué." }, 500);
  }
});
