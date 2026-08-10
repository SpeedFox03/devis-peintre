import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../../../components/ui/Button/Button";
import { Card } from "../../../components/ui/Card/Card";
import { ErrorMessage } from "../../../components/ui/ErrorMessage/ErrorMessage";
import { LoadingBlock } from "../../../components/ui/LoadingBlock/LoadingBlock";
import { TextInput } from "../../../components/ui/TextInput/TextInput";
import { formatDisplayDate } from "../../../lib/formatters";
import { supabase } from "../../../lib/supabase";
import { useSubscriptionAccess } from "../../subscriptions/SubscriptionAccessContext";
import "./SubscriptionPanel.css";

type PlanPrice = {
  id: string;
  billing_interval: "month" | "year";
  amount_cents: number;
  setup_fee_cents: number;
  currency: string;
  subscription_plans: {
    name: string;
    code: string;
    entitlements: Record<string, unknown> | null;
  } | null;
};

type SubscriptionView = {
  id: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  subscription_plans: { name: string } | null;
  plan_prices: {
    billing_interval: "month" | "year";
    amount_cents: number;
    currency: string;
  } | null;
};

type PendingRequest = {
  id: string;
  price_id: string;
  requested_at: string;
};

const includedFeatures = [
  "Onboarding individuel et configuration de votre espace",
  "Catalogue métier préparé pour créer un devis en quelques minutes",
  "Modèle de devis réellement personnalisé à votre image",
  "Design des e-mails personnalisé et envoi depuis votre compte",
  "Devis, clients, projets, pièces et photos sans limite",
  "Lien client, suivi et acceptation du devis en ligne",
  "Assistant vocal utilisable directement sur le terrain",
  "Un utilisateur inclus et support prioritaire",
];

function formatPrice(amountCents: number, currency: string) {
  return new Intl.NumberFormat("fr-BE", {
    style: "currency",
    currency,
  }).format(amountCents / 100);
}

function getStatusLabel(status: string) {
  switch (status) {
    case "active":
      return "Actif";
    case "trialing":
      return "Période d’essai";
    case "past_due":
      return "Paiement à régulariser";
    case "canceled":
      return "Résilié";
    case "expired":
      return "Expiré";
    default:
      return "Inactif";
  }
}

export function SubscriptionPanel({ companyId }: { companyId: string | null }) {
  const { refresh: refreshAccess } = useSubscriptionAccess();
  const [subscription, setSubscription] = useState<SubscriptionView | null>(null);
  const [prices, setPrices] = useState<PlanPrice[]>([]);
  const [pendingRequest, setPendingRequest] = useState<PendingRequest | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [requestingPriceId, setRequestingPriceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadSubscription = useCallback(async () => {
    if (!companyId) {
      setSubscription(null);
      setPrices([]);
      setPendingRequest(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const [subscriptionResult, pricesResult, requestResult] = await Promise.all([
      supabase
        .from("subscriptions")
        .select(
          "id, status, current_period_end, cancel_at_period_end, subscription_plans(name), plan_prices(billing_interval, amount_cents, currency)",
        )
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("plan_prices")
        .select(
          "id, billing_interval, amount_cents, setup_fee_cents, currency, subscription_plans!inner(name, code, entitlements)",
        )
        .eq("active", true)
        .is("valid_until", null),
      supabase
        .from("subscription_requests")
        .select("id, price_id, requested_at")
        .eq("company_id", companyId)
        .eq("status", "pending")
        .maybeSingle(),
    ]);

    const loadError =
      subscriptionResult.error ?? pricesResult.error ?? requestResult.error;
    if (loadError) {
      setError(loadError.message);
    } else {
      setSubscription(
        (subscriptionResult.data as unknown as SubscriptionView | null) ?? null,
      );
      setPrices(
        ((pricesResult.data ?? []) as unknown as PlanPrice[]).sort((a, b) =>
          a.billing_interval.localeCompare(b.billing_interval),
        ),
      );
      setPendingRequest(
        (requestResult.data as unknown as PendingRequest | null) ?? null,
      );
      setError(null);
    }
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadSubscription(), 0);
    return () => window.clearTimeout(timer);
  }, [loadSubscription]);

  const activeSubscription =
    subscription && ["active", "trialing"].includes(subscription.status)
      ? subscription
      : null;

  const annualPrice = useMemo(
    () => prices.find((price) => price.billing_interval === "year") ?? null,
    [prices],
  );
  const monthlyPrice = useMemo(
    () => prices.find((price) => price.billing_interval === "month") ?? null,
    [prices],
  );
  const annualSaving =
    annualPrice && monthlyPrice
      ? monthlyPrice.amount_cents * 12 - annualPrice.amount_cents
      : 0;
  const setupSaving =
    annualPrice && monthlyPrice
      ? monthlyPrice.setup_fee_cents - annualPrice.setup_fee_cents
      : 0;
  const firstYearSaving = annualSaving + setupSaving;

  async function requestSubscription(price: PlanPrice) {
    setRequestingPriceId(price.id);
    setError(null);
    setSuccess(null);

    const { error: requestError } = await supabase.rpc("request_subscription", {
      p_price_id: price.id,
      p_promo_code: promoCode.trim() || null,
    });

    if (requestError) {
      setError(requestError.message);
    } else {
      setSuccess(
        "Votre demande a bien été envoyée. L’accès sera ouvert dès son activation.",
      );
      await Promise.all([loadSubscription(), refreshAccess()]);
    }
    setRequestingPriceId(null);
  }

  if (loading) return <LoadingBlock message="Chargement de l’abonnement..." />;

  if (!companyId) {
    return (
      <Card className="subscription-panel subscription-panel__empty">
        <h2>Entreprise à configurer</h2>
        <p>
          Créez d’abord votre entreprise dans les paramètres avant de choisir
          l’abonnement.
        </p>
      </Card>
    );
  }

  if (activeSubscription) {
    return (
      <div className="subscription-panel">
        <header>
          <div>
            <p className="subscription-panel__eyebrow">Compte entreprise</p>
            <h2>Votre abonnement</h2>
          </div>
          <span
            className={`subscription-panel__status subscription-panel__status--${activeSubscription.status}`}
          >
            {getStatusLabel(activeSubscription.status)}
          </span>
        </header>

        {error ? <ErrorMessage message={error} /> : null}
        <Card className="subscription-panel__plan">
          <div>
            <small>Formule</small>
            <strong>
              {activeSubscription.subscription_plans?.name ?? "Premium artisan"}
            </strong>
          </div>
          <div>
            <small>Facturation</small>
            <strong>
              {activeSubscription.plan_prices?.billing_interval === "year"
                ? "Annuelle"
                : "Mensuelle"}
            </strong>
          </div>
          <div>
            <small>Prix HT</small>
            <strong>
              {activeSubscription.plan_prices
                ? formatPrice(
                    activeSubscription.plan_prices.amount_cents,
                    activeSubscription.plan_prices.currency,
                  )
                : "—"}
            </strong>
          </div>
          <div>
            <small>Prochaine échéance</small>
            <strong>
              {activeSubscription.current_period_end
                ? formatDisplayDate(activeSubscription.current_period_end)
                : "Accès permanent"}
            </strong>
          </div>
        </Card>

        <Card className="subscription-panel__included">
          <div>
            <p className="subscription-panel__eyebrow">Tout est inclus</p>
            <h3>Un service métier configuré pour votre entreprise</h3>
          </div>
          <ul>
            {includedFeatures.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
        </Card>
      </div>
    );
  }

  return (
    <div className="subscription-panel">
      <header>
        <div>
          <p className="subscription-panel__eyebrow">Service premium accompagné</p>
          <h2>Votre système de devis, configuré et personnalisé</h2>
          <p>
            Les mêmes fonctionnalités au mois ou à l’année, avec onboarding,
            personnalisation et support prioritaire inclus.
          </p>
        </div>
        <span className="subscription-panel__status">
          {pendingRequest ? "Demande en attente" : getStatusLabel(subscription?.status ?? "inactive")}
        </span>
      </header>

      {error ? <ErrorMessage message={error} /> : null}
      {success ? <p className="subscription-panel__success">{success}</p> : null}
      {pendingRequest ? (
        <div className="subscription-panel__pending" role="status">
          Votre demande du {formatDisplayDate(pendingRequest.requested_at)} est en
          attente d’activation. Vous pouvez encore changer de fréquence ci-dessous.
        </div>
      ) : null}

      <div className="subscription-panel__prices">
        {prices.map((price) => {
          const annual = price.billing_interval === "year";
          const selected = pendingRequest?.price_id === price.id;
          return (
            <Card
              key={price.id}
              className={`subscription-panel__price-card${
                annual ? " subscription-panel__price-card--recommended" : ""
              }${selected ? " subscription-panel__price-card--selected" : ""}`}
            >
              {annual ? (
                <span className="subscription-panel__recommendation">
                  Configuration offerte
                </span>
              ) : null}
              <div className="subscription-panel__price-heading">
                <span>{annual ? "Annuel" : "Mensuel"}</span>
                <strong>
                  {formatPrice(price.amount_cents, price.currency)}
                  <small> HT/{annual ? "an" : "mois"}</small>
                </strong>
                {annual && firstYearSaving > 0 ? (
                  <p>
                    Soit {formatPrice(Math.round(price.amount_cents / 12), price.currency)}
                    /mois · {formatPrice(firstYearSaving, price.currency)} économisés la première année
                  </p>
                ) : (
                  <p>Souplesse maximale, renouvelé chaque mois.</p>
                )}
                {price.setup_fee_cents > 0 ? (
                  <p className="subscription-panel__setup-fee">
                    + {formatPrice(price.setup_fee_cents, price.currency)} HT de
                    configuration initiale
                  </p>
                ) : (
                  <p className="subscription-panel__setup-fee subscription-panel__setup-fee--included">
                    Onboarding, catalogue et personnalisation offerts
                  </p>
                )}
              </div>

              <ul>
                {includedFeatures.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>

              <Button
                type="button"
                variant={annual ? "primary" : "secondary"}
                disabled={requestingPriceId !== null || selected}
                onClick={() => void requestSubscription(price)}
              >
                {requestingPriceId === price.id
                  ? "Envoi..."
                  : selected
                    ? "Demande envoyée"
                    : `Choisir l’offre ${annual ? "annuelle" : "mensuelle"}`}
              </Button>
            </Card>
          );
        })}
      </div>

      <Card className="subscription-panel__promo">
        <div>
          <strong>Vous avez un code promotionnel ?</strong>
          <small>Il sera contrôlé au moment de la demande.</small>
        </div>
        <TextInput
          value={promoCode}
          onChange={(event) => setPromoCode(event.target.value.toUpperCase())}
          placeholder="CODE PROMO"
          aria-label="Code promotionnel"
        />
      </Card>

      <p className="subscription-panel__seat-note">
        Un utilisateur est inclus. Les utilisateurs supplémentaires sont
        disponibles sur demande à 15 € HT/mois par utilisateur.
      </p>

      {prices.length === 0 ? (
        <Card className="subscription-panel__empty">
          <h3>Offres temporairement indisponibles</h3>
          <p>Les tarifs seront affichés dès leur activation.</p>
        </Card>
      ) : null}
    </div>
  );
}
