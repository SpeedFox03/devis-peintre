import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../../lib/supabase";

export function useAuth() {
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

      const { data: allowed, error } = await supabase.rpc(
        "current_user_is_allowed",
      );

      // Seule une réponse explicitement négative ferme l'accès : une erreur
      // réseau ou une migration pas encore appliquée ne doit pas bloquer
      // l'application.
      if (!error && allowed === false) {
        await supabase.auth.signOut();

        if (mounted) {
          setSession(null);
          setAccessDenied(true);
          setLoading(false);
        }
        return;
      }

      if (mounted) {
        setSession(nextSession);
        setAccessDenied(false);
        setLoading(false);
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      void resolveSession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void resolveSession(nextSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return {
    session,
    user: session?.user ?? null,
    loading,
    accessDenied,
    isAuthenticated: !!session,
  };
}
