import { useLocation } from "react-router-dom";
import { SubscriptionPanel } from "../../settings/components/SubscriptionPanel";
import { useSubscriptionAccess } from "../SubscriptionAccessContext";
import "./SubscriptionPage.css";

export function SubscriptionPage() {
  const location = useLocation();
  const { companyId, companyName } = useSubscriptionAccess();
  const subscriptionRequired =
    (location.state as { subscriptionRequired?: boolean } | null)
      ?.subscriptionRequired === true;

  return (
    <section className="subscription-page">
      <header className="subscription-page__hero">
        <div>
          <p className="subscription-page__eyebrow">Devis Peintre</p>
          <h1>Choisir votre abonnement</h1>
          <p>
            Une offre premium accompagnée, disponible au mois ou à l’année. Nous
            configurons votre catalogue, votre modèle de devis et votre identité
            e-mail pour vous permettre d’envoyer un devis propre en quelques minutes.
          </p>
        </div>
        {companyName ? (
          <span className="subscription-page__company">{companyName}</span>
        ) : null}
      </header>

      {subscriptionRequired ? (
        <div className="subscription-page__notice" role="status">
          Un abonnement actif est nécessaire pour créer et consulter les devis.
        </div>
      ) : null}

      <SubscriptionPanel companyId={companyId} />
    </section>
  );
}
