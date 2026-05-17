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
  pdf_accent_color: string | null;
  pdf_color_mode: boolean;
  accent_color: string | null;
  legal_mentions: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
};

// Champs pouvant être sauvegardés (exclut les clés système)
type SaveCompanyPayload = Partial<
  Omit<CompanySettings, "id" | "owner_user_id" | "created_at" | "updated_at">
>;

const COMPANY_CORE_SELECT =
  "id, owner_user_id, name, vat_number, email, phone, website, iban, bic, logo_url, legal_mentions, accent_color, created_at, updated_at";

const SETTINGS_SELECT =
  "pdf_theme, pdf_accent_color, pdf_color_mode, default_tva_rate, default_quote_validity_days, default_deposit_percent, default_terms, default_notes";

async function fetchAndMergeCompany(companyId: string, companyCore: Record<string, unknown>): Promise<CompanySettings> {
  const [settingsRes, addrRes] = await Promise.all([
    supabase
      .from("company_settings")
      .select(SETTINGS_SELECT)
      .eq("company_id", companyId)
      .maybeSingle(),
    supabase
      .from("addresses")
      .select("line1, line2, postal_code, city, country")
      .eq("entity_id", companyId)
      .eq("entity_type", "company")
      .eq("role", "main")
      .maybeSingle(),
  ]);

  return {
    ...companyCore,
    ...(settingsRes.data ?? {}),
    address_line1: addrRes.data?.line1 ?? null,
    address_line2: addrRes.data?.line2 ?? null,
    postal_code: addrRes.data?.postal_code ?? null,
    city: addrRes.data?.city ?? null,
    country: addrRes.data?.country ?? "Belgique",
  } as CompanySettings;
}

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
    .select(COMPANY_CORE_SELECT)
    .eq("owner_user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  if (existingCompany) {
    return fetchAndMergeCompany(existingCompany.id, existingCompany);
  }

  const { data: createdCompany, error: insertError } = await supabase
    .from("companies")
    .insert({
      owner_user_id: user.id,
      name: "",
    })
    .select(COMPANY_CORE_SELECT)
    .single();

  if (insertError || !createdCompany) {
    throw new Error(insertError?.message || "Impossible de créer l'entreprise.");
  }

  await supabase.from("company_settings").insert({
    company_id: createdCompany.id,
    pdf_theme: "artisan-classic",
    pdf_color_mode: true,
    default_tva_rate: 21,
    default_quote_validity_days: 30,
    default_deposit_percent: 0,
  });

  return fetchAndMergeCompany(createdCompany.id, createdCompany);
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

    // Séparer les champs core / settings / adresse
    const SETTINGS_FIELDS = new Set(["pdf_theme", "pdf_accent_color", "pdf_color_mode", "default_tva_rate", "default_quote_validity_days", "default_deposit_percent", "default_terms", "default_notes"]);
    const ADDRESS_FIELDS = new Set(["address_line1", "address_line2", "postal_code", "city", "country"]);

    const corePayload: Record<string, unknown> = {};
    const settingsPayload: Record<string, unknown> = { company_id: company.id };
    const addrFields: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
      if (SETTINGS_FIELDS.has(key)) {
        settingsPayload[key] = value;
      } else if (ADDRESS_FIELDS.has(key)) {
        addrFields[key] = value;
      } else {
        corePayload[key] = value;
      }
    }

    // Update companies (core uniquement)
    if (Object.keys(corePayload).length > 0) {
      const { error: updateError } = await supabase
        .from("companies")
        .update(corePayload)
        .eq("id", company.id);

      if (updateError) {
        setError(updateError.message || "Impossible d'enregistrer les paramètres.");
        setSaving(false);
        return false;
      }
    }

    // Upsert company_settings
    if (Object.keys(settingsPayload).length > 1) {
      await supabase.from("company_settings").upsert(settingsPayload, { onConflict: "company_id" });
    }

    // Upsert adresse dans la table addresses
    if (Object.keys(addrFields).length > 0) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await supabase.from("addresses").delete()
          .eq("entity_type", "company")
          .eq("entity_id", company.id)
          .eq("role", "main");

        const line1 = String(addrFields["address_line1"] ?? "");
        const city = String(addrFields["city"] ?? "");
        if (line1 || city) {
          await supabase.from("addresses").insert({
            owner_user_id: user.id,
            entity_type: "company",
            entity_id: company.id,
            role: "main",
            line1: addrFields["address_line1"] ?? null,
            line2: addrFields["address_line2"] ?? null,
            postal_code: addrFields["postal_code"] ?? null,
            city: addrFields["city"] ?? null,
            country: addrFields["country"] ?? "Belgique",
          });
        }
      }
    }

    const refreshed = await fetchAndMergeCompany(company.id, { ...company, ...corePayload });
    setCompany(refreshed);
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
