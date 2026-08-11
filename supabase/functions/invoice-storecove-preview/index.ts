import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildStorecovePreview,
  type CustomerEinvoicingProfile,
  type SalesDocumentForStorecove,
  type SalesDocumentLineForStorecove,
  type SalesTaxTotalForStorecove,
  type StorecoveProfile,
} from "../_shared/storecove.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (request.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization) return json({ error: "Session manquante." }, 401);

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) return json({ error: "Session invalide ou expirée." }, 401);

  let documentId = "";
  let environment: "sandbox" | "production" = "sandbox";
  try {
    const body = await request.json();
    documentId = String(body?.documentId ?? "");
    environment = body?.environment === "production" ? "production" : "sandbox";
  } catch {
    return json({ error: "Corps de requête invalide." }, 400);
  }

  if (!UUID_PATTERN.test(documentId)) return json({ error: "Facture invalide." }, 400);

  const documentResult = await client
    .from("sales_documents")
    .select("id, company_id, customer_id, document_status, document_kind, document_number, issue_date, due_date, currency_code, customer_reference, buyer_reference, purchase_order_reference, payment_terms, payment_account_iban, payment_account_bic, notes, seller_snapshot, buyer_snapshot, total_ttc, prepaid_amount")
    .eq("id", documentId)
    .single();

  if (documentResult.error || !documentResult.data) {
    return json({ error: "Facture introuvable ou accès refusé." }, 404);
  }

  const document = documentResult.data;
  const [linesResult, taxResult, companyProfileResult, customerProfileResult] = await Promise.all([
    client
      .from("sales_document_lines")
      .select("line_identifier, label, description, quantity, unit_code, unit_price_ht, discount_amount, line_extension_amount, vat_category_code, vat_rate, tax_exemption_reason_code, tax_exemption_reason")
      .eq("document_id", documentId)
      .order("position"),
    client
      .from("sales_document_tax_totals")
      .select("vat_category_code, vat_rate, taxable_amount, tax_amount, tax_exemption_reason_code, tax_exemption_reason")
      .eq("document_id", documentId),
    client
      .from("company_einvoicing_profiles")
      .select("connection_status, storecove_legal_entity_id")
      .eq("company_id", document.company_id)
      .eq("environment", environment)
      .maybeSingle(),
    client
      .from("customer_einvoicing_profiles")
      .select("party_type, endpoint_scheme, endpoint_identifier, discovery_status")
      .eq("customer_id", document.customer_id)
      .eq("environment", environment)
      .maybeSingle(),
  ]);

  const loadError = linesResult.error ?? taxResult.error ?? companyProfileResult.error ?? customerProfileResult.error;
  if (loadError) return json({ error: "Impossible de préparer l’aperçu Storecove." }, 500);

  const preview = buildStorecovePreview({
    document: document as SalesDocumentForStorecove,
    lines: (linesResult.data ?? []) as SalesDocumentLineForStorecove[],
    taxTotals: (taxResult.data ?? []) as SalesTaxTotalForStorecove[],
    companyProfile: companyProfileResult.data as StorecoveProfile | null,
    customerProfile: customerProfileResult.data as CustomerEinvoicingProfile | null,
    apiKeyConfigured: Boolean(getApiKey(environment)),
  });

  return json({ environment, ...preview });
});

function getApiKey(environment: "sandbox" | "production") {
  const environmentKey = environment === "production"
    ? Deno.env.get("STORECOVE_PRODUCTION_API_KEY")
    : Deno.env.get("STORECOVE_SANDBOX_API_KEY");
  return environmentKey ?? Deno.env.get("STORECOVE_API_KEY");
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...CORS,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
