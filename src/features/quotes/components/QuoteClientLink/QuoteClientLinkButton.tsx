import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "../../../../components/ui/Button/Button";
import { CloseIcon, CopyIcon } from "../../../../components/ui/Icons/AppIcons";
import { supabase } from "../../../../lib/supabase";
import "./QuoteClientLinkButton.css";

type QuoteClientLinkButtonProps = {
  quoteId: string;
  quoteNumber: string;
  disabled?: boolean;
};

type LinkResult = {
  token: string;
  expiresAt: string;
  recipientEmail: string | null;
};

export function QuoteClientLinkButton({
  quoteId,
  quoteNumber,
  disabled = false,
}: QuoteClientLinkButtonProps) {
  const [creating, setCreating] = useState(false);
  const [clientUrl, setClientUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [recipientEmail, setRecipientEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!clientUrl) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setClientUrl(null);
        setExpiresAt(null);
        setRecipientEmail(null);
        setCopied(false);
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [clientUrl]);

  async function handleCreateLink() {
    setCreating(true);
    setError(null);
    setCopied(false);

    const { data, error: invokeError } = await supabase.functions.invoke(
      "create-quote-public-link",
      { body: { quoteId } },
    );

    if (invokeError) {
      const context = (invokeError as { context?: Response }).context;
      const payload = context
        ? (await context.clone().json().catch(() => null)) as { error?: string } | null
        : null;
      setError(payload?.error ?? invokeError.message);
      setCreating(false);
      return;
    }

    const result = data as LinkResult | null;
    if (!result?.token) {
      setError("Le lien client n'a pas pu être créé.");
      setCreating(false);
      return;
    }

    // A fragment is not sent to Netlify and therefore keeps the bearer token out of access logs.
    setClientUrl(`${window.location.origin}/devis-client#${encodeURIComponent(result.token)}`);
    setExpiresAt(result.expiresAt);
    setRecipientEmail(result.recipientEmail);
    setCreating(false);
  }

  async function handleCopy() {
    if (!clientUrl) return;

    try {
      await navigator.clipboard.writeText(clientUrl);
    } catch {
      inputRef.current?.focus();
      inputRef.current?.select();
      document.execCommand("copy");
    }

    setCopied(true);
  }

  function closeDialog() {
    setClientUrl(null);
    setExpiresAt(null);
    setRecipientEmail(null);
    setCopied(false);
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={handleCreateLink}
        disabled={disabled || creating}
        title={disabled ? "Le statut de ce devis ne permet plus de créer un lien" : undefined}
      >
        <CopyIcon />
        {creating ? "Création..." : "Lien client"}
      </Button>

      {error ? <p className="quote-client-link__inline-error" role="alert">{error}</p> : null}

      {clientUrl
        ? createPortal(
            <div
              className="quote-client-link__backdrop"
              role="presentation"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) closeDialog();
              }}
            >
              <section
                className="quote-client-link__dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="quote-client-link-title"
              >
                <div className="quote-client-link__heading">
                  <div>
                    <p className="quote-client-link__eyebrow">Devis {quoteNumber}</p>
                    <h2 id="quote-client-link-title">Lien client créé</h2>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    iconOnly
                    aria-label="Fermer"
                    onClick={closeDialog}
                  >
                    <CloseIcon />
                  </Button>
                </div>

                <p className="quote-client-link__description">
                  Le client pourra consulter le PDF et accepter le devis sans créer de compte.
                </p>

                <div className="quote-client-link__url-row">
                  <input ref={inputRef} value={clientUrl} readOnly aria-label="Lien client" />
                  <Button type="button" onClick={handleCopy}>
                    <CopyIcon />
                    {copied ? "Copié" : "Copier"}
                  </Button>
                </div>

                <div className="quote-client-link__meta">
                  {recipientEmail ? <span>Client : {recipientEmail}</span> : null}
                  {expiresAt ? <span>Expire le {formatDate(expiresAt)}</span> : null}
                </div>

                <p className="quote-client-link__warning">
                  Conservez ce lien maintenant : pour votre sécurité, son jeton secret n'est pas stocké en clair. Créer un autre lien invalidera celui-ci.
                </p>
              </section>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-BE", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(value));
}
