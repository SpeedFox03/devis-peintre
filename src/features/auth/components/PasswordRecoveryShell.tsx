import type { ReactNode } from "react";

type PasswordRecoveryShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function PasswordRecoveryShell({
  eyebrow,
  title,
  description,
  children,
  footer,
}: PasswordRecoveryShellProps) {
  return (
    <section className="auth-premium-page auth-premium-page--recovery">
      <div className="auth-premium-page__panel auth-premium-page__panel--brand">
        <div className="auth-premium-page__brand-shell">
          <div className="auth-premium-page__logo">DP</div>

          <div className="auth-premium-page__brand-copy">
            <p className="auth-premium-page__eyebrow">Accès sécurisé</p>
            <h1 className="auth-premium-page__brand-title">Retrouve ton espace</h1>
            <p className="auth-premium-page__brand-description">
              Réinitialise ton mot de passe grâce au parcours sécurisé de Supabase,
              puis reprends ton travail là où tu l’as laissé.
            </p>
          </div>
        </div>

        <div className="auth-premium-page__feature-list">
          <article className="auth-premium-page__feature-card">
            <p className="auth-premium-page__feature-title">Lien personnel</p>
            <p className="auth-premium-page__feature-text">
              Le lien de récupération est envoyé directement à ton adresse e-mail.
            </p>
          </article>

          <article className="auth-premium-page__feature-card">
            <p className="auth-premium-page__feature-title">Mise à jour sécurisée</p>
            <p className="auth-premium-page__feature-text">
              Le nouveau mot de passe est enregistré par Supabase Auth.
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
            <p className="auth-premium-page__form-eyebrow">{eyebrow}</p>
            <h2 className="auth-premium-page__form-title">{title}</h2>
            <p className="auth-premium-page__form-description">{description}</p>
          </div>

          {children}

          {footer ? <div className="auth-premium-page__footer">{footer}</div> : null}
        </div>
      </div>
    </section>
  );
}
