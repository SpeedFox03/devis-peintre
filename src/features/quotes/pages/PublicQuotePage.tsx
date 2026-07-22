import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "../../../components/ui/Button/Button";
import { env } from "../../../lib/env";
import { generateQuotePdf } from "../pdf/generateQuotePdf";
import type { QuotePdfData } from "../pdf/quotePdfTypes";
import "./PublicQuotePage.css";

type QuoteDecision = "accepted" | "rejected";
type PublicQuoteStatus = "active" | QuoteDecision | "expired";

type PublicQuoteSnapshot = {
  version: number;
  data: Omit<QuotePdfData, "logoBase64">;
  theme: string | null;
  colorMode: boolean | null;
  accentColor: string | null;
};

type PublicQuotePayload = {
  status: PublicQuoteStatus;
  quote: PublicQuoteSnapshot;
  expiresAt: string;
  respondedAt: string | null;
  responseComment: string | null;
};

type ApiError = {
  error?: string;
};

export function PublicQuotePage() {
  // The secret stays in the URL fragment so Netlify never receives it in access logs.
  const token = useMemo(readPublicToken, []);
  const [payload, setPayload] = useState<PublicQuotePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [decision, setDecision] = useState<QuoteDecision>("accepted");
  const [comment, setComment] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const quote = payload?.quote.data.quote;
  const companyName = payload?.quote.data.company?.name || "Votre artisan";
  const customerName = useMemo(() => {
    const customer = payload?.quote.data.customer;
    if (!customer) return "Client";
    return (
      customer.company_name ||
      [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
      "Client"
    );
  }, [payload]);

  useEffect(() => {
    const previousTitle = document.title;
    let robotsMeta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const createdRobotsMeta = !robotsMeta;

    if (!robotsMeta) {
      robotsMeta = document.createElement("meta");
      robotsMeta.name = "robots";
      document.head.appendChild(robotsMeta);
    }

    const previousRobotsContent = robotsMeta.content;
    robotsMeta.content = "noindex, nofollow, noarchive";
    document.title = "Consultation de votre devis";

    return () => {
      document.title = previousTitle;
      if (createdRobotsMeta) robotsMeta?.remove();
      else if (robotsMeta) robotsMeta.content = previousRobotsContent;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadQuote() {
      setLoading(true);
      setError(null);

      try {
        const response = await callPublicFunction<PublicQuotePayload>("public-quote", { token });
        if (!cancelled) setPayload(response);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Impossible de charger le devis.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadQuote();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!payload) return;

    let cancelled = false;
    let objectUrl: string | null = null;
    setPdfError(null);
    setPdfUrl(null);

    async function buildPdfPreview() {
      try {
        const pdf = await generateQuotePdf(
          payload!.quote.data,
          payload!.quote.theme,
          payload!.quote.colorMode,
          payload!.quote.accentColor,
        );
        const blob = await pdf.getBlob();
        objectUrl = URL.createObjectURL(blob);

        if (!cancelled) {
          setPdfUrl(objectUrl);
          objectUrl = null;
        }
      } catch {
        if (!cancelled) setPdfError("L'aperçu PDF n'a pas pu être généré.");
      }
    }

    void buildPdfPreview();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [payload]);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  async function handleResponse(event: FormEvent) {
    event.preventDefault();
    if (!confirmed || !payload || payload.status !== "active") return;
    if (decision === "rejected" && comment.trim().length < 3) {
      setError("Le motif du refus est obligatoire (3 caractères minimum).");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await callPublicFunction<{
        decision: QuoteDecision;
        respondedAt: string;
      }>("respond-to-quote", { token, decision, comment });

      setPayload((current) =>
        current
          ? {
              ...current,
              status: response.decision,
              respondedAt: response.respondedAt,
              responseComment: comment.trim() || null,
            }
          : current,
      );
      setConfirmed(false);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "La réponse au devis n'a pas pu être enregistrée.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="public-quote-page public-quote-page--centered">
        <div className="public-quote-state" role="status">
          <span className="public-quote-spinner" aria-hidden="true" />
          <h1>Chargement de votre devis</h1>
          <p>Nous préparons son aperçu sécurisé.</p>
        </div>
      </main>
    );
  }

  if (!payload) {
    return (
      <main className="public-quote-page public-quote-page--centered">
        <div className="public-quote-state public-quote-state--error">
          <span className="public-quote-state__icon" aria-hidden="true">!</span>
          <h1>Lien indisponible</h1>
          <p>{error || "Ce lien est invalide, expiré ou a été remplacé."}</p>
          <p className="public-quote-state__hint">Demandez un nouveau lien à votre artisan.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="public-quote-page">
      <div className="public-quote-shell">
        <header className="public-quote-header">
          <div>
            <p className="public-quote-eyebrow">Devis sécurisé</p>
            <h1>{quote?.quote_number}</h1>
            <p className="public-quote-header__title">{quote?.title}</p>
          </div>

          <div className="public-quote-header__company">
            <span>Proposé par</span>
            <strong>{companyName}</strong>
          </div>
        </header>

        <section className="public-quote-preview" aria-labelledby="quote-preview-title">
          <div className="public-quote-section-heading">
            <div>
              <p className="public-quote-eyebrow">Document</p>
              <h2 id="quote-preview-title">Votre devis</h2>
            </div>

            {pdfUrl ? (
              <a
                className="public-quote-download"
                href={pdfUrl}
                download={`${quote?.quote_number || "devis"}.pdf`}
              >
                Télécharger le PDF
              </a>
            ) : null}
          </div>

          <div className="public-quote-preview__frame">
            {pdfUrl ? (
              <iframe src={pdfUrl} title={`Devis ${quote?.quote_number || "client"}`} />
            ) : pdfError ? (
              <div className="public-quote-preview__fallback">
                <p>{pdfError}</p>
              </div>
            ) : (
              <div className="public-quote-preview__fallback" role="status">
                <span className="public-quote-spinner" aria-hidden="true" />
                <p>Génération de l'aperçu PDF...</p>
              </div>
            )}
          </div>
        </section>

        <section className="public-quote-response" aria-labelledby="quote-response-title">
          {payload.status === "accepted" ? (
            <div className="public-quote-result public-quote-result--success">
              <span className="public-quote-result__icon" aria-hidden="true">✓</span>
              <div>
                <p className="public-quote-eyebrow">Réponse enregistrée</p>
                <h2 id="quote-response-title">Merci, {customerName}</h2>
                <p>
                  Le devis <strong>{quote?.quote_number}</strong> a bien été accepté
                  {payload.respondedAt ? ` le ${formatDateTime(payload.respondedAt)}` : ""}.
                </p>
                {payload.responseComment ? (
                  <blockquote>{payload.responseComment}</blockquote>
                ) : null}
              </div>
            </div>
          ) : payload.status === "rejected" ? (
            <div className="public-quote-result public-quote-result--rejected">
              <span className="public-quote-result__icon" aria-hidden="true">×</span>
              <div>
                <p className="public-quote-eyebrow">Réponse enregistrée</p>
                <h2 id="quote-response-title">Refus transmis</h2>
                <p>
                  Le refus du devis <strong>{quote?.quote_number}</strong> a bien été transmis à {companyName}.
                </p>
                <blockquote>
                  <strong>Motif du refus</strong>
                  <span>{payload.responseComment}</span>
                </blockquote>
              </div>
            </div>
          ) : payload.status === "expired" ? (
            <div className="public-quote-result public-quote-result--warning">
              <span className="public-quote-result__icon" aria-hidden="true">i</span>
              <div>
                <p className="public-quote-eyebrow">Validité terminée</p>
                <h2 id="quote-response-title">Ce devis ne peut plus être validé en ligne</h2>
                <p>Il reste consultable ci-dessus. Contactez {companyName} pour obtenir une nouvelle proposition.</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleResponse}>
              <p className="public-quote-eyebrow">Votre réponse</p>
              <h2 id="quote-response-title">Répondre à ce devis</h2>
              <p className="public-quote-response__intro">
                Vérifiez le document ci-dessus, puis choisissez si vous souhaitez l'accepter ou le refuser.
              </p>

              <div className="public-quote-decision" role="group" aria-label="Votre décision">
                <Button
                  type="button"
                  variant={decision === "accepted" ? "primary" : "secondary"}
                  aria-pressed={decision === "accepted"}
                  onClick={() => {
                    setDecision("accepted");
                    setConfirmed(false);
                    setError(null);
                  }}
                >
                  Accepter le devis
                </Button>
                <Button
                  type="button"
                  variant={decision === "rejected" ? "danger" : "secondary"}
                  aria-pressed={decision === "rejected"}
                  onClick={() => {
                    setDecision("rejected");
                    setConfirmed(false);
                    setError(null);
                  }}
                >
                  Refuser le devis
                </Button>
              </div>

              <label className="public-quote-field">
                <span>
                  {decision === "rejected" ? (
                    <>Motif du refus <small>(obligatoire)</small></>
                  ) : (
                    <>Commentaire <small>(facultatif)</small></>
                  )}
                </span>
                <textarea
                  rows={4}
                  maxLength={2000}
                  minLength={decision === "rejected" ? 3 : undefined}
                  required={decision === "rejected"}
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder={
                    decision === "rejected"
                      ? "Expliquez la raison de votre refus..."
                      : "Une précision à transmettre à votre artisan..."
                  }
                />
                <small>{comment.length}/2000 caractères</small>
              </label>

              <label className="public-quote-confirmation">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
                <span>
                  {decision === "accepted"
                    ? "Je confirme avoir consulté le devis et j'accepte son contenu et son montant."
                    : "Je confirme avoir consulté le devis et souhaite le refuser pour le motif indiqué."}
                </span>
              </label>

              {error ? <p className="public-quote-form-error" role="alert">{error}</p> : null}

              <Button
                type="submit"
                variant={decision === "rejected" ? "danger" : "primary"}
                disabled={
                  !confirmed ||
                  submitting ||
                  (decision === "rejected" && comment.trim().length < 3)
                }
              >
                {submitting
                  ? "Enregistrement en cours..."
                  : decision === "rejected"
                    ? "Confirmer le refus"
                    : "Confirmer l'acceptation"}
              </Button>

              <p className="public-quote-response__expiry">
                Lien valable jusqu'au {formatDate(payload.expiresAt)}.
              </p>
            </form>
          )}
        </section>

        <footer className="public-quote-footer">
          Ce lien est personnel. Ne le transférez pas à un tiers.
        </footer>
      </div>
    </main>
  );
}

async function callPublicFunction<T>(functionName: string, body: object): Promise<T> {
  const response = await fetch(`${env.supabaseUrl}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      apikey: env.supabaseAnonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as (T & ApiError) | null;

  if (!response.ok) {
    throw new Error(payload?.error || "Le service est temporairement indisponible.");
  }

  if (!payload) {
    throw new Error("Réponse du service invalide.");
  }

  return payload;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-BE", { dateStyle: "long" }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("fr-BE", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(value));
}

function readPublicToken() {
  try {
    return decodeURIComponent(window.location.hash.replace(/^#(?:token=)?/, "")).trim();
  } catch {
    return "";
  }
}
