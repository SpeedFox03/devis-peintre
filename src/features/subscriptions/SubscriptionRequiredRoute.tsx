import { Navigate, Outlet, useLocation } from "react-router-dom";
import { LoadingBlock } from "../../components/ui/LoadingBlock/LoadingBlock";
import { useSubscriptionAccess } from "./SubscriptionAccessContext";

export function SubscriptionRequiredRoute() {
  const location = useLocation();
  const { hasAccess, loading } = useSubscriptionAccess();

  if (loading) {
    return <LoadingBlock message="Vérification de l’abonnement..." />;
  }

  if (!hasAccess) {
    return (
      <Navigate
        to="/abonnement"
        replace
        state={{ from: location.pathname, subscriptionRequired: true }}
      />
    );
  }

  return <Outlet />;
}
