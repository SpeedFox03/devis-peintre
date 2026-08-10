import { supabase } from "../../lib/supabase";

export type AdminView = "overview" | "accounts" | "subscriptions" | "designs" | "promotions";

export type AdminConsoleData = {
  metrics?: { companies: number; users: number; activeSubscriptions: number; privateDesigns: number };
  accounts?: Array<{ user_id: string; email: string; full_name: string | null; company_id: string | null; company_name: string | null; role: string | null; created_at: string; last_seen_at: string | null; status: string; subscription_status: string; billing_interval: string | null; current_period_end: string | null }>;
  subscriptions?: Array<{ id: string; company_id: string; company_name: string; plan_name: string; price_id: string; billing_interval: string; status: string; current_period_end: string | null }>;
  subscriptionRequests?: Array<{ id: string; company_id: string; company_name: string; price_id: string; billing_interval: string; amount_cents: number; setup_fee_cents: number; currency: string; promo_code: string | null; requested_at: string }>;
  planPrices?: Array<{ id: string; plan_name: string; billing_interval: "month" | "year"; amount_cents: number; setup_fee_cents: number; currency: string }>;
  designs?: Array<{ id: string; name: string; slug: string; description: string | null; renderer_key: string; visibility: string; active: boolean; assigned_companies: number }>;
  designAssignments?: Array<{ design_id: string; company_id: string; enabled: boolean }>;
  designPreferences?: Array<{ company_id: string; default_design_id: string }>;
  promotions?: Array<{ id: string; code: string; discount_label: string; starts_at: string | null; ends_at: string | null; redemption_count: number; max_redemptions: number | null; active: boolean }>;
  companies?: Array<{ id: string; name: string }>;
};

export async function loadAdminView(view: AdminView) {
  const { data, error } = await supabase.functions.invoke("admin-console-data", { body: { view } });
  if (error) throw error;
  if (data && typeof data === "object" && "error" in data) {
    throw new Error(String(data.error));
  }
  return (data ?? {}) as AdminConsoleData;
}

export async function runAdminAction(action: string, payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("admin-console-action", { body: { action, payload } });
  if (error) throw error;
  if (data && typeof data === "object" && "error" in data) {
    throw new Error(String(data.error));
  }
  return data;
}
