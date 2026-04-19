// =============================================================================
// Edge Function: send-peppol-invoice
// POST /functions/v1/send-peppol-invoice
// Body: { invoiceId: string }
// Auth: Supabase JWT required (Authorization: Bearer <token>)
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getProvider } from "../_shared/peppol/providerFactory.ts";
import {
  buildPeppolInvoiceXml,
  validatePeppolInvoiceInput,
} from "../_shared/peppol/buildPeppolInvoiceXml.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing Authorization header." }, 401);

  // userClient  → RLS-aware, for reading invoice data as the authenticated user
  // adminClient → service role, for writing audit events + updating status
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // ── Parse body ────────────────────────────────────────────────────────────
  let invoiceId: string;
  try {
    const body = await req.json();
    invoiceId = body?.invoiceId;
    if (!invoiceId) throw new Error("Missing invoiceId.");
  } catch (err) {
    return json({ error: `Invalid request body: ${(err as Error).message}` }, 400);
  }

  // ── Fetch invoice + items (RLS enforced via userClient) ───────────────────
  const [invoiceRes, itemsRes] = await Promise.all([
    userClient
      .from("invoices")
      .select(`
        id, invoice_number, invoice_type, issue_date, due_date,
        currency_code, tax_currency_code, customer_reference,
        purchase_order_reference, payment_terms, notes, buyer_reference,
        subtotal_ht, discount_amount, total_tva, total_ttc,
        amount_paid, balance_due, peppol_customization_id, peppol_profile_id,
        seller_endpoint_id, seller_endpoint_scheme,
        buyer_endpoint_id, buyer_endpoint_scheme,
        seller_company_id, buyer_company_id,
        payment_means_code, payment_account_iban, payment_account_bic,
        payment_due_date, source_invoice_number,
        company_name_snapshot, company_vat_number_snapshot,
        company_email_snapshot, company_phone_snapshot,
        company_address_line1_snapshot, company_address_line2_snapshot,
        company_postal_code_snapshot, company_city_snapshot,
        company_country_snapshot, company_iban_snapshot, company_bic_snapshot,
        customer_company_name_snapshot, customer_first_name_snapshot,
        customer_last_name_snapshot, customer_email_snapshot,
        customer_phone_snapshot,
        customer_billing_address_line1_snapshot, customer_billing_address_line2_snapshot,
        customer_billing_postal_code_snapshot, customer_billing_city_snapshot,
        customer_billing_country_snapshot,
        customer_jobsite_address_line1_snapshot, customer_jobsite_address_line2_snapshot,
        customer_jobsite_postal_code_snapshot, customer_jobsite_city_snapshot,
        customer_jobsite_country_snapshot,
        owner_user_id, status, peppol_status
      `)
      .eq("id", invoiceId)
      .single(),

    userClient
      .from("invoice_items")
      .select(`
        id, label, description, quantity, unit, unit_code,
        unit_price_ht, discount_amount, tva_rate, vat_category_code,
        tax_exemption_reason, line_subtotal_ht, line_total_tva,
        line_total_ttc, sort_order
      `)
      .eq("invoice_id", invoiceId)
      .order("sort_order", { ascending: true }),
  ]);

  if (invoiceRes.error) return json({ error: invoiceRes.error.message }, 400);
  if (itemsRes.error) return json({ error: itemsRes.error.message }, 400);

  const invoice = invoiceRes.data;
  const items = itemsRes.data ?? [];
  const ownerUserId: string = invoice.owner_user_id;

  // ── Guard: only send issued/sent invoices ─────────────────────────────────
  const sendableStatuses = ["issued", "sent", "partially_paid"];
  if (!sendableStatuses.includes(invoice.status)) {
    return json(
      {
        error: `Impossible d'envoyer une facture avec le statut "${invoice.status}". ` +
          `Statuts acceptés : ${sendableStatuses.join(", ")}.`,
      },
      422
    );
  }

  // ── Validate UBL content ──────────────────────────────────────────────────
  try {
    validatePeppolInvoiceInput({ invoice, items });
  } catch (err) {
    await logEvent(adminClient, {
      invoiceId, ownerUserId, eventType: "error",
      errorMessage: (err as Error).message,
    });
    return json({ error: (err as Error).message }, 422);
  }

  // ── Build XML ─────────────────────────────────────────────────────────────
  let xml: string;
  try {
    xml = buildPeppolInvoiceXml({ invoice, items });
  } catch (err) {
    await logEvent(adminClient, {
      invoiceId, ownerUserId, eventType: "error",
      errorMessage: `XML build failed: ${(err as Error).message}`,
    });
    return json({ error: `Erreur de génération XML : ${(err as Error).message}` }, 500);
  }

  await logEvent(adminClient, { invoiceId, ownerUserId, eventType: "validated" });

  // ── Send via provider ─────────────────────────────────────────────────────
  let providerMessageId: string;
  let rawResponse: unknown;

  try {
    const provider = getProvider();
    const result = await provider.send({
      xml,
      fileName: `${invoice.invoice_number}.xml`,
      receiverEndpointId: invoice.buyer_endpoint_id!,
      receiverEndpointScheme: invoice.buyer_endpoint_scheme!,
      senderEndpointId: invoice.seller_endpoint_id!,
      senderEndpointScheme: invoice.seller_endpoint_scheme!,
      invoiceId,
    });
    providerMessageId = result.providerMessageId;
    rawResponse = result.rawResponse;
  } catch (err) {
    await logEvent(adminClient, {
      invoiceId, ownerUserId, eventType: "error",
      errorMessage: `Provider error: ${(err as Error).message}`,
    });
    await adminClient
      .from("invoices")
      .update({
        peppol_status: "error",
        peppol_last_status_at: new Date().toISOString(),
      })
      .eq("id", invoiceId);

    return json({ error: (err as Error).message }, 502);
  }

  // ── Persist result ────────────────────────────────────────────────────────
  await Promise.all([
    adminClient
      .from("invoices")
      .update({
        peppol_status: "submitted",
        peppol_message_id: providerMessageId,
        peppol_sent_at: new Date().toISOString(),
        peppol_last_status_at: new Date().toISOString(),
      })
      .eq("id", invoiceId),

    logEvent(adminClient, {
      invoiceId, ownerUserId, eventType: "submitted",
      providerMessageId, payloadExcerpt: rawResponse,
    }),
  ]);

  return json({ success: true, providerMessageId });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

async function logEvent(
  client: ReturnType<typeof createClient>,
  opts: {
    invoiceId: string;
    ownerUserId: string;
    eventType: string;
    providerMessageId?: string;
    payloadExcerpt?: unknown;
    errorMessage?: string;
  }
) {
  await client.from("invoice_peppol_events").insert({
    invoice_id: opts.invoiceId,
    owner_user_id: opts.ownerUserId,
    event_type: opts.eventType,
    provider_message_id: opts.providerMessageId ?? null,
    payload_excerpt: opts.payloadExcerpt ?? null,
    error_message: opts.errorMessage ?? null,
  });
}