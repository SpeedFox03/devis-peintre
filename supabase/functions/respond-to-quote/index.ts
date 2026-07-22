// Accepts or rejects a public quote atomically from its bearer token.
// Deploy with JWT verification disabled: supabase functions deploy respond-to-quote --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  if (request.method !== "POST") {
    return json({ error: "Méthode non autorisée." }, 405);
  }

  let token: string;
  let decision: string;
  let comment: string;
  try {
    const body = await request.json();
    token = String(body?.token ?? "").trim();
    decision = String(body?.decision ?? "accepted").trim().toLowerCase();
    comment = String(body?.comment ?? "").trim();
  } catch {
    return json({ error: "Corps de requête invalide." }, 400);
  }

  if (!/^[A-Za-z0-9_-]{40,200}$/.test(token)) {
    return json({ error: "Lien de devis invalide." }, 400);
  }

  if (!['accepted', 'rejected'].includes(decision)) {
    return json({ error: "La réponse au devis est invalide." }, 400);
  }

  if (comment.length > 2000) {
    return json({ error: "Le commentaire ne peut pas dépasser 2000 caractères." }, 400);
  }

  if (decision === "rejected" && comment.length < 3) {
    return json({ error: "Le motif du refus est obligatoire (3 caractères minimum)." }, 400);
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const tokenHash = await sha256(token);
  const userAgent = request.headers.get("user-agent")?.slice(0, 500) ?? null;
  const { data, error } = await adminClient.rpc("respond_to_quote_with_public_token", {
    p_token_hash: tokenHash,
    p_decision: decision,
    p_comment: comment || null,
    p_user_agent: userAgent,
  });

  if (error) {
    const message = publicRpcError(error.message);
    return json({ error: message }, message.includes("expiré") ? 410 : 409);
  }

  const result = data?.[0];
  if (!result) {
    return json({ error: "La réponse au devis n'a pas pu être enregistrée." }, 500);
  }

  return json({
    success: true,
    quoteNumber: result.quote_number,
    decision: result.decision,
    respondedAt: result.responded_at,
  });
});

function publicRpcError(message: string) {
  const allowedMessages = [
    "Lien de devis invalide.",
    "La réponse au devis est invalide.",
    "Le motif du refus est obligatoire (3 caractères minimum).",
    "Lien de devis introuvable.",
    "Ce lien a été révoqué.",
    "Ce lien a expiré.",
    "Ce devis a déjà reçu une réponse.",
    "Devis introuvable.",
    "Ce devis ne peut plus recevoir de réponse.",
  ];

  return allowedMessages.find((allowed) => message.includes(allowed)) ??
    "Ce devis ne peut pas être validé pour le moment.";
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS,
      "Content-Type": "application/json",
      "Cache-Control": "no-store, private",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}
