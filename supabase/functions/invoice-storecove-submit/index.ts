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
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STORECOVE_API_URL = "https://api.storecove.com/api/v2/document_submissions";
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

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
  });
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: { user }, error: userError } = await userClient.auth.getUser();
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

  const documentResult = await userClient
    .from("sales_documents")
    .select("id, company_id, customer_id, document_status, document_kind, document_number, issue_date, due_date, currency_code, customer_reference, buyer_reference, purchase_order_reference, payment_terms, payment_account_iban, payment_account_bic, notes, seller_snapshot, buyer_snapshot, total_ttc, prepaid_amount")
    .eq("id", documentId)
    .single();
  if (documentResult.error || !documentResult.data) return json({ error: "Facture introuvable ou accès refusé." }, 404);
  const document = documentResult.data;

  const [membershipResult, adminResult] = await Promise.all([
    admin.from("company_members").select("role, status").eq("company_id", document.company_id).eq("user_id", user.id).maybeSingle(),
    admin.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle(),
  ]);
  const membership = membershipResult.data;
  if (!adminResult.data && (!membership || membership.status !== "active" || !["owner", "admin"].includes(membership.role))) {
    return json({ error: "Seul un gestionnaire peut transmettre une facture." }, 403);
  }

  const apiKey = getApiKey(environment);
  const [linesResult, taxResult, companyProfileResult, customerProfileResult, activeSubmissionResult] = await Promise.all([
    userClient.from("sales_document_lines").select("line_identifier, label, description, quantity, unit_code, unit_price_ht, discount_amount, line_extension_amount, vat_category_code, vat_rate, tax_exemption_reason_code, tax_exemption_reason").eq("document_id", documentId).order("position"),
    userClient.from("sales_document_tax_totals").select("vat_category_code, vat_rate, taxable_amount, tax_amount, tax_exemption_reason_code, tax_exemption_reason").eq("document_id", documentId),
    userClient.from("company_einvoicing_profiles").select("connection_status, storecove_legal_entity_id").eq("company_id", document.company_id).eq("environment", environment).maybeSingle(),
    userClient.from("customer_einvoicing_profiles").select("party_type, endpoint_scheme, endpoint_identifier, discovery_status").eq("customer_id", document.customer_id).eq("environment", environment).maybeSingle(),
    admin.from("einvoice_submissions").select("id, status, provider_guid").eq("document_id", documentId).eq("environment", environment).not("status", "in", '(failed,rejected,no_action_taken)').maybeSingle(),
  ]);

  const loadError = linesResult.error ?? taxResult.error ?? companyProfileResult.error ?? customerProfileResult.error ?? activeSubmissionResult.error;
  if (loadError) return json({ error: "Impossible de préparer la transmission." }, 500);
  if (activeSubmissionResult.data) {
    return json({ error: "Cette facture possède déjà une transmission active.", submission: activeSubmissionResult.data }, 409);
  }

  const idempotencyGuid = crypto.randomUUID();
  const profile = companyProfileResult.data as StorecoveProfile | null;
  const customerProfile = customerProfileResult.data as CustomerEinvoicingProfile | null;
  const preview = buildStorecovePreview({
    document: document as SalesDocumentForStorecove,
    lines: (linesResult.data ?? []) as SalesDocumentLineForStorecove[],
    taxTotals: (taxResult.data ?? []) as SalesTaxTotalForStorecove[],
    companyProfile: profile,
    customerProfile,
    apiKeyConfigured: Boolean(apiKey),
    idempotencyGuid,
  });
  if (!preview.ready || !apiKey || !profile?.storecove_legal_entity_id) {
    return json({ error: "La facture n’est pas prête pour Storecove.", ...preview }, 422);
  }

  const routing = preview.payload.routing as { eIdentifiers?: Array<{ scheme: string; id: string }> } | undefined;
  const route = routing?.eIdentifiers?.[0];
  const { data: submission, error: insertError } = await admin.from("einvoice_submissions").insert({
    document_id: documentId,
    company_id: document.company_id,
    environment,
    provider_legal_entity_id: profile.storecove_legal_entity_id,
    idempotency_guid: idempotencyGuid,
    status: "requesting",
    routing_scheme: route?.scheme ?? null,
    routing_identifier: route?.id ?? null,
    request_payload: preview.payload,
    attempt_count: 1,
    created_by: user.id,
  }).select("id").single();

  if (insertError?.code === "23505") return json({ error: "Une transmission est déjà en cours pour cette facture." }, 409);
  if (insertError || !submission) return json({ error: "Impossible de réserver la transmission." }, 500);

  await admin.from("sales_documents").update({ delivery_status: "queued" }).eq("id", documentId);

  let storecoveResponse: Response;
  let responsePayload: Record<string, unknown>;
  try {
    storecoveResponse = await fetch(STORECOVE_API_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preview.payload),
      signal: AbortSignal.timeout(30_000),
    });
    const responseText = await storecoveResponse.text();
    try {
      responsePayload = responseText ? JSON.parse(responseText) : {};
    } catch {
      responsePayload = { raw: responseText.slice(0, 2_000) };
    }
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "Storecove est injoignable.";
    await markFailed(admin, submission.id, documentId, message, null);
    return json({ error: "Storecove est temporairement injoignable. La tentative a été conservée.", submissionId: submission.id }, 502);
  }

  if (!storecoveResponse.ok) {
    const message = extractStorecoveError(responsePayload, storecoveResponse.status);
    await markFailed(admin, submission.id, documentId, message, responsePayload);
    return json({ error: message, submissionId: submission.id }, 502);
  }

  const providerGuid = typeof responsePayload.guid === "string" ? responsePayload.guid : null;
  if (!providerGuid || !UUID_PATTERN.test(providerGuid)) {
    await markFailed(admin, submission.id, documentId, "Storecove n’a pas renvoyé de GUID valide.", responsePayload);
    return json({ error: "Réponse Storecove invalide.", submissionId: submission.id }, 502);
  }

  const now = new Date().toISOString();
  const { error: finalizeError } = await admin.from("einvoice_submissions").update({
    provider_guid: providerGuid,
    status: "submitted",
    response_payload: responsePayload,
    submitted_at: now,
    updated_at: now,
  }).eq("id", submission.id);
  const { error: documentUpdateError } = await admin.from("sales_documents").update({
    delivery_status: "submitted",
    updated_at: now,
  }).eq("id", documentId);

  if (finalizeError || documentUpdateError) {
    return json({ error: "Facture transmise, mais suivi local incomplet. Contactez l’administrateur.", submissionId: submission.id, providerGuid }, 500);
  }

  return json({ ok: true, submissionId: submission.id, providerGuid, status: "submitted" });
});

function getApiKey(environment: "sandbox" | "production") {
  const environmentKey = environment === "production"
    ? Deno.env.get("STORECOVE_PRODUCTION_API_KEY")
    : Deno.env.get("STORECOVE_SANDBOX_API_KEY");
  return environmentKey ?? Deno.env.get("STORECOVE_API_KEY");
}

async function markFailed(
  admin: ReturnType<typeof createClient>,
  submissionId: string,
  documentId: string,
  message: string,
  responsePayload: Record<string, unknown> | null,
) {
  const now = new Date().toISOString();
  await Promise.all([
    admin.from("einvoice_submissions").update({ status: "failed", error_message: message, response_payload: responsePayload, completed_at: now, updated_at: now }).eq("id", submissionId),
    admin.from("sales_documents").update({ delivery_status: "failed", updated_at: now }).eq("id", documentId),
  ]);
}

function extractStorecoveError(payload: Record<string, unknown>, status: number) {
  const details = payload.details ?? payload.error ?? payload.message;
  return typeof details === "string" && details.trim()
    ? `Storecove (${status}) : ${details.trim()}`
    : `Storecove a refusé la facture (HTTP ${status}).`;
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
