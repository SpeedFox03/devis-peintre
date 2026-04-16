import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

export type CompanySettings = {
  id: string;
  owner_user_id: string;
  name: string;
  vat_number: string | null;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  default_tva_rate: number;
  website: string | null;
  iban: string | null;
  bic: string | null;
  default_quote_validity_days: number;
  default_terms: string | null;
  default_notes: string | null;
  default_deposit_percent: number;
  pdf_theme: string;
  legal_mentions: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
};

type SaveCompanyPayload = Partial<
  Omit<CompanySettings, "id" | "owner_user_id" | "created_at" | "updated_at">
>;

async function getOrCreateCompany(): Promise<CompanySettings> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Utilisateur non connecté.");
  }

  const { data: existingCompany, error: fetchError } = await supabase
    .from("companies")
    .select("*")
    .eq("owner_user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  if (existingCompany) {
    return existingCompany as CompanySettings;
  }

  const { data: createdCompany, error: insertError } = await supabase
    .from("companies")
    .insert({
      owner_user_id: user.id,
      name: "",
      country: "Belgique",
      default_tva_rate: 21,
      default_quote_validity_days: 30,
      default_deposit_percent: 0,
      pdf_theme: "artisan-classic",
    })
    .select("*")
    .single();

  if (insertError || !createdCompany) {
    throw new Error(insertError?.message || "Impossible de créer l’entreprise.");
  }

  return createdCompany as CompanySettings;
}

export function useCompanySettings() {
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCompany = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const companyData = await getOrCreateCompany();
      setCompany(companyData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erreur inconnue lors du chargement."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCompany();
  }, [loadCompany]);

  async function saveCompany(payload: SaveCompanyPayload) {
    if (!company) {
      setError("Aucune entreprise chargée.");
      return false;
    }

    setSaving(true);
    setError(null);

    const { data, error: updateError } = await supabase
      .from("companies")
      .update(payload)
      .eq("id", company.id)
      .select("*")
      .single();

    if (updateError || !data) {
      setError(
        updateError?.message || "Impossible d’enregistrer les paramètres."
      );
      setSaving(false);
      return false;
    }

    setCompany(data as CompanySettings);
    setSaving(false);
    return true;
  }

  return {
    company,
    loading,
    saving,
    error,
    reload: loadCompany,
    saveCompany,
  };
}