import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../../components/ui/Button/Button";
import { ErrorMessage } from "../../../components/ui/ErrorMessage/ErrorMessage";
import { FormField } from "../../../components/ui/FormField/FormField";
import { TextInput } from "../../../components/ui/TextInput/TextInput";
import { supabase } from "../../../lib/supabase";
import { PasswordRecoveryShell } from "../components/PasswordRecoveryShell";
import "./LoginPage.css";
import "./PasswordRecoveryPage.css";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setError("Indique l’adresse e-mail associée à ton compte.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const redirectTo = new URL(
      "/reinitialiser-mot-de-passe",
      window.location.origin,
    ).toString();

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      normalizedEmail,
      { redirectTo },
    );

    if (resetError) {
      setError(resetError.message);
      setSubmitting(false);
      return;
    }

    setSentTo(normalizedEmail);
    setSubmitting(false);
  }

  return (
    <PasswordRecoveryShell
      eyebrow={sentTo ? "E-mail envoyé" : "Mot de passe oublié"}
      title={sentTo ? "Consulte ta boîte mail" : "Réinitialiser le mot de passe"}
      description={
        sentTo
          ? "Si un compte correspond à cette adresse, tu recevras un lien sécurisé pour choisir un nouveau mot de passe."
          : "Saisis l’adresse e-mail de ton compte pour recevoir un lien de récupération."
      }
      footer={
        <>
          <p className="auth-premium-page__footer-text">Tu connais ton mot de passe ?</p>
          <Link to="/login" className="auth-premium-page__footer-link">
            Se connecter
          </Link>
        </>
      }
    >
      {sentTo ? (
        <div className="auth-recovery-page__result">
          <div className="auth-recovery-page__notice" role="status">
            <p className="auth-recovery-page__notice-title">Demande envoyée</p>
            <p className="auth-recovery-page__notice-text">
              Vérifie les messages reçus à l’adresse <strong>{sentTo}</strong>, ainsi
              que le dossier des courriers indésirables.
            </p>
          </div>

          <Button type="button" variant="secondary" onClick={() => setSentTo(null)}>
            Utiliser une autre adresse
          </Button>
        </div>
      ) : (
        <form className="auth-premium-page__form" onSubmit={handleSubmit}>
          <FormField label="Adresse e-mail">
            <TextInput
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="exemple@entreprise.be"
              autoComplete="email"
              required
            />
          </FormField>

          {error && <ErrorMessage message={error} />}

          <Button type="submit" disabled={submitting}>
            {submitting ? "Envoi en cours..." : "Envoyer le lien de récupération"}
          </Button>
        </form>
      )}
    </PasswordRecoveryShell>
  );
}
