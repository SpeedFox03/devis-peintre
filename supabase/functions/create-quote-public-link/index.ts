// Creates a short-lived public quote link for an authenticated company owner.
// The raw bearer token is returned once; only its SHA-256 digest is persisted.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  if (request.method !== "POST") {
    return json({ error: "Méthode non autorisée." }, 405);
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization) {
    return json({ error: "Session manquante." }, 401);
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
  });
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    return json({ error: "Session invalide ou expirée." }, 401);
  }

  let quoteId: string;
  let replaceExisting: boolean;
  try {
    const body = await request.json();
    quoteId = String(body?.quoteId ?? "");
    replaceExisting = body?.replaceExisting !== false;
  } catch {
    return json({ error: "Corps de requête invalide." }, 400);
  }

  if (!UUID_PATTERN.test(quoteId)) {
    return json({ error: "Devis invalide." }, 400);
  }

  const { data: quote, error: quoteError } = await userClient
    .from("quotes")
    .select(
      "id, quote_number, title, description, status, issue_date, valid_until, notes, terms, subtotal_ht, total_tva, total_ttc, tva_rate, pdf_font_size_adjustment, pdf_other_section_position, customer_id, company_id",
    )
    .eq("id", quoteId)
    .single();

  if (quoteError || !quote) {
    return json({ error: "Devis introuvable ou accès refusé." }, 403);
  }

  if (!['draft', 'sent'].includes(String(quote.status))) {
    return json({ error: "Ce devis ne peut plus recevoir de nouveau lien client." }, 422);
  }

  const { data: ownedCompany, error: ownerError } = await userClient
    .from("companies")
    .select("id")
    .eq("id", quote.company_id)
    .eq("owner_user_id", user.id)
    .single();

  if (ownerError || !ownedCompany) {
    return json({ error: "Accès refusé à ce devis." }, 403);
  }

  const [
    itemsResult,
    roomsResult,
    companyResult,
    settingsResult,
    companyAddressResult,
    customerResult,
    customerAddressesResult,
  ] = await Promise.all([
    userClient
      .from("quote_items")
      .select("id, room_id, label, description, unit, quantity, unit_price_ht, tva_rate")
      .eq("quote_id", quoteId)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true }),
    userClient
      .from("quote_rooms")
      .select("id, name, sort_order, pdf_page_break")
      .eq("quote_id", quoteId)
      .order("sort_order", { ascending: true }),
    userClient
      .from("companies")
      .select("name, vat_number, email, phone, website, logo_url")
      .eq("id", quote.company_id)
      .single(),
    userClient
      .from("company_settings")
      .select("pdf_theme, pdf_color_mode, pdf_accent_color")
      .eq("company_id", quote.company_id)
      .maybeSingle(),
    userClient
      .from("addresses")
      .select("line1, line2, postal_code, city, country")
      .eq("entity_id", quote.company_id)
      .eq("entity_type", "company")
      .eq("role", "main")
      .maybeSingle(),
    userClient
      .from("customers")
      .select("company_name, first_name, last_name, email, phone")
      .eq("id", quote.customer_id)
      .single(),
    userClient
      .from("addresses")
      .select("role, line1, line2, postal_code, city, country")
      .eq("entity_id", quote.customer_id)
      .eq("entity_type", "customer"),
  ]);

  const firstError = [
    itemsResult.error,
    roomsResult.error,
    companyResult.error,
    settingsResult.error,
    companyAddressResult.error,
    customerResult.error,
    customerAddressesResult.error,
  ].find(Boolean);

  if (firstError || !companyResult.data || !customerResult.data) {
    return json({ error: "Impossible de préparer le devis public." }, 500);
  }

  const companyAddress = companyAddressResult.data;
  const customerAddresses = customerAddressesResult.data ?? [];
  const billingAddress = customerAddresses.find((address) => address.role === "billing");
  const jobsiteAddress = customerAddresses.find((address) => address.role === "jobsite");
  const roomIds = new Map<string, string>();

  const rooms = (roomsResult.data ?? []).map((room, index) => {
    const publicId = `room-${index + 1}`;
    roomIds.set(room.id, publicId);
    return {
      id: publicId,
      name: room.name,
      sort_order: room.sort_order,
      pdf_page_break: room.pdf_page_break,
    };
  });

  const items = (itemsResult.data ?? []).map((item, index) => ({
    id: `item-${index + 1}`,
    room_id: item.room_id ? roomIds.get(item.room_id) ?? null : null,
    label: item.label,
    description: item.description,
    unit: item.unit,
    quantity: item.quantity,
    unit_price_ht: item.unit_price_ht,
    tva_rate: item.tva_rate,
  }));

  const snapshot = {
    version: 1,
    data: {
      company: {
        ...companyResult.data,
        address_line1: companyAddress?.line1 ?? null,
        address_line2: companyAddress?.line2 ?? null,
        postal_code: companyAddress?.postal_code ?? null,
        city: companyAddress?.city ?? null,
        country: companyAddress?.country ?? null,
      },
      customer: {
        ...customerResult.data,
        billing_address_line1: billingAddress?.line1 ?? null,
        billing_address_line2: billingAddress?.line2 ?? null,
        billing_postal_code: billingAddress?.postal_code ?? null,
        billing_city: billingAddress?.city ?? null,
        billing_country: billingAddress?.country ?? null,
        jobsite_address_line1: jobsiteAddress?.line1 ?? null,
        jobsite_address_line2: jobsiteAddress?.line2 ?? null,
        jobsite_postal_code: jobsiteAddress?.postal_code ?? null,
        jobsite_city: jobsiteAddress?.city ?? null,
        jobsite_country: jobsiteAddress?.country ?? null,
      },
      quote: {
        quote_number: quote.quote_number,
        title: quote.title,
        description: quote.description,
        issue_date: quote.issue_date,
        valid_until: quote.valid_until,
        notes: quote.notes,
        terms: quote.terms,
        subtotal_ht: quote.subtotal_ht,
        total_tva: quote.total_tva,
        total_ttc: quote.total_ttc,
        tva_rate: quote.tva_rate,
        pdf_font_size_adjustment: quote.pdf_font_size_adjustment,
        pdf_other_section_position: quote.pdf_other_section_position,
      },
      rooms,
      items,
    },
    theme: settingsResult.data?.pdf_theme ?? null,
    colorMode: settingsResult.data?.pdf_color_mode ?? true,
    accentColor: settingsResult.data?.pdf_accent_color ?? null,
  };

  const expiresAt = getExpiryDate(quote.valid_until);
  if (expiresAt.getTime() <= Date.now()) {
    return json({ error: "La date de validité du devis est dépassée." }, 422);
  }

  const token = createToken();
  const tokenHash = await sha256(token);
  const snapshotHash = await sha256(canonicalStringify(snapshot));
  const now = new Date().toISOString();

  if (replaceExisting) {
    const { error: revokeError } = await adminClient
      .from("quote_public_links")
      .update({ revoked_at: now })
      .eq("quote_id", quoteId)
      .is("revoked_at", null)
      .is("used_at", null);

    if (revokeError) {
      return json({ error: "Impossible de renouveler le lien client." }, 500);
    }
  }

  const { error: insertError } = await adminClient.from("quote_public_links").insert({
    quote_id: quoteId,
    company_id: quote.company_id,
    customer_id: quote.customer_id,
    token_hash: tokenHash,
    recipient_email: customerResult.data.email,
    quote_snapshot: snapshot,
    snapshot_sha256: snapshotHash,
    expires_at: expiresAt.toISOString(),
    created_by: user.id,
  });

  if (insertError) {
    return json({ error: "Impossible de créer le lien client." }, 500);
  }

  return json({
    token,
    expiresAt: expiresAt.toISOString(),
    recipientEmail: customerResult.data.email,
  });
});

function getExpiryDate(validUntil: string | null) {
  if (validUntil) {
    return new Date(`${validUntil}T23:59:59.999Z`);
  }

  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
}

function createToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function canonicalStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalStringify(item)}`).join(",")}}`;
  }

  return JSON.stringify(value) ?? "null";
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
