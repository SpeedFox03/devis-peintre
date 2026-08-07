export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
  // Désactivée pendant la phase de test : l'accès se fait uniquement par la
  // liste blanche (public.auth_allowed_emails). Mettre VITE_SIGNUP_ENABLED
  // à "true" pour réactiver le formulaire d'inscription.
  signupEnabled: import.meta.env.VITE_SIGNUP_ENABLED === "true",
};

if (!env.supabaseUrl || !env.supabaseAnonKey) {
  throw new Error("Variables d'environnement Supabase manquantes.");
}