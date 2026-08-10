// Tests the Resend configuration stored for an authenticated user's company.
// The API key is read server-side from Supabase Vault and is never returned.

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

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ResendCredentials = {
  provider: "resend";
  from_name: string;
  from_email: string;
  reply_to_email: string | null;
  enabled: boolean;
  api_key: string;
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

  let companyId: string;
  try {
    const body = await request.json();
    companyId = String(body?.companyId ?? "");
  } catch {
    return json({ error: "Corps de requête invalide." }, 400);
  }

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(companyId)) {
    return json({ error: "Entreprise invalide." }, 400);
  }

  const { data: company, error: companyError } = await userClient
    .from("companies")
    .select("id, name, email, logo_url")
    .eq("id", companyId)
    .eq("owner_user_id", user.id)
    .single();

  if (companyError || !company) {
    return json({ error: "Entreprise introuvable ou accès refusé." }, 403);
  }

  const [credentialsResult, brandingResult] = await Promise.all([
    adminClient.rpc("get_company_resend_credentials", {
      p_company_id: companyId,
    }),
    adminClient
      .from("company_email_settings")
      .select(
        "subject_template, heading, intro_text, button_label, signature, primary_color, background_color, show_logo",
      )
      .eq("company_id", companyId)
      .single(),
  ]);

  const { data: credentialRows, error: credentialsError } = credentialsResult;
  const credentials = (credentialRows?.[0] ?? null) as ResendCredentials | null;
  if (credentialsError || !credentials?.api_key) {
    return json({ error: "Aucune clé Resend n'est configurée pour cette entreprise." }, 422);
  }

  if (!credentials.enabled) {
    return json({ error: "Active la configuration e-mail avant de la tester." }, 422);
  }

  if (brandingResult.error || !brandingResult.data) {
    return json({ error: "Le design de l'e-mail ne peut pas être chargé." }, 500);
  }

  const branding = normalizeEmailBranding(
    brandingResult.data as EmailBrandingRow,
  );

  const recipient = credentials.reply_to_email || company.email || user.email;
  if (!recipient) {
    return json({ error: "Aucune adresse ne peut recevoir l'e-mail de test." }, 422);
  }

  const testedAt = new Date().toISOString();
  const safeFromName = credentials.from_name.replace(/[<>"\r\n]/g, "").trim();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const previewContent = {
    companyName: company.name,
    clientName: "Sophie Martin",
    quoteNumber: "DEV-2026-0011",
    quoteTitle: "Travaux de peinture intérieure",
    totalTtc: 2450,
    expiresAt,
    quoteUrl: "https://appdevispeinture.netlify.app",
    personalMessage: "Ceci est un aperçu du design configuré pour vos futurs e-mails de devis.",
    logoUrl: company.logo_url,
  };

  let resendResponse: Response;
  try {
    resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credentials.api_key}`,
        "Content-Type": "application/json",
        "User-Agent": "devis-peintre/1.0",
      },
      body: JSON.stringify({
        from: `${safeFromName} <${credentials.from_email}>`,
        to: [recipient],
        reply_to: credentials.reply_to_email || undefined,
        subject: `[TEST] ${buildQuoteEmailSubject(branding, previewContent)}`.slice(0, 300),
        html: buildQuoteEmailHtml(previewContent, branding),
        text: buildQuoteEmailText(previewContent, branding),
      }),
    });
  } catch {
    const message = "Le service Resend est temporairement inaccessible.";
    await saveTestResult(adminClient, companyId, testedAt, "error", message);
    return json({ error: message }, 502);
  }

  const providerPayload = await resendResponse.json().catch(() => null) as
    | { id?: string; message?: string; error?: string }
    | null;

  if (!resendResponse.ok) {
    const message = String(
      providerPayload?.message ||
        providerPayload?.error ||
        `Resend a refusé l'envoi (${resendResponse.status}).`,
    ).slice(0, 500);
    await saveTestResult(adminClient, companyId, testedAt, "error", message);
    return json({ error: message }, 422);
  }

  await saveTestResult(adminClient, companyId, testedAt, "success", null);
  return json({
    success: true,
    recipient,
    providerMessageId: providerPayload?.id ?? null,
  });
});

async function saveTestResult(
  adminClient: ReturnType<typeof createClient>,
  companyId: string,
  testedAt: string,
  status: "success" | "error",
  errorMessage: string | null,
) {
  await adminClient
    .from("company_email_settings")
    .update({
      last_tested_at: testedAt,
      last_test_status: status,
      last_error_message: errorMessage,
      updated_at: testedAt,
    })
    .eq("company_id", companyId);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
