import { createContext, createElement, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../../../lib/supabase";
import { env } from "../../../lib/env";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  accessDenied: boolean;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function resolveSession(nextSession: Session | null) {
      if (!nextSession) {
        if (mounted) {
          setSession(null);
          setLoading(false);
        }
        return;
      }

      const { data: allowed, error } = await supabase.rpc("current_user_is_allowed");

      // Compatibilité transitoire avec la liste blanche actuelle. La migration
      // finale remplacera ce contrôle applicatif par les rôles et politiques RLS.
      if (!error && allowed === false) {
        await supabase.auth.signOut();
        if (mounted) {
          setSession(null);
          setAccessDenied(true);
          setLoading(false);
        }
        return;
      }

      if (env.administrationEnabled) {
        await supabase.rpc("touch_current_profile_last_seen");
      }

      if (mounted) {
        setSession(nextSession);
        setAccessDenied(false);
        setLoading(false);
      }
    }

    void supabase.auth.getSession().then(({ data }) => resolveSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void resolveSession(nextSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    loading,
    accessDenied,
    isAuthenticated: Boolean(session),
  }), [accessDenied, loading, session]);

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth doit être utilisé dans AuthProvider.");
  return value;
}
