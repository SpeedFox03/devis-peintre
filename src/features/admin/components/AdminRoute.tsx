import { Navigate, Outlet } from "react-router-dom";
import { LoadingBlock } from "../../../components/ui/LoadingBlock/LoadingBlock";
import { env } from "../../../lib/env";
import { usePlatformAdmin } from "../usePlatformAdmin";

export function AdminRoute() {
  const { loading, isPlatformAdmin } = usePlatformAdmin();
  if (!env.administrationEnabled) return <Navigate to="/" replace />;
  if (loading) return <LoadingBlock message="Vérification des droits..." />;
  return isPlatformAdmin ? <Outlet /> : <Navigate to="/" replace />;
}
