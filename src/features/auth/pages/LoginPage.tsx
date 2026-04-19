import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { Button } from "../../../components/ui/Button/Button";
import { TextInput } from "../../../components/ui/TextInput/TextInput";
import { FormField } from "../../../components/ui/FormField/FormField";
import { ErrorMessage } from "../../../components/ui/ErrorMessage/ErrorMessage";
import "./LoginPage.css";

export function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    navigate("/");
  }

  return (
    <section className="auth-premium-page">
      <div className="auth-premium-page__panel auth-premium-page__panel--brand">
        <div className="auth-premium-page__brand-shell">
          <div className="auth-premium-page__logo">DP</div>

          <div className="auth-premium-page__brand-copy">
            <p className="auth-premium-page__eyebrow">Studio métier</p>
            <h1 className="auth-premium-page__brand-title">Devis Peintre</h1>
            <p className="auth-premium-page__brand-description">
              Une interface élégante pour piloter tes devis, tes clients et ton
              activité quotidienne avec plus de clarté.
            </p>
          </div>
        </div>

        <div className="auth-premium-page__feature-list">
          <article className="auth-premium-page__feature-card">
            <p className="auth-premium-page__feature-title">Devis plus rapides</p>
            <p className="auth-premium-page__feature-text">
              Catalogue, pièces, lignes et structure métier pensés pour le terrain.
            </p>
          </article>

          <article className="auth-premium-page__feature-card">
            <p className="auth-premium-page__feature-title">Présentation premium</p>
            <p className="auth-premium-page__feature-text">
              Une ambiance visuelle sable, noisette et espresso pour valoriser ton
              image professionnelle.
            </p>
          </article>

          <article className="auth-premium-page__feature-card">
            <p className="auth-premium-page__feature-title">Base solide</p>
            <p className="auth-premium-page__feature-text">
              Clients, devis, catalogue et paramètres centralisés dans un même outil.
            </p>
          </article>
        </div>
      </div>

      <div className="auth-premium-page__panel auth-premium-page__panel--form">
        <div className="auth-premium-page__form-card">
          <div className="auth-premium-page__form-mobile-brand">
            <div className="auth-premium-page__form-mobile-brand-mark">DP</div>
            <p className="auth-premium-page__form-mobile-brand-name">Devis Peintre</p>
          </div>
          <div className="auth-premium-page__form-header">
            <p className="auth-premium-page__form-eyebrow">Connexion</p>
            <h2 className="auth-premium-page__form-title">Bienvenue</h2>
            <p className="auth-premium-page__form-description">
              Connecte-toi pour retrouver ton espace de travail.
            </p>
          </div>

          <form className="auth-premium-page__form" onSubmit={handleSubmit}>
            <FormField label="Adresse email">
              <TextInput
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="exemple@entreprise.be"
              />
            </FormField>

            <FormField label="Mot de passe">
              <TextInput
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </FormField>

            {error && <ErrorMessage message={error} />}

            <Button type="submit" disabled={submitting}>
              {submitting ? "Connexion..." : "Se connecter"}
            </Button>
          </form>

          <div className="auth-premium-page__footer">
            <p className="auth-premium-page__footer-text">
              Pas encore de compte ?
            </p>

            <Link to="/register" className="auth-premium-page__footer-link">
              Créer un compte
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}