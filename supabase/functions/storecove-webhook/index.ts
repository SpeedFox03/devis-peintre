import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);

  const expectedSecret = Deno.env.get("STORECOVE_WEBHOOK_SECRET");
  if (!expectedSecret) return json({ error: "Webhook Storecove non configuré." }, 503);

  const suppliedSecret = request.headers.get("x-storecove-webhook-secret") ?? "";
  if (!safeEqual(expectedSecret, suppliedSecret)) return json({ error: "Signature invalide." }, 401);

  const rawBody = await request.text();
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: "JSON invalide." }, 400);
  }

  const providerGuid = optionalUuid(payload.guid);
  const idempotencyGuid = optionalUuid(payload.idempotencyGuid ?? payload.idempotency_guid);
  if (!providerGuid && !idempotencyGuid) {
    return json({ error: "Identifiant de soumission manquant." }, 400);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  let submissionQuery = admin
    .from("einvoice_submissions")
    .select("id, company_id, document_id, environment")
    .limit(1);

  submissionQuery = providerGuid
    ? submissionQuery.eq("provider_guid", providerGuid)
    : submissionQuery.eq("idempotency_guid", idempotencyGuid!);

  const { data: submissions, error: submissionError } = await submissionQuery;
  if (submissionError) return json({ error: "Recherche de soumission impossible." }, 500);
  const submission = submissions?.[0];

  // Un 500 force Storecove à retenter. Cela couvre notamment la courte course
  // possible entre l'appel API et l'enregistrement local de la soumission.
  if (!submission) return json({ error: "Soumission inconnue, nouvelle tentative requise." }, 500);

  const eventName = String(payload.event ?? "unknown");
  const eventType = String(payload.event_type ?? "document_submission");
  const eventGroup = payload.event_group ? String(payload.event_group) : null;
  const deduplicationKey = await sha256(rawBody);
  const now = new Date().toISOString();

  const { error: insertError } = await admin.from("einvoice_events").insert({
    company_id: submission.company_id,
    document_id: submission.document_id,
    submission_id: submission.id,
    environment: submission.environment,
    deduplication_key: deduplicationKey,
    provider_guid: providerGuid,
    idempotency_guid: idempotencyGuid,
    event_type: eventType,
    event_group: eventGroup,
    event_name: eventName,
    details: payload.details ? String(payload.details) : null,
    payload,
    processed_at: now,
  });

  if (insertError?.code === "23505") return json({ ok: true, duplicate: true });
  if (insertError) return json({ error: "Journalisation du webhook impossible." }, 500);

  const mapped = mapEvent(eventName);
  const submissionUpdate: Record<string, unknown> = {
    status: mapped.submissionStatus,
    response_payload: payload,
    updated_at: now,
  };
  if (mapped.completed) submissionUpdate.completed_at = now;

  const { error: updateSubmissionError } = await admin
    .from("einvoice_submissions")
    .update(submissionUpdate)
    .eq("id", submission.id);

  const { error: updateDocumentError } = await admin
    .from("sales_documents")
    .update({ delivery_status: mapped.deliveryStatus, updated_at: now })
    .eq("id", submission.document_id);

  if (updateSubmissionError || updateDocumentError) {
    await admin
      .from("einvoice_events")
      .update({ processed_at: null, processing_error: "Mise à jour des statuts impossible." })
      .eq("deduplication_key", deduplicationKey);
    return json({ error: "Mise à jour du suivi impossible." }, 500);
  }

  return json({ ok: true });
});

function mapEvent(eventName: string) {
  switch (eventName) {
    case "cleared":
      return { submissionStatus: "cleared", deliveryStatus: "cleared", completed: false };
    case "succeeded":
      return { submissionStatus: "succeeded", deliveryStatus: "succeeded", completed: true };
    case "accepted":
    case "conditionally_accepted":
      return { submissionStatus: eventName, deliveryStatus: "accepted", completed: true };
    case "rejected":
      return { submissionStatus: "rejected", deliveryStatus: "rejected", completed: true };
    case "failed":
    case "no_action_taken":
      return { submissionStatus: eventName, deliveryStatus: "failed", completed: true };
    case "acknowledged":
    case "in_process":
    case "under_query":
      return { submissionStatus: eventName, deliveryStatus: "submitted", completed: false };
    default:
      return { submissionStatus: eventName, deliveryStatus: "submitted", completed: false };
  }
}

function optionalUuid(value: unknown) {
  const stringValue = typeof value === "string" ? value : "";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(stringValue)
    ? stringValue
    : null;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function safeEqual(expected: string, actual: string) {
  if (expected.length !== actual.length) return false;
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= expected.charCodeAt(index) ^ actual.charCodeAt(index);
  }
  return mismatch === 0;
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
