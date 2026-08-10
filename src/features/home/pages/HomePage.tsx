import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../../../components/ui/Card/Card";
import { ErrorMessage } from "../../../components/ui/ErrorMessage/ErrorMessage";
import { LoadingBlock } from "../../../components/ui/LoadingBlock/LoadingBlock";
import { PlusIcon, ProjectIcon, QuoteIcon, UsersIcon } from "../../../components/ui/Icons/AppIcons";
import { supabase } from "../../../lib/supabase";
import { formatDisplayDate } from "../../../lib/formatters";
import { useAuth } from "../../auth/hooks/useAuth";
import { useSubscriptionAccess } from "../../subscriptions/SubscriptionAccessContext";
import "./HomePage.css";

type DashboardQuote = {
  id: string;
  quote_number: string;
  title: string;
  status: "draft" | "sent" | "accepted" | "rejected" | "expired" | "invoiced";
  total_ttc: number;
  valid_until: string | null;
  created_at: string;
  customer_id: string;
};

type DashboardCustomer = {
  id: string;
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
};

function getFirstName(email?: string | null) {
  if (!email) return null;
  const local = email.split("@")[0] ?? "";
  return local.charAt(0).toUpperCase() + local.slice(1);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(value || 0);
}

function getCustomerName(customer?: DashboardCustomer) {
  if (!customer) return "Client non renseigné";
  return customer.company_name || [customer.first_name, customer.last_name].filter(Boolean).join(" ") || "Client sans nom";
}

export function HomePage() {
  const { user } = useAuth();
  const {
    hasAccess,
    hasPendingRequest,
    loading: subscriptionLoading,
  } = useSubscriptionAccess();
  const [quotes, setQuotes] = useState<DashboardQuote[]>([]);
  const [customers, setCustomers] = useState<DashboardCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const firstName = getFirstName(user?.email);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      const [quotesResult, customersResult] = await Promise.all([
        supabase
          .from("quotes")
          .select("id, quote_number, title, status, total_ttc, valid_until, created_at, customer_id")
          .order("created_at", { ascending: false })
          .limit(30),
        supabase
          .from("customers")
          .select("id, company_name, first_name, last_name")
          .is("archived_at", null),
      ]);

      if (cancelled) return;
      if (quotesResult.error || customersResult.error) {
        setError(quotesResult.error?.message ?? customersResult.error?.message ?? "Chargement impossible.");
      } else {
        setQuotes((quotesResult.data ?? []) as DashboardQuote[]);
        setCustomers((customersResult.data ?? []) as DashboardCustomer[]);
      }
      setLoading(false);
    }

    void loadDashboard();
    return () => { cancelled = true; };
  }, []);

  const customersById = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers],
  );
  const drafts = quotes.filter((quote) => quote.status === "draft");
  const awaitingResponse = quotes.filter((quote) => quote.status === "sent");
  const overdue = awaitingResponse.filter((quote) => quote.valid_until && quote.valid_until < today);
  const actionableQuotes = [...drafts, ...awaitingResponse]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 6);
  const pendingAmount = awaitingResponse.reduce((sum, quote) => sum + Number(quote.total_ttc || 0), 0);

  if (loading || subscriptionLoading) {
    return <LoadingBlock message="Préparation du tableau de bord..." />;
  }

  if (!hasAccess) {
    return (
      <section className="home-page">
        <header className="home-page__hero">
          <div>
            <p className="home-page__eyebrow">Vue d’ensemble</p>
            <h1 className="home-page__title">
              {firstName ? `Bonjour, ${firstName}` : "Bonjour"}
            </h1>
            <p className="home-page__subtitle">
              Votre espace est prêt. Il reste à activer l’accès aux devis.
            </p>
          </div>
          <Link className="home-page__primary-action" to="/abonnement">
            Voir les abonnements
          </Link>
        </header>

        <Card className="home-page__subscription-gate">
          <div className="home-page__subscription-gate-copy">
            <span className="home-page__subscription-gate-label">
              {hasPendingRequest ? "Demande reçue" : "Abonnement requis"}
            </span>
            <h2>
              {hasPendingRequest
                ? "Votre demande attend son activation"
                : "Activez la création et le suivi de vos devis"}
            </h2>
            <p>
              {hasPendingRequest
                ? "Vous recevrez l’accès dès que l’abonnement aura été validé. Vos données et vos réglages sont déjà conservés."
                : "Choisissez la formule mensuelle ou annuelle pour créer, consulter, personnaliser et envoyer vos devis."}
            </p>
          </div>
          <div className="home-page__subscription-gate-price">
            <span>À partir de</span>
            <strong>62,50 €</strong>
            <small>HT/mois en annuel · configuration offerte</small>
            <Link to="/abonnement">
              {hasPendingRequest ? "Suivre ma demande" : "Choisir mon abonnement"}
            </Link>
          </div>
        </Card>
      </section>
    );
  }

  return (
    <section className="home-page">
      <header className="home-page__hero">
        <div>
          <p className="home-page__eyebrow">Vue d’ensemble</p>
          <h1 className="home-page__title">{firstName ? `Bonjour, ${firstName}` : "Bonjour"}</h1>
          <p className="home-page__subtitle">Voici les dossiers qui demandent votre attention.</p>
        </div>
        <Link className="home-page__primary-action" to="/devis?new=1">
          <PlusIcon />
          Nouveau devis
        </Link>
      </header>

      {error ? <ErrorMessage message={error} /> : null}

      <div className="home-page__summary">
        <Card className="home-page__summary-card">
          <span>À finaliser</span>
          <strong>{drafts.length}</strong>
          <small>{drafts.length === 1 ? "brouillon" : "brouillons"}</small>
        </Card>
        <Card className="home-page__summary-card">
          <span>En attente client</span>
          <strong>{awaitingResponse.length}</strong>
          <small>{formatCurrency(pendingAmount)}</small>
        </Card>
        {overdue.length > 0 && (
          <Card className="home-page__summary-card home-page__summary-card--warning">
            <span>À relancer</span>
            <strong>{overdue.length}</strong>
            <small>devis arrivé à échéance</small>
          </Card>
        )}
      </div>

      <div className="home-page__content-grid">
        <Card className="home-page__worklist">
          <div className="home-page__section-header">
            <div>
              <p className="home-page__section-eyebrow">Priorités</p>
              <h2>À faire</h2>
            </div>
            <Link to="/devis">Voir tous les devis</Link>
          </div>

          {actionableQuotes.length === 0 ? (
            <div className="home-page__all-clear">
              <span>✓</span>
              <div>
                <strong>Tout est à jour</strong>
                <p>Aucun brouillon ou devis en attente pour le moment.</p>
              </div>
            </div>
          ) : (
            <div className="home-page__task-list">
              {actionableQuotes.map((quote) => {
                const expired = quote.status === "sent" && quote.valid_until && quote.valid_until < today;
                return (
                  <Link key={quote.id} to={`/devis/${quote.id}`} className="home-page__task">
                    <span className={`home-page__task-marker home-page__task-marker--${expired ? "warning" : quote.status}`} />
                    <span className="home-page__task-copy">
                      <strong>{quote.title}</strong>
                      <small>{quote.quote_number} · {getCustomerName(customersById.get(quote.customer_id))}</small>
                    </span>
                    <span className="home-page__task-meta">
                      <strong>{formatCurrency(quote.total_ttc)}</strong>
                      <small>{expired ? "À relancer" : quote.status === "draft" ? "À terminer" : "Réponse attendue"}</small>
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>

        <div className="home-page__side-column">
          <Card className="home-page__quick-actions">
            <div className="home-page__section-header">
              <div>
                <p className="home-page__section-eyebrow">Raccourcis</p>
                <h2>Créer</h2>
              </div>
            </div>
            <Link to="/devis?new=1"><QuoteIcon /><span><strong>Un devis</strong><small>Démarrer une estimation</small></span></Link>
            <Link to="/clients?new=1"><UsersIcon /><span><strong>Un client</strong><small>Ajouter ses coordonnées</small></span></Link>
            <Link to="/projets"><ProjectIcon /><span><strong>Un projet</strong><small>Préparer un chantier</small></span></Link>
          </Card>

          <Card className="home-page__recent">
            <div className="home-page__section-header">
              <div>
                <p className="home-page__section-eyebrow">Récents</p>
                <h2>Derniers devis</h2>
              </div>
            </div>
            {quotes.slice(0, 4).map((quote) => (
              <Link key={quote.id} to={`/devis/${quote.id}`}>
                <span><strong>{quote.title}</strong><small>{formatDisplayDate(quote.created_at)}</small></span>
                <strong>{formatCurrency(quote.total_ttc)}</strong>
              </Link>
            ))}
            {quotes.length === 0 && <p className="home-page__muted">Aucun devis créé.</p>}
          </Card>
        </div>
      </div>
    </section>
  );
}
