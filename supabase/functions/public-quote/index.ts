// Returns the immutable quote snapshot associated with a public bearer token.
// Deploy with JWT verification disabled: supabase functions deploy public-quote --no-verify-jwt

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

  const token = await readToken(request);
  if (!token) {
    return json({ error: "Lien de devis invalide." }, 400);
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const tokenHash = await sha256(token);
  const { data: link, error: linkError } = await adminClient
    .from("quote_public_links")
    .select("id, quote_snapshot, snapshot_sha256, expires_at, used_at, revoked_at, view_count")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (linkError || !link || link.revoked_at) {
    return json({ error: "Ce lien de devis est invalide ou a été remplacé." }, 404);
  }

  const currentSnapshotHash = await sha256(canonicalStringify(link.quote_snapshot));
  if (currentSnapshotHash !== link.snapshot_sha256) {
    return json({ error: "Le document public ne peut pas être vérifié." }, 500);
  }

  const { data: response } = link.used_at
    ? await adminClient
        .from("quote_responses")
        .select("decision, comment, responded_at")
        .eq("public_link_id", link.id)
        .maybeSingle()
    : { data: null };

  const isExpired = new Date(link.expires_at).getTime() <= Date.now();
  const responseStatus = response?.decision === "rejected" ? "rejected" : "accepted";
  const status = link.used_at ? responseStatus : isExpired ? "expired" : "active";

  if (status === "active") {
    await adminClient
      .from("quote_public_links")
      .update({
        view_count: Number(link.view_count ?? 0) + 1,
        last_viewed_at: new Date().toISOString(),
      })
      .eq("id", link.id)
      .is("used_at", null)
      .is("revoked_at", null);
  }

  return json({
    status,
    quote: link.quote_snapshot,
    expiresAt: link.expires_at,
    respondedAt: response?.responded_at ?? link.used_at ?? null,
    responseComment: response?.comment ?? null,
  });
});

async function readToken(request: Request) {
  try {
    const body = await request.json();
    const token = String(body?.token ?? "").trim();
    return /^[A-Za-z0-9_-]{40,200}$/.test(token) ? token : null;
  } catch {
    return null;
  }
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
      "Cache-Control": "no-store, private",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}
