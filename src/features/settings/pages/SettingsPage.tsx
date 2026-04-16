import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { LoadingBlock } from "../../../components/ui/LoadingBlock/LoadingBlock";
import { ErrorMessage } from "../../../components/ui/ErrorMessage/ErrorMessage";
import { Button } from "../../../components/ui/Button/Button";
import { Card } from "../../../components/ui/Card/Card";
import { FormField } from "../../../components/ui/FormField/FormField";
import { FormGrid } from "../../../components/ui/FormGrid/FormGrid";
import { Select } from "../../../components/ui/Select/Select";
import { TextArea } from "../../../components/ui/TextArea/TextArea";
import { TextInput } from "../../../components/ui/TextInput/TextInput";
import "./SettingsPage.css";

type CompanySettings = {
  id: string;
  name: string;
  vat_number: string | null;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  website: string | null;
  iban: string | null;
  bic: string | null;
  default_tva_rate: number;
  default_quote_validity_days: number;
  default_terms: string | null;
  default_notes: string | null;
  default_deposit_percent: number;
  pdf_theme: string;
  legal_mentions: string | null;
  logo_url: string | null;
};

type CompanySettingsFormState = {
  name: string;
  vat_number: string;
  email: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  postal_code: string;
  city: string;
  country: string;
  website: string;
  iban: string;
  bic: string;
  default_tva_rate: string;
  default_quote_validity_days: string;
  default_terms: string;
  default_notes: string;
  default_deposit_percent: string;
  pdf_theme: string;
  legal_mentions: string;
  logo_url: string;
};

function createInitialForm(company: CompanySettings | null): CompanySettingsFormState {
  return {
    name: company?.name ?? "",
    vat_number: company?.vat_number ?? "",
    email: company?.email ?? "",
    phone: company?.phone ?? "",
    address_line1: company?.address_line1 ?? "",
    address_line2: company?.address_line2 ?? "",
    postal_code: company?.postal_code ?? "",
    city: company?.city ?? "",
    country: company?.country ?? "Belgique",
    website: company?.website ?? "",
    iban: company?.iban ?? "",
    bic: company?.bic ?? "",
    default_tva_rate: String(company?.default_tva_rate ?? 21),
    default_quote_validity_days: String(company?.default_quote_validity_days ?? 30),
    default_terms: company?.default_terms ?? "",
    default_notes: company?.default_notes ?? "",
    default_deposit_percent: String(company?.default_deposit_percent ?? 0),
    pdf_theme: company?.pdf_theme ?? "artisan-classic",
    legal_mentions: company?.legal_mentions ?? "",
    logo_url: company?.logo_url ?? "",
  };
}

export function SettingsPage() {
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [form, setForm] = useState<CompanySettingsFormState>(
    createInitialForm(null)
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatingCompany, setCreatingCompany] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadSettings() {
    setLoading(true);
    setError(null);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setError("Utilisateur non connecté.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("companies")
      .select(
        `
        id,
        name,
        vat_number,
        email,
        phone,
        address_line1,
        address_line2,
        postal_code,
        city,
        country,
        website,
        iban,
        bic,
        default_tva_rate,
        default_quote_validity_days,
        default_terms,
        default_notes,
        default_deposit_percent,
        pdf_theme,
        legal_mentions,
        logo_url
      `
      )
      .eq("owner_user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    const loadedCompany = (data ?? null) as CompanySettings | null;
    setCompany(loadedCompany);
    setForm(createInitialForm(loadedCompany));
    setLoading(false);
  }

  useEffect(() => {
    void loadSettings();
  }, []);

  function updateField<K extends keyof CompanySettingsFormState>(
    field: K,
    value: CompanySettingsFormState[K]
  ) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function resetForm() {
    setForm(createInitialForm(company));
    setError(null);
  }

  async function handleCreateCompany() {
    setCreatingCompany(true);
    setError(null);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setError("Utilisateur non connecté.");
      setCreatingCompany(false);
      return;
    }

    const payload = {
      owner_user_id: user.id,
      name: "Mon entreprise",
      country: "Belgique",
      default_tva_rate: 21,
      default_quote_validity_days: 30,
      default_deposit_percent: 0,
      pdf_theme: "artisan-classic",
    };

    const { error } = await supabase.from("companies").insert(payload);

    if (error) {
      setError(error.message);
      setCreatingCompany(false);
      return;
    }

    setCreatingCompany(false);
    await loadSettings();
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!company) {
      setError("Aucune entreprise à mettre à jour.");
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      name: form.name.trim(),
      vat_number: form.vat_number.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      address_line1: form.address_line1.trim() || null,
      address_line2: form.address_line2.trim() || null,
      postal_code: form.postal_code.trim() || null,
      city: form.city.trim() || null,
      country: form.country.trim() || null,
      website: form.website.trim() || null,
      iban: form.iban.trim() || null,
      bic: form.bic.trim() || null,
      default_tva_rate: Number(form.default_tva_rate || 21),
      default_quote_validity_days: Number(form.default_quote_validity_days || 30),
      default_terms: form.default_terms.trim() || null,
      default_notes: form.default_notes.trim() || null,
      default_deposit_percent: Number(form.default_deposit_percent || 0),
      pdf_theme: form.pdf_theme,
      legal_mentions: form.legal_mentions.trim() || null,
      logo_url: form.logo_url.trim() || null,
    };

    if (!payload.name) {
      setError("Le nom de l’entreprise est obligatoire.");
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("companies")
      .update(payload)
      .eq("id", company.id);

    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    await loadSettings();
  }

  if (loading) {
    return <LoadingBlock message="Chargement des paramètres..." />;
  }

  if (!company) {
    return (
      <section className="settings-premium-page">
        <header className="settings-premium-page__hero">
          <div className="settings-premium-page__hero-main">
            <p className="settings-premium-page__eyebrow">Configuration</p>
            <h1 className="settings-premium-page__title">Paramètres entreprise</h1>
            <p className="settings-premium-page__description">
              Crée d’abord ton entreprise pour centraliser tes coordonnées,
              tes réglages PDF et les valeurs par défaut de tes devis.
            </p>
          </div>

          <div className="settings-premium-page__hero-actions">
            <Button onClick={handleCreateCompany} disabled={creatingCompany}>
              {creatingCompany ? "Création..." : "Créer mon entreprise"}
            </Button>
          </div>
        </header>

        {error && <ErrorMessage message={error} />}
      </section>
    );
  }

  return (
    <section className="settings-premium-page">
      <header className="settings-premium-page__hero">
        <div className="settings-premium-page__hero-main">
          <p className="settings-premium-page__eyebrow">Configuration</p>
          <h1 className="settings-premium-page__title">Paramètres entreprise</h1>
          <p className="settings-premium-page__description">
            Centralise les informations de ton entreprise et définis les valeurs
            par défaut utilisées dans tes devis et tes futurs documents.
          </p>
        </div>

        <div className="settings-premium-page__hero-actions">
          <Button variant="secondary" onClick={resetForm}>
            Réinitialiser
          </Button>
        </div>
      </header>

      <form className="settings-premium-page__layout" onSubmit={handleSubmit}>
        <div className="settings-premium-page__center">
          <Card>
            <div className="settings-premium-page__section-header">
              <div>
                <p className="settings-premium-page__section-eyebrow">Identité</p>
                <h2 className="settings-premium-page__section-title">
                  Informations entreprise
                </h2>
              </div>
            </div>

            <div className="settings-premium-page__form-block">
              <FormGrid columns="2">
                <FormField label="Nom de l’entreprise">
                  <TextInput
                    value={form.name}
                    onChange={(e) => updateField("name", e.target.value)}
                  />
                </FormField>

                <FormField label="Numéro de TVA">
                  <TextInput
                    value={form.vat_number}
                    onChange={(e) => updateField("vat_number", e.target.value)}
                  />
                </FormField>
              </FormGrid>

              <FormGrid columns="2">
                <FormField label="Email">
                  <TextInput
                    value={form.email}
                    onChange={(e) => updateField("email", e.target.value)}
                  />
                </FormField>

                <FormField label="Téléphone">
                  <TextInput
                    value={form.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                  />
                </FormField>
              </FormGrid>

              <FormGrid columns="2">
                <FormField label="Adresse ligne 1">
                  <TextInput
                    value={form.address_line1}
                    onChange={(e) => updateField("address_line1", e.target.value)}
                  />
                </FormField>

                <FormField label="Adresse ligne 2">
                  <TextInput
                    value={form.address_line2}
                    onChange={(e) => updateField("address_line2", e.target.value)}
                  />
                </FormField>
              </FormGrid>

              <FormGrid columns="3">
                <FormField label="Code postal">
                  <TextInput
                    value={form.postal_code}
                    onChange={(e) => updateField("postal_code", e.target.value)}
                  />
                </FormField>

                <FormField label="Ville">
                  <TextInput
                    value={form.city}
                    onChange={(e) => updateField("city", e.target.value)}
                  />
                </FormField>

                <FormField label="Pays">
                  <TextInput
                    value={form.country}
                    onChange={(e) => updateField("country", e.target.value)}
                  />
                </FormField>
              </FormGrid>
            </div>
          </Card>

          <Card>
            <div className="settings-premium-page__section-header">
              <div>
                <p className="settings-premium-page__section-eyebrow">Commercial</p>
                <h2 className="settings-premium-page__section-title">
                  Valeurs par défaut des devis
                </h2>
              </div>
            </div>

            <div className="settings-premium-page__form-block">
              <FormGrid columns="3">
                <FormField label="TVA par défaut (%)">
                  <TextInput
                    type="number"
                    step="0.01"
                    value={form.default_tva_rate}
                    onChange={(e) =>
                      updateField("default_tva_rate", e.target.value)
                    }
                  />
                </FormField>

                <FormField label="Validité devis (jours)">
                  <TextInput
                    type="number"
                    value={form.default_quote_validity_days}
                    onChange={(e) =>
                      updateField("default_quote_validity_days", e.target.value)
                    }
                  />
                </FormField>

                <FormField label="Acompte par défaut (%)">
                  <TextInput
                    type="number"
                    step="0.01"
                    value={form.default_deposit_percent}
                    onChange={(e) =>
                      updateField("default_deposit_percent", e.target.value)
                    }
                  />
                </FormField>
              </FormGrid>

              <FormField label="Notes par défaut">
                <TextArea
                  rows={4}
                  value={form.default_notes}
                  onChange={(e) => updateField("default_notes", e.target.value)}
                />
              </FormField>

              <FormField label="Conditions par défaut">
                <TextArea
                  rows={5}
                  value={form.default_terms}
                  onChange={(e) => updateField("default_terms", e.target.value)}
                />
              </FormField>
            </div>
          </Card>

          <Card>
            <div className="settings-premium-page__section-header">
              <div>
                <p className="settings-premium-page__section-eyebrow">Document</p>
                <h2 className="settings-premium-page__section-title">
                  Apparence et mentions
                </h2>
              </div>
            </div>

            <div className="settings-premium-page__form-block">
              <FormGrid columns="2">
                <FormField label="Thème PDF">
                  <Select
                    value={form.pdf_theme}
                    onChange={(e) => updateField("pdf_theme", e.target.value)}
                  >
                    <option value="artisan-classic">Artisan Classic</option>
                    <option value="artisan-elegant">Artisan Elegant</option>
                    <option value="artisan-soft">Artisan Soft</option>
                  </Select>
                </FormField>

                <FormField label="Logo URL">
                  <TextInput
                    value={form.logo_url}
                    onChange={(e) => updateField("logo_url", e.target.value)}
                  />
                </FormField>
              </FormGrid>

              <FormGrid columns="3">
                <FormField label="Website">
                  <TextInput
                    value={form.website}
                    onChange={(e) => updateField("website", e.target.value)}
                  />
                </FormField>

                <FormField label="IBAN">
                  <TextInput
                    value={form.iban}
                    onChange={(e) => updateField("iban", e.target.value)}
                  />
                </FormField>

                <FormField label="BIC">
                  <TextInput
                    value={form.bic}
                    onChange={(e) => updateField("bic", e.target.value)}
                  />
                </FormField>
              </FormGrid>

              <FormField label="Mentions légales">
                <TextArea
                  rows={5}
                  value={form.legal_mentions}
                  onChange={(e) =>
                    updateField("legal_mentions", e.target.value)
                  }
                />
              </FormField>
            </div>
          </Card>

          {error && <ErrorMessage message={error} />}

          <div className="settings-premium-page__form-actions">
            <Button type="submit" disabled={saving}>
              {saving ? "Enregistrement..." : "Enregistrer les paramètres"}
            </Button>
          </div>
        </div>

        <aside className="settings-premium-page__right">
          <Card>
            <div className="settings-premium-page__side-card">
              <p className="settings-premium-page__side-label">Résumé</p>

              <ul className="settings-premium-page__meta-list">
                <li>
                  <span>Entreprise</span>
                  <strong>{form.name || "-"}</strong>
                </li>
                <li>
                  <span>TVA par défaut</span>
                  <strong>{form.default_tva_rate || "21"} %</strong>
                </li>
                <li>
                  <span>Validité devis</span>
                  <strong>{form.default_quote_validity_days || "30"} jours</strong>
                </li>
                <li>
                  <span>Thème PDF</span>
                  <strong>{form.pdf_theme}</strong>
                </li>
              </ul>
            </div>
          </Card>
        </aside>
      </form>
    </section>
  );
}