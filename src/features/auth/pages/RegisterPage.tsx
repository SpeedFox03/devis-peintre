import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { Button } from "../../../components/ui/Button/Button";
import { TextInput } from "../../../components/ui/TextInput/TextInput";
import { FormField } from "../../../components/ui/FormField/FormField";
import { ErrorMessage } from "../../../components/ui/ErrorMessage/ErrorMessage";
import "./RegisterPage.css";

export function RegisterPage() {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim() || null,
          company_name: companyName.trim() || null,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    if (signUpData.session) {
      navigate("/abonnement");
    } else {
      navigate("/login", {
        replace: true,
        state: {
          redirectTo: "/abonnement",
          notice:
            "Votre compte a été créé. Confirmez votre adresse e-mail si nécessaire, puis connectez-vous pour choisir votre abonnement.",
        },
      });
    }
  }

  return (
    <section className="auth-premium-page auth-premium-page--register">
      <div className="auth-premium-page__panel auth-premium-page__panel--brand">
        <div className="auth-premium-page__brand-shell">
          <div className="auth-premium-page__logo">DP</div>

          <div className="auth-premium-page__brand-copy">
            <p className="auth-premium-page__eyebrow">Création de compte</p>
            <h1 className="auth-premium-page__brand-title">
              Démarre ton espace métier
            </h1>
            <p className="auth-premium-page__brand-description">
              Mets en place une base propre pour gérer tes clients, produire tes devis
              plus vite et structurer ton activité dans une interface premium.
            </p>
          </div>
        </div>

        <div className="auth-premium-page__feature-list">
          <article className="auth-premium-page__feature-card">
            <p className="auth-premium-page__feature-title">Base professionnelle</p>
            <p className="auth-premium-page__feature-text">
              Coordonnées, paramètres entreprise, catalogue et historique réunis au même endroit.
            </p>
          </article>

          <article className="auth-premium-page__feature-card">
            <p className="auth-premium-page__feature-title">Parcours fluide</p>
            <p className="auth-premium-page__feature-text">
              Une structure pensée pour réduire la friction et faire gagner du temps au quotidien.
            </p>
          </article>

          <article className="auth-premium-page__feature-card">
            <p className="auth-premium-page__feature-title">Image valorisée</p>
            <p className="auth-premium-page__feature-text">
              Des documents et une interface cohérents avec une posture artisan premium.
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
            <p className="auth-premium-page__form-eyebrow">Inscription</p>
            <h2 className="auth-premium-page__form-title">Créer un compte</h2>
            <p className="auth-premium-page__form-description">
              Configure ton accès pour commencer à utiliser la plateforme.
            </p>
          </div>

          <form className="auth-premium-page__form" onSubmit={handleSubmit}>
            <FormField label="Nom complet">
              <TextInput
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jean Dupont"
              />
            </FormField>

            <FormField label="Nom de l’entreprise">
              <TextInput
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Peinture Dupont"
                required
              />
            </FormField>

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

            <FormField label="Confirmer le mot de passe">
              <TextInput
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
              />
            </FormField>

            {error && <ErrorMessage message={error} />}

            <Button type="submit" disabled={submitting}>
              {submitting ? "Création..." : "Créer mon compte"}
            </Button>

            <p className="auth-premium-page__subscription-hint">
              Étape suivante : 75 € HT/mois avec configuration initiale, ou
              750 € HT/an avec toute la configuration offerte.
            </p>
          </form>

          <div className="auth-premium-page__footer">
            <p className="auth-premium-page__footer-text">Déjà inscrit ?</p>

            <Link to="/login" className="auth-premium-page__footer-link">
              Se connecter
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
