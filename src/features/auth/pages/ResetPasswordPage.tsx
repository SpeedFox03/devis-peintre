import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../../../components/ui/Button/Button";
import { ErrorMessage } from "../../../components/ui/ErrorMessage/ErrorMessage";
import { FormField } from "../../../components/ui/FormField/FormField";
import { TextInput } from "../../../components/ui/TextInput/TextInput";
import { supabase } from "../../../lib/supabase";
import { PasswordRecoveryShell } from "../components/PasswordRecoveryShell";
import "./LoginPage.css";
import "./PasswordRecoveryPage.css";

function getCallbackError() {
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));

  return (
    searchParams.get("error_description") ??
    hashParams.get("error_description") ??
    null
  );
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [hasCallbackError] = useState(() => Boolean(getCallbackError()));
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [checkingLink, setCheckingLink] = useState(!hasCallbackError);
  const [canReset, setCanReset] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [updated, setUpdated] = useState(false);
  const [error, setError] = useState<string | null>(() =>
    hasCallbackError
      ? "Ce lien de récupération est invalide ou a expiré. Demande un nouveau lien."
      : null,
  );

  useEffect(() => {
    let mounted = true;
    if (hasCallbackError) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted || event !== "PASSWORD_RECOVERY") return;

      setCanReset(Boolean(session));
      setCheckingLink(false);
    });

    async function checkSession() {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (sessionError) {
        setError("Impossible de vérifier ce lien de récupération.");
      } else {
        setCanReset(Boolean(session));
      }

      setCheckingLink(false);
    }

    void checkSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [hasCallbackError]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setSubmitting(true);

    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setSubmitting(false);
      return;
    }

    setPassword("");
    setConfirmPassword("");
    setUpdated(true);
    setSubmitting(false);
  }

  let content;

  if (checkingLink) {
    content = (
      <div className="auth-recovery-page__notice" role="status">
        <p className="auth-recovery-page__notice-title">Vérification du lien...</p>
        <p className="auth-recovery-page__notice-text">
          Nous préparons la modification de ton mot de passe.
        </p>
      </div>
    );
  } else if (updated) {
    content = (
      <div className="auth-recovery-page__result">
        <div className="auth-recovery-page__notice" role="status">
          <p className="auth-recovery-page__notice-title">Mot de passe mis à jour</p>
          <p className="auth-recovery-page__notice-text">
            Ton nouveau mot de passe est enregistré. Tu peux maintenant continuer
            vers ton espace de travail.
          </p>
        </div>

        <Button type="button" onClick={() => navigate("/")}>
          Continuer vers l’application
        </Button>
      </div>
    );
  } else if (!canReset) {
    content = (
      <div className="auth-recovery-page__result">
        <ErrorMessage
          message={error ?? "Ce lien de récupération est invalide ou a expiré."}
        />
        <Link to="/mot-de-passe-oublie" className="auth-premium-page__footer-link">
          Demander un nouveau lien
        </Link>
      </div>
    );
  } else {
    content = (
      <form className="auth-premium-page__form" onSubmit={handleSubmit}>
        <FormField label="Nouveau mot de passe">
          <TextInput
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="8 caractères minimum"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </FormField>

        <FormField label="Confirmer le nouveau mot de passe">
          <TextInput
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Répète le mot de passe"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </FormField>

        {error && <ErrorMessage message={error} />}

        <Button type="submit" disabled={submitting}>
          {submitting ? "Enregistrement..." : "Enregistrer le nouveau mot de passe"}
        </Button>
      </form>
    );
  }

  return (
    <PasswordRecoveryShell
      eyebrow="Nouveau mot de passe"
      title={updated ? "Modification terminée" : "Choisis ton nouveau mot de passe"}
      description={
        updated
          ? "Ton accès est de nouveau sécurisé."
          : "Utilise un mot de passe d’au moins 8 caractères que tu n’emploies pas ailleurs."
      }
      footer={
        <>
          <p className="auth-premium-page__footer-text">Retour à la connexion ?</p>
          <Link to="/login" className="auth-premium-page__footer-link">
            Se connecter
          </Link>
        </>
      }
    >
      {content}
    </PasswordRecoveryShell>
  );
}
