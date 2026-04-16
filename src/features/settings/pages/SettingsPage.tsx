import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { PageHeader } from "../../../components/ui/PageHeader/PageHeader";
import { Card } from "../../../components/ui/Card/Card";
import { Button } from "../../../components/ui/Button/Button";
import { FormField } from "../../../components/ui/FormField/FormField";
import { FormGrid } from "../../../components/ui/FormGrid/FormGrid";
import { TextInput } from "../../../components/ui/TextInput/TextInput";
import { TextArea } from "../../../components/ui/TextArea/TextArea";
import { Select } from "../../../components/ui/Select/Select";
import { ErrorMessage } from "../../../components/ui/ErrorMessage/ErrorMessage";
import { LoadingBlock } from "../../../components/ui/LoadingBlock/LoadingBlock";
import { useCompanySettings } from "../hooks/useCompanySettings";
import "./SettingsPage.css";

type SettingsFormState = {
  name: string;
  logo_url: string;
  email: string;
  phone: string;
  website: string;
  vat_number: string;
  iban: string;
  bic: string;
  address_line1: string;
  address_line2: string;
  postal_code: string;
  city: string;
  country: string;
  default_tva_rate: string;
  default_quote_validity_days: string;
  default_deposit_percent: string;
  pdf_theme: string;
  default_terms: string;
  default_notes: string;
  legal_mentions: string;
};

function toFormState(
  company: ReturnType<typeof useCompanySettings>["company"]
): SettingsFormState {
  return {
    name: company?.name ?? "",
    logo_url: company?.logo_url ?? "",
    email: company?.email ?? "",
    phone: company?.phone ?? "",
    website: company?.website ?? "",
    vat_number: company?.vat_number ?? "",
    iban: company?.iban ?? "",
    bic: company?.bic ?? "",
    address_line1: company?.address_line1 ?? "",
    address_line2: company?.address_line2 ?? "",
    postal_code: company?.postal_code ?? "",
    city: company?.city ?? "",
    country: company?.country ?? "Belgique",
    default_tva_rate: String(company?.default_tva_rate ?? 21),
    default_quote_validity_days: String(
      company?.default_quote_validity_days ?? 30
    ),
    default_deposit_percent: String(company?.default_deposit_percent ?? 0),
    pdf_theme: company?.pdf_theme ?? "artisan-classic",
    default_terms: company?.default_terms ?? "",
    default_notes: company?.default_notes ?? "",
    legal_mentions: company?.legal_mentions ?? "",
  };
}

function isValidEmail(value: string) {
  if (!value.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidUrl(value: string) {
  if (!value.trim()) return true;

  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export function SettingsPage() {
  const { company, loading, saving, error, saveCompany } = useCompanySettings();
  const [form, setForm] = useState<SettingsFormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (company) {
      setForm(toFormState(company));
    }
  }, [company]);

  function updateField<K extends keyof SettingsFormState>(
    field: K,
    value: SettingsFormState[K]
  ) {
    setForm((prev) =>
      prev
        ? {
            ...prev,
            [field]: value,
          }
        : prev
    );
  }

  const hasLogoPreview = useMemo(() => {
    return !!form?.logo_url.trim() && isValidUrl(form.logo_url);
  }, [form?.logo_url]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form) return;

    setFormError(null);
    setSuccessMessage(null);

    if (!form.name.trim()) {
      setFormError("Le nom de l’entreprise est obligatoire.");
      return;
    }

    if (!isValidEmail(form.email)) {
      setFormError("L’adresse email n’est pas valide.");
      return;
    }

    if (!isValidUrl(form.website)) {
      setFormError("L’URL du site web n’est pas valide.");
      return;
    }

    if (form.logo_url.trim() && !isValidUrl(form.logo_url)) {
      setFormError("L’URL du logo n’est pas valide.");
      return;
    }

    const defaultTvaRate = Number(form.default_tva_rate);
    const defaultQuoteValidityDays = Number(form.default_quote_validity_days);
    const defaultDepositPercent = Number(form.default_deposit_percent);

    if (Number.isNaN(defaultTvaRate) || defaultTvaRate < 0) {
      setFormError("Le taux de TVA par défaut doit être un nombre positif.");
      return;
    }

    if (
      Number.isNaN(defaultQuoteValidityDays) ||
      defaultQuoteValidityDays < 0
    ) {
      setFormError(
        "Le délai de validité par défaut doit être un nombre positif."
      );
      return;
    }

    if (Number.isNaN(defaultDepositPercent) || defaultDepositPercent < 0) {
      setFormError("L’acompte par défaut doit être un nombre positif.");
      return;
    }

    const ok = await saveCompany({
      name: form.name.trim(),
      logo_url: form.logo_url.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      website: form.website.trim() || null,
      vat_number: form.vat_number.trim() || null,
      iban: form.iban.trim() || null,
      bic: form.bic.trim() || null,
      address_line1: form.address_line1.trim() || null,
      address_line2: form.address_line2.trim() || null,
      postal_code: form.postal_code.trim() || null,
      city: form.city.trim() || null,
      country: form.country.trim() || "Belgique",
      default_tva_rate: defaultTvaRate,
      default_quote_validity_days: defaultQuoteValidityDays,
      default_deposit_percent: defaultDepositPercent,
      pdf_theme: form.pdf_theme,
      default_terms: form.default_terms.trim() || null,
      default_notes: form.default_notes.trim() || null,
      legal_mentions: form.legal_mentions.trim() || null,
    });

    if (!ok) {
      return;
    }

    setSuccessMessage("Paramètres enregistrés avec succès.");
  }

  if (loading || !form) {
    return <LoadingBlock message="Chargement des paramètres..." />;
  }

  return (
    <section>
      <PageHeader
        title="Paramètres"
        description="Informations de l’entreprise et valeurs par défaut utilisées dans les devis."
      />

      <Card>
        <form className="settings-page__form" onSubmit={handleSubmit}>
          <div className="settings-page__section">
            <h2 className="settings-page__section-title">
              Informations de l’entreprise
            </h2>

            <FormGrid columns="2">
              <FormField label="Nom de l’entreprise *">
                <TextInput
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder="Ex. Peinture Dupont"
                />
              </FormField>

              <FormField label="Logo (URL)">
                <TextInput
                  value={form.logo_url}
                  onChange={(e) => updateField("logo_url", e.target.value)}
                  placeholder="https://..."
                />
              </FormField>
            </FormGrid>

            {hasLogoPreview && (
              <div className="settings-page__logo-preview">
                <span className="settings-page__logo-label">Aperçu du logo</span>
                <img
                  src={form.logo_url}
                  alt="Logo entreprise"
                  className="settings-page__logo-image"
                />
              </div>
            )}

            <FormGrid columns="2">
              <FormField label="Email">
                <TextInput
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  placeholder="contact@entreprise.be"
                />
              </FormField>

              <FormField label="Téléphone">
                <TextInput
                  value={form.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  placeholder="+32 ..."
                />
              </FormField>
            </FormGrid>

            <FormGrid columns="2">
              <FormField label="Site web">
                <TextInput
                  value={form.website}
                  onChange={(e) => updateField("website", e.target.value)}
                  placeholder="https://..."
                />
              </FormField>

              <FormField label="Numéro TVA">
                <TextInput
                  value={form.vat_number}
                  onChange={(e) => updateField("vat_number", e.target.value)}
                  placeholder="BE0123456789"
                />
              </FormField>
            </FormGrid>

            <FormGrid columns="2">
              <FormField label="IBAN">
                <TextInput
                  value={form.iban}
                  onChange={(e) => updateField("iban", e.target.value)}
                  placeholder="BE00 0000 0000 0000"
                />
              </FormField>

              <FormField label="BIC">
                <TextInput
                  value={form.bic}
                  onChange={(e) => updateField("bic", e.target.value)}
                  placeholder="BICSWIFT"
                />
              </FormField>
            </FormGrid>
          </div>

          <div className="settings-page__section">
            <h2 className="settings-page__section-title">Adresse</h2>

            <FormField label="Adresse">
              <TextInput
                value={form.address_line1}
                onChange={(e) => updateField("address_line1", e.target.value)}
              />
            </FormField>

            <FormField label="Complément d’adresse">
              <TextInput
                value={form.address_line2}
                onChange={(e) => updateField("address_line2", e.target.value)}
              />
            </FormField>

            <FormGrid columns="3-1">
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
            </FormGrid>

            <FormField label="Pays">
              <TextInput
                value={form.country}
                onChange={(e) => updateField("country", e.target.value)}
              />
            </FormField>
          </div>

          <div className="settings-page__section">
            <h2 className="settings-page__section-title">
              Valeurs par défaut des devis
            </h2>

            <FormGrid columns="2">
              <FormField label="TVA par défaut (%)">
                <TextInput
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.default_tva_rate}
                  onChange={(e) =>
                    updateField("default_tva_rate", e.target.value)
                  }
                />
              </FormField>

              <FormField label="Validité du devis (jours)">
                <TextInput
                  type="number"
                  min="0"
                  value={form.default_quote_validity_days}
                  onChange={(e) =>
                    updateField("default_quote_validity_days", e.target.value)
                  }
                />
              </FormField>
            </FormGrid>

            <FormGrid columns="2">
              <FormField label="Acompte par défaut (%)">
                <TextInput
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.default_deposit_percent}
                  onChange={(e) =>
                    updateField("default_deposit_percent", e.target.value)
                  }
                />
              </FormField>

              <FormField label="Style PDF">
                <Select
                  value={form.pdf_theme}
                  onChange={(e) => updateField("pdf_theme", e.target.value)}
                >
                  <option value="artisan-classic">Artisan classique</option>
                  <option value="minimal">Minimal</option>
                  <option value="premium-beige">Premium beige</option>
                </Select>
              </FormField>
            </FormGrid>

            <FormField label="Conditions par défaut">
              <TextArea
                rows={6}
                value={form.default_terms}
                onChange={(e) => updateField("default_terms", e.target.value)}
                placeholder="Conditions générales affichées par défaut sur les devis..."
              />
            </FormField>

            <FormField label="Notes par défaut">
              <TextArea
                rows={5}
                value={form.default_notes}
                onChange={(e) => updateField("default_notes", e.target.value)}
                placeholder="Notes internes ou texte de fin de devis..."
              />
            </FormField>

            <FormField label="Mentions légales PDF">
              <TextArea
                rows={5}
                value={form.legal_mentions}
                onChange={(e) => updateField("legal_mentions", e.target.value)}
                placeholder="Mentions légales à afficher sur le PDF..."
              />
            </FormField>
          </div>

          {(formError || error) && <ErrorMessage message={formError || error || ""} />}

          {successMessage && (
            <p className="settings-page__success">{successMessage}</p>
          )}

          <div className="settings-page__actions">
            <Button type="submit" disabled={saving}>
              {saving ? "Enregistrement..." : "Enregistrer les paramètres"}
            </Button>
          </div>
        </form>
      </Card>
    </section>
  );
}