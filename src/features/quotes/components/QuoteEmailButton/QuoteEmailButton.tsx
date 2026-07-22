import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "../../../../components/ui/Button/Button";
import { CloseIcon } from "../../../../components/ui/Icons/AppIcons";
import { supabase } from "../../../../lib/supabase";
import "./QuoteEmailButton.css";

type QuoteEmailButtonProps = {
  quoteId: string;
  quoteNumber: string;
  recipientEmail: string | null;
  disabled?: boolean;
  onSent?: () => void | Promise<void>;
};

type SendResult = {
  success: boolean;
  recipientEmail: string;
  sentAt: string;
  providerMessageId: string;
  warning?: string;
};

export function QuoteEmailButton({
  quoteId,
  quoteNumber,
  recipientEmail,
  disabled = false,
  onSent,
}: QuoteEmailButtonProps) {
  const [open, setOpen] = useState(false);
  const [personalMessage, setPersonalMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SendResult | null>(null);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !sending) {
        setOpen(false);
        setPersonalMessage("");
        setError(null);
        setResult(null);
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, sending]);

  function openDialog() {
    setOpen(true);
    setError(null);
    setResult(null);
  }

  function closeDialog() {
    if (sending) return;
    setOpen(false);
    setPersonalMessage("");
    setError(null);
    setResult(null);
  }

  async function handleSend() {
    setSending(true);
    setError(null);

    const { data, error: invokeError } = await supabase.functions.invoke(
      "send-quote-email",
      {
        body: {
          quoteId,
          personalMessage,
        },
      },
    );

    if (invokeError) {
      const context = (invokeError as { context?: Response }).context;
      const payload = context
        ? (await context.clone().json().catch(() => null)) as { error?: string } | null
        : null;
      setError(payload?.error ?? invokeError.message);
      setSending(false);
      return;
    }

    const sendResult = data as SendResult | null;
    if (!sendResult?.success) {
      setError("L'e-mail n'a pas pu être envoyé.");
      setSending(false);
      return;
    }

    setResult(sendResult);
    setSending(false);
    await onSent?.();
  }

  return (
    <>
      <Button
        type="button"
        variant="primary"
        onClick={openDialog}
        disabled={disabled}
        title={
          disabled
            ? recipientEmail
              ? "Le statut de ce devis ne permet plus son envoi"
              : "Ajoutez une adresse e-mail sur la fiche du client"
            : undefined
        }
      >
        Envoyer au client
      </Button>

      {open
        ? createPortal(
            <div
              className="quote-email__backdrop"
              role="presentation"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget && !sending) closeDialog();
              }}
            >
              <section
                className="quote-email__dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="quote-email-title"
              >
                <div className="quote-email__heading">
                  <div>
                    <p className="quote-email__eyebrow">Devis {quoteNumber}</p>
                    <h2 id="quote-email-title">
                      {result ? "E-mail envoyé" : "Envoyer le devis au client"}
                    </h2>
                  </div>

                  <Button
                    type="button"
                    variant="secondary"
                    iconOnly
                    aria-label="Fermer"
                    onClick={closeDialog}
                    disabled={sending}
                  >
                    <CloseIcon />
                  </Button>
                </div>

                {result ? (
                  <div className="quote-email__success" role="status">
                    <span className="quote-email__success-icon" aria-hidden="true">✓</span>
                    <div>
                      <strong>Le devis a bien été transmis.</strong>
                      <p>
                        Destinataire : {result.recipientEmail}<br />
                        Envoyé le {formatDateTime(result.sentAt)}
                      </p>
                      {result.warning ? <p className="quote-email__warning">{result.warning}</p> : null}
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="quote-email__description">
                      Un nouveau lien personnel sera créé et envoyé à <strong>{recipientEmail}</strong>.
                    </p>

                    <label className="quote-email__field">
                      <span>Message personnel <small>(facultatif)</small></span>
                      <textarea
                        rows={5}
                        maxLength={1000}
                        value={personalMessage}
                        onChange={(event) => setPersonalMessage(event.target.value)}
                        placeholder="Bonjour, veuillez trouver notre proposition pour les travaux demandés..."
                        disabled={sending}
                      />
                      <small>{personalMessage.length}/1000 caractères</small>
                    </label>

                    <p className="quote-email__notice">
                      Si un ancien lien est encore actif, il sera remplacé uniquement lorsque Resend aura accepté ce nouvel envoi.
                    </p>

                    {error ? <p className="quote-email__error" role="alert">{error}</p> : null}
                  </>
                )}

                <div className="quote-email__actions">
                  {result ? (
                    <Button type="button" onClick={closeDialog}>Fermer</Button>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={closeDialog}
                        disabled={sending}
                      >
                        Annuler
                      </Button>
                      <Button type="button" onClick={handleSend} disabled={sending}>
                        {sending ? "Envoi en cours..." : "Confirmer l'envoi"}
                      </Button>
                    </>
                  )}
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("fr-BE", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(value));
}
