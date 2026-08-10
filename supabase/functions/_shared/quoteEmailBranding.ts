export type EmailBrandingRow = {
  subject_template?: string | null;
  heading?: string | null;
  intro_text?: string | null;
  button_label?: string | null;
  signature?: string | null;
  primary_color?: string | null;
  background_color?: string | null;
  show_logo?: boolean | null;
};

export type EmailBranding = {
  subjectTemplate: string;
  heading: string;
  introText: string;
  buttonLabel: string;
  signature: string;
  primaryColor: string;
  backgroundColor: string;
  showLogo: boolean;
};

export type EmailTemplateTokens = {
  companyName: string;
  clientName: string;
  quoteNumber: string;
  quoteTitle: string;
};

export type QuoteEmailContent = EmailTemplateTokens & {
  totalTtc: number;
  expiresAt: string;
  quoteUrl: string;
  personalMessage: string;
  logoUrl: string | null;
};

const DEFAULT_BRANDING: EmailBranding = {
  subjectTemplate: "Votre devis {{quote_number}} – {{company_name}}",
  heading: "Votre devis est prêt",
  introText: "{{company_name}} vous invite à consulter son devis en ligne.",
  buttonLabel: "Consulter et répondre au devis",
  signature: "Merci pour votre confiance.",
  primaryColor: "#6f523c",
  backgroundColor: "#f6efe6",
  showLogo: true,
};

export function normalizeEmailBranding(row: EmailBrandingRow | null): EmailBranding {
  return {
    subjectTemplate: boundedText(row?.subject_template, DEFAULT_BRANDING.subjectTemplate, 200),
    heading: boundedText(row?.heading, DEFAULT_BRANDING.heading, 120),
    introText: boundedText(row?.intro_text, DEFAULT_BRANDING.introText, 600),
    buttonLabel: boundedText(row?.button_label, DEFAULT_BRANDING.buttonLabel, 60),
    signature: optionalText(row?.signature, 300),
    primaryColor: safeColor(row?.primary_color, DEFAULT_BRANDING.primaryColor),
    backgroundColor: safeColor(row?.background_color, DEFAULT_BRANDING.backgroundColor),
    showLogo: row?.show_logo ?? DEFAULT_BRANDING.showLogo,
  };
}

export function buildQuoteEmailSubject(
  branding: EmailBranding,
  tokens: EmailTemplateTokens,
) {
  const resolved = renderTemplate(branding.subjectTemplate, tokens).trim();
  return (resolved || `Votre devis ${tokens.quoteNumber} – ${tokens.companyName}`).slice(0, 300);
}

export function buildQuoteEmailHtml(
  content: QuoteEmailContent,
  branding: EmailBranding,
) {
  const intro = renderTemplate(branding.introText, content);
  const heading = renderTemplate(branding.heading, content);
  const buttonLabel = renderTemplate(branding.buttonLabel, content);
  const signature = renderTemplate(branding.signature, content);
  const logoUrl = branding.showLogo ? safeHttpsUrl(content.logoUrl) : null;
  const messageBlock = content.personalMessage
    ? `<div style="margin:22px 0;padding:16px 18px;border-left:3px solid ${branding.primaryColor};background:#f8f5f1;border-radius:0 10px 10px 0;line-height:1.65">${escapeHtml(content.personalMessage).replaceAll("\n", "<br>")}</div>`
    : "";
  const logoBlock = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(content.companyName)}" style="display:block;max-width:180px;max-height:70px;margin:0 0 22px;object-fit:contain">`
    : "";

  return `
    <!doctype html>
    <html lang="fr">
      <head>
        <meta name="viewport" content="width=device-width,initial-scale=1">
      </head>
      <body style="margin:0;background:${branding.backgroundColor};color:#34251b;font-family:Arial,sans-serif">
        <div style="max-width:620px;margin:0 auto;padding:36px 18px">
          <div style="background:#fffdf9;border:1px solid ${branding.primaryColor}33;border-radius:18px;overflow:hidden">
            <div style="padding:30px 30px 22px;border-bottom:1px solid ${branding.primaryColor}26">
              ${logoBlock}
              <p style="margin:0 0 7px;color:${branding.primaryColor};font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase">Votre devis</p>
              <h1 style="margin:0;color:#2f2118;font-size:27px;line-height:1.25">${escapeHtml(heading)}</h1>
              <p style="margin:8px 0 0;color:#806b5a;line-height:1.5">${escapeHtml(content.quoteNumber)} · ${escapeHtml(content.quoteTitle)}</p>
            </div>
            <div style="padding:28px 30px 32px">
              <p style="margin:0 0 14px;line-height:1.65">Bonjour ${escapeHtml(content.clientName)},</p>
              <p style="margin:0;line-height:1.65;white-space:pre-wrap">${escapeHtml(intro)}</p>
              ${messageBlock}
              <div style="margin:24px 0;padding:18px;background:#f8f5f1;border-radius:12px">
                <table role="presentation" style="width:100%;border-collapse:collapse">
                  <tr>
                    <td style="padding:3px 0;color:#806b5a">Montant total TTC</td>
                    <td style="padding:3px 0;text-align:right;color:#2f2118;font-weight:700">${formatCurrency(content.totalTtc)}</td>
                  </tr>
                  <tr>
                    <td style="padding:7px 0 3px;color:#806b5a">Lien valable jusqu'au</td>
                    <td style="padding:7px 0 3px;text-align:right;color:#2f2118">${formatDate(content.expiresAt)}</td>
                  </tr>
                </table>
              </div>
              <div style="margin:26px 0;text-align:center">
                <a href="${escapeHtml(content.quoteUrl)}" style="display:inline-block;padding:14px 24px;border-radius:10px;background:${branding.primaryColor};color:#fff;font-weight:700;text-decoration:none">${escapeHtml(buttonLabel)}</a>
              </div>
              ${signature ? `<p style="margin:0 0 14px;color:#5f4d40;line-height:1.6;white-space:pre-wrap">${escapeHtml(signature)}</p>` : ""}
              <p style="margin:0;color:#806b5a;font-size:13px;line-height:1.6">Le lien est personnel et permet d'accepter le devis ou de le refuser en indiquant un motif.</p>
            </div>
          </div>
          <p style="margin:18px 0 0;color:#806b5a;font-size:12px;text-align:center">Envoyé par ${escapeHtml(content.companyName)}</p>
        </div>
      </body>
    </html>
  `;
}

export function buildQuoteEmailText(
  content: QuoteEmailContent,
  branding: EmailBranding,
) {
  const intro = renderTemplate(branding.introText, content);
  const heading = renderTemplate(branding.heading, content);
  const signature = renderTemplate(branding.signature, content);

  return [
    heading,
    "",
    `Bonjour ${content.clientName},`,
    "",
    intro,
    `${content.quoteNumber} – ${content.quoteTitle}`,
    content.personalMessage ? `\n${content.personalMessage}` : "",
    "",
    `Montant total TTC : ${formatCurrency(content.totalTtc)}`,
    `Lien valable jusqu'au ${formatDate(content.expiresAt)}`,
    "",
    `${renderTemplate(branding.buttonLabel, content)} : ${content.quoteUrl}`,
    signature ? `\n${signature}` : "",
    "",
    "Ce lien est personnel. Ne le transférez pas à un tiers.",
  ].filter((line, index, lines) => line !== "" || lines[index - 1] !== "").join("\n");
}

function renderTemplate(value: string, tokens: EmailTemplateTokens) {
  return value
    .replaceAll("{{company_name}}", tokens.companyName)
    .replaceAll("{{client_name}}", tokens.clientName)
    .replaceAll("{{quote_number}}", tokens.quoteNumber)
    .replaceAll("{{quote_title}}", tokens.quoteTitle);
}

function boundedText(value: string | null | undefined, fallback: string, maxLength: number) {
  const normalized = String(value ?? "").trim();
  return normalized && normalized.length <= maxLength ? normalized : fallback;
}

function optionalText(value: string | null | undefined, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function safeColor(value: string | null | undefined, fallback: string) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(normalized) ? normalized : fallback;
}

function safeHttpsUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-BE", {
    style: "currency",
    currency: "EUR",
  }).format(Number.isFinite(value) ? value : 0);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-BE", { dateStyle: "long" }).format(new Date(value));
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
