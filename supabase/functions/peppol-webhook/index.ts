// =============================================================================
// Edge Function: peppol-webhook
// POST /functions/v1/peppol-webhook
// Receives delivery status callbacks from the Access Point provider.
// No auth header required — secured by webhook secret verification instead.
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getProvider } from "../_shared/peppol/providerFactory.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("PEPPOL_WEBHOOK_SECRET") ?? "";

// Map provider event types → peppol_status column values
const EVENT_TO_STATUS: Record<string, string> = {
  submitted: "submitted",
  accepted: "submitted",
  delivered: "delivered",
  rejected: "rejected",
  error: "error",
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const rawBody = await req.text();
  const headers = Object.fromEntries(req.headers.entries());

  // ── Signature verification ────────────────────────────────────────────────
  if (WEBHOOK_SECRET) {
    try {
      const provider = getProvider();
      // verifyWebhookSignature is async — must be awaited so the signature
      // check actually runs before we process the payload.
      await provider.verifyWebhookSignature(rawBody, headers, WEBHOOK_SECRET);
    } catch (err) {
      console.error("Webhook signature verification failed:", (err as Error).message);
      return new Response("Forbidden", { status: 403 });
    }
  } else {
    console.warn("PEPPOL_WEBHOOK_SECRET is not set — signature verification skipped.");
  }

  // ── Parse payload ─────────────────────────────────────────────────────────
  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    return new Response("Bad Request: invalid JSON", { status: 400 });
  }

  let event;
  try {
    const provider = getProvider();
    event = provider.parseWebhook(parsedBody, headers);
  } catch (err) {
    console.error("Webhook parse error:", (err as Error).message);
    return new Response(`Bad Request: ${(err as Error).message}`, { status: 400 });
  }

  // ── Find the matching invoice by peppol_message_id ────────────────────────
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: invoice, error: findError } = await adminClient
    .from("invoices")
    .select("id, owner_user_id, peppol_status")
    .eq("peppol_message_id", event.providerMessageId)
    .maybeSingle();

  if (findError) {
    console.error("DB lookup error:", findError.message);
    return new Response("Internal Server Error", { status: 500 });
  }

  if (!invoice) {
    // Return 200 to prevent the provider from retrying — we just don't know this ID
    console.warn(`No invoice found for providerMessageId="${event.providerMessageId}"`);
    return new Response("OK", { status: 200 });
  }

  const newStatus = EVENT_TO_STATUS[event.eventType] ?? "error";
  const now = new Date().toISOString();

  // ── Update invoice peppol_status ──────────────────────────────────────────
  await adminClient
    .from("invoices")
    .update({
      peppol_status: newStatus,
      peppol_last_status_at: now,
    })
    .eq("id", invoice.id);

  // ── Insert audit event ────────────────────────────────────────────────────
  await adminClient.from("invoice_peppol_events").insert({
    invoice_id: invoice.id,
    owner_user_id: invoice.owner_user_id,
    event_type: event.eventType,
    provider_message_id: event.providerMessageId,
    payload_excerpt: event.rawPayload,
    error_message: event.errorMessage ?? null,
  });

  console.log(
    `Peppol webhook processed: invoice=${invoice.id} event=${event.eventType} status=${newStatus}`
  );

  // Always return 200 to acknowledge receipt
  return new Response("OK", { status: 200 });
});