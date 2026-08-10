import { useEffect, useState } from "react";
import { env } from "../../lib/env";
import { supabase } from "../../lib/supabase";

let cachedAdminCheck: Promise<boolean> | null = null;

async function checkPlatformAdmin() {
  if (!env.administrationEnabled) return false;
  const { data, error } = await supabase.rpc("is_platform_admin");
  if (error) return false;
  return data === true;
}

export function usePlatformAdmin() {
  const [loading, setLoading] = useState(env.administrationEnabled);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  useEffect(() => {
    if (!env.administrationEnabled) return;
    let cancelled = false;
    cachedAdminCheck ??= checkPlatformAdmin();
    void cachedAdminCheck.then((allowed) => {
      if (!cancelled) {
        setIsPlatformAdmin(allowed);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  return { loading, isPlatformAdmin };
}
