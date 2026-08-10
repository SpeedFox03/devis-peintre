// Creates a fresh public quote link and sends it through the company's Resend account.
// The authenticated caller never receives the Resend API key or the link token.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildQuoteEmailHtml,
  buildQuoteEmailSubject,
  buildQuoteEmailText,
  normalizeEmailBranding,
  type EmailBrandingRow,
} from "../_shared/quoteEmailBranding.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PUBLIC_APP_URL = normalizeAppUrl(
  Deno.env.get("PUBLIC_APP_URL") || "https://appdevispeinture.netlify.app",
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ResendCredentials = {
  provider: "resend";
  from_name: string;
  from_email: string;
  reply_to_email: string | null;
  enabled: boolean;
  api_key: string;
};

type LinkResult = {
  token?: string;
  expiresAt?: string;
  recipientEmail?: string | null;
  error?: string;
};

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
  let personalMessage: string;
  try {
    const body = await request.json();
    quoteId = String(body?.quoteId ?? "").trim();
    personalMessage = String(body?.personalMessage ?? "").trim();
  } catch {
    return json({ error: "Corps de requête invalide." }, 400);
  }

  if (!UUID_PATTERN.test(quoteId)) {
    return json({ error: "Devis invalide." }, 400);
  }

  if (personalMessage.length > 1000) {
    return json({ error: "Le message personnel ne peut pas dépasser 1000 caractères." }, 400);
  }

  const { data: quote, error: quoteError } = await userClient
    .from("quotes")
    .select(
      "id, quote_number, title, status, valid_until, total_ttc, customer_id, company_id",
    )
    .eq("id", quoteId)
    .single();

  if (quoteError || !quote) {
    return json({ error: "Devis introuvable ou accès refusé." }, 403);
  }

  if (!["draft", "sent"].includes(String(quote.status))) {
    return json({ error: "Ce devis ne peut plus être envoyé au client." }, 422);
  }

  const [{ data: company }, { data: customer }, { data: ownedCompany }] = await Promise.all([
    userClient
      .from("companies")
      .select("id, name, logo_url")
      .eq("id", quote.company_id)
      .single(),
    userClient
      .from("customers")
      .select("company_name, first_name, last_name, email")
      .eq("id", quote.customer_id)
      .single(),
    userClient
      .from("companies")
      .select("id")
      .eq("id", quote.company_id)
      .eq("owner_user_id", user.id)
      .single(),
  ]);

  if (!company || !customer || !ownedCompany) {
    return json({ error: "Impossible de préparer l'envoi de ce devis." }, 403);
  }

  const recipientEmail = String(customer.email ?? "").trim().toLowerCase();
  if (!EMAIL_PATTERN.test(recipientEmail)) {
    return json({ error: "Le client ne possède pas d'adresse e-mail valide." }, 422);
  }

  const [credentialsResult, brandingResult] = await Promise.all([
    adminClient.rpc("get_company_resend_credentials", {
      p_company_id: quote.company_id,
    }),
    adminClient
      .from("company_email_settings")
      .select(
        "subject_template, heading, intro_text, button_label, signature, primary_color, background_color, show_logo",
      )
      .eq("company_id", quote.company_id)
      .single(),
  ]);
  const { data: credentialRows, error: credentialsError } = credentialsResult;
  const credentials = (credentialRows?.[0] ?? null) as ResendCredentials | null;

  if (credentialsError || !credentials?.api_key) {
    return json({ error: "Aucune clé Resend n'est configurée pour cette entreprise." }, 422);
  }

  if (!credentials.enabled) {
    return json({ error: "L'envoi d'e-mails est désactivé dans les paramètres." }, 422);
  }

  if (brandingResult.error || !brandingResult.data) {
    return json({ error: "Le design de l'e-mail ne peut pas être chargé." }, 500);
  }

  const branding = normalizeEmailBranding(
    brandingResult.data as EmailBrandingRow,
  );

  const linkResponse = await fetch(`${SUPABASE_URL}/functions/v1/create-quote-public-link`, {
    method: "POST",
    headers: {
      Authorization: authorization,
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
      "User-Agent": "devis-peintre/1.0",
    },
    body: JSON.stringify({ quoteId, replaceExisting: false }),
  });
  const linkResult = await linkResponse.json().catch(() => null) as LinkResult | null;

  if (!linkResponse.ok || !linkResult?.token || !linkResult.expiresAt) {
    return json(
      { error: linkResult?.error || "Le lien sécurisé du devis n'a pas pu être créé." },
      linkResponse.status >= 400 && linkResponse.status < 500 ? linkResponse.status : 502,
    );
  }

  const tokenHash = await sha256(linkResult.token);
  const { data: publicLink, error: publicLinkError } = await adminClient
    .from("quote_public_links")
    .select("id")
    .eq("token_hash", tokenHash)
    .single();

  if (publicLinkError || !publicLink) {
    await revokeLink(adminClient, tokenHash);
    return json({ error: "Le lien sécurisé n'a pas pu être vérifié." }, 500);
  }

  const clientName = getCustomerName(customer);
  const templateTokens = {
    companyName: company.name,
    clientName,
    quoteNumber: quote.quote_number,
    quoteTitle: quote.title,
  };
  const subject = buildQuoteEmailSubject(branding, templateTokens);
  const { data: delivery, error: deliveryError } = await adminClient
    .from("quote_email_deliveries")
    .insert({
      quote_id: quoteId,
      public_link_id: publicLink.id,
      company_id: quote.company_id,
      recipient_email: recipientEmail,
      subject,
      personal_message: personalMessage || null,
      status: "pending",
      initiated_by: user.id,
    })
    .select("id")
    .single();

  if (deliveryError || !delivery) {
    await revokeLink(adminClient, tokenHash);
    return json({ error: "L'envoi n'a pas pu être enregistré dans l'historique." }, 500);
  }

  const quoteUrl = `${PUBLIC_APP_URL}/devis-client#${encodeURIComponent(linkResult.token)}`;
  const safeFromName = credentials.from_name.replace(/[<>"\r\n]/g, "").trim();
  const emailContent = {
    ...templateTokens,
    totalTtc: Number(quote.total_ttc),
    expiresAt: linkResult.expiresAt,
    quoteUrl,
    personalMessage,
    logoUrl: company.logo_url,
  };
  const emailPayload = {
    from: `${safeFromName} <${credentials.from_email}>`,
    to: [recipientEmail],
    reply_to: credentials.reply_to_email || undefined,
    subject,
    html: buildQuoteEmailHtml(emailContent, branding),
    text: buildQuoteEmailText(emailContent, branding),
  };

  let resendResponse: Response;
  try {
    resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credentials.api_key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `quote-email/${delivery.id}`,
        "User-Agent": "devis-peintre/1.0",
      },
      body: JSON.stringify(emailPayload),
    });
  } catch {
    const message = "Le service Resend est temporairement inaccessible.";
    await markFailure(adminClient, delivery.id, tokenHash, message);
    return json({ error: message }, 502);
  }

  const resendPayload = await resendResponse.json().catch(() => null) as
    | { id?: string; message?: string; error?: string }
    | null;

  if (!resendResponse.ok || !resendPayload?.id) {
    const message = String(
      resendPayload?.message ||
        resendPayload?.error ||
        `Resend a refusé l'envoi (${resendResponse.status}).`,
    ).slice(0, 1000);
    await markFailure(adminClient, delivery.id, tokenHash, message);
    return json({ error: message }, 422);
  }

  await adminClient
    .from("quote_public_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("quote_id", quoteId)
    .neq("id", publicLink.id)
    .is("revoked_at", null)
    .is("used_at", null);

  const { data: finalizedRows, error: finalizeError } = await adminClient.rpc(
    "finalize_quote_email_delivery",
    {
      p_delivery_id: delivery.id,
      p_provider_message_id: resendPayload.id,
    },
  );

  if (finalizeError || !finalizedRows?.[0]) {
    // The provider accepted the message, so do not revoke the link even if the audit update failed.
    return json({
      success: true,
      recipientEmail,
      sentAt: new Date().toISOString(),
      providerMessageId: resendPayload.id,
      warning: "L'e-mail est parti, mais son historique n'a pas pu être finalisé.",
    });
  }

  return json({
    success: true,
    recipientEmail,
    sentAt: finalizedRows[0].sent_at,
    providerMessageId: resendPayload.id,
  });
});

async function markFailure(
  adminClient: ReturnType<typeof createClient>,
  deliveryId: string,
  tokenHash: string,
  message: string,
) {
  const now = new Date().toISOString();
  await Promise.all([
    adminClient
      .from("quote_email_deliveries")
      .update({ status: "failed", error_message: message.slice(0, 1000), updated_at: now })
      .eq("id", deliveryId)
      .eq("status", "pending"),
    revokeLink(adminClient, tokenHash),
  ]);
}

async function revokeLink(
  adminClient: ReturnType<typeof createClient>,
  tokenHash: string,
) {
  await adminClient
    .from("quote_public_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("token_hash", tokenHash)
    .is("used_at", null);
}

function normalizeAppUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") throw new Error("HTTPS required");
    return url.origin;
  } catch {
    return "https://appdevispeinture.netlify.app";
  }
}

function getCustomerName(customer: {
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
}) {
  return (
    customer.company_name ||
    [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
    "Madame, Monsieur"
  );
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
      "Cache-Control": "no-store",
    },
  });
}
