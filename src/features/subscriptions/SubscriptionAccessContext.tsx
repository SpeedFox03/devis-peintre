import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/hooks/useAuth";

export type SubscriptionAccess = {
  companyId: string | null;
  companyName: string | null;
  status: string | null;
  currentPeriodEnd: string | null;
  billingInterval: "month" | "year" | null;
  hasAccess: boolean;
  isPlatformAdmin: boolean;
  hasPendingRequest: boolean;
};

type SubscriptionAccessContextValue = SubscriptionAccess & {
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const emptyAccess: SubscriptionAccess = {
  companyId: null,
  companyName: null,
  status: null,
  currentPeriodEnd: null,
  billingInterval: null,
  hasAccess: false,
  isPlatformAdmin: false,
  hasPendingRequest: false,
};

const SubscriptionAccessContext = createContext<SubscriptionAccessContextValue | null>(null);

function parseAccess(value: unknown): SubscriptionAccess {
  if (!value || typeof value !== "object") return emptyAccess;
  const data = value as Record<string, unknown>;
  const interval = data.billing_interval;

  return {
    companyId: typeof data.company_id === "string" ? data.company_id : null,
    companyName: typeof data.company_name === "string" ? data.company_name : null,
    status: typeof data.status === "string" ? data.status : null,
    currentPeriodEnd:
      typeof data.current_period_end === "string" ? data.current_period_end : null,
    billingInterval: interval === "month" || interval === "year" ? interval : null,
    hasAccess: data.has_access === true,
    isPlatformAdmin: data.is_platform_admin === true,
    hasPendingRequest: data.has_pending_request === true,
  };
}

export function SubscriptionAccessProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [access, setAccess] = useState<SubscriptionAccess>(emptyAccess);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setAccess(emptyAccess);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error: accessError } = await supabase.rpc(
      "get_current_subscription_access",
    );

    if (accessError) {
      setAccess(emptyAccess);
      setError(accessError.message);
    } else {
      setAccess(parseAccess(data));
      setError(null);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const value = useMemo<SubscriptionAccessContextValue>(
    () => ({ ...access, loading, error, refresh }),
    [access, error, loading, refresh],
  );

  return (
    <SubscriptionAccessContext.Provider value={value}>
      {children}
    </SubscriptionAccessContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSubscriptionAccess() {
  const value = useContext(SubscriptionAccessContext);
  if (!value) {
    throw new Error(
      "useSubscriptionAccess doit être utilisé dans SubscriptionAccessProvider.",
    );
  }
  return value;
}
