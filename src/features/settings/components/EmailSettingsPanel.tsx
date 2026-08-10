import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { Button } from "../../../components/ui/Button/Button";
import { Card } from "../../../components/ui/Card/Card";
import { ErrorMessage } from "../../../components/ui/ErrorMessage/ErrorMessage";
import { FormField } from "../../../components/ui/FormField/FormField";
import { FormGrid } from "../../../components/ui/FormGrid/FormGrid";
import { TextArea } from "../../../components/ui/TextArea/TextArea";
import { TextInput } from "../../../components/ui/TextInput/TextInput";
import { supabase } from "../../../lib/supabase";

type EmailSettingsPanelProps = {
  companyId: string;
  companyName: string;
  companyEmail: string | null;
  companyLogoUrl: string | null;
};

type CompanyEmailSettings = {
  provider: "resend";
  from_name: string;
  from_email: string;
  reply_to_email: string | null;
  api_key_last_four: string | null;
  enabled: boolean;
  last_tested_at: string | null;
  last_test_status: "success" | "error" | null;
  last_error_message: string | null;
  subject_template: string;
  heading: string;
  intro_text: string;
  button_label: string;
  signature: string;
  primary_color: string;
  background_color: string;
  show_logo: boolean;
};

type EmailSettingsForm = {
  fromName: string;
  fromEmail: string;
  replyToEmail: string;
  apiKey: string;
  enabled: boolean;
  subjectTemplate: string;
  heading: string;
  introText: string;
  buttonLabel: string;
  signature: string;
  primaryColor: string;
  backgroundColor: string;
  showLogo: boolean;
};

const DEFAULT_BRANDING = {
  subjectTemplate: "Votre devis {{quote_number}} – {{company_name}}",
  heading: "Votre devis est prêt",
  introText: "{{company_name}} vous invite à consulter son devis en ligne.",
  buttonLabel: "Consulter et répondre au devis",
  signature: "Merci pour votre confiance.",
  primaryColor: "#6f523c",
  backgroundColor: "#f6efe6",
  showLogo: true,
};

function createInitialForm(
  companyName: string,
  companyEmail: string | null,
): EmailSettingsForm {
  return {
    fromName: companyName,
    fromEmail: companyEmail ?? "",
    replyToEmail: companyEmail ?? "",
    apiKey: "",
    enabled: false,
    ...DEFAULT_BRANDING,
  };
}

function mapSettingsToForm(
  settings: CompanyEmailSettings | null,
  companyName: string,
  companyEmail: string | null,
): EmailSettingsForm {
  if (!settings) return createInitialForm(companyName, companyEmail);

  return {
    fromName: settings.from_name || companyName,
    fromEmail: settings.from_email || companyEmail || "",
    replyToEmail: settings.reply_to_email || companyEmail || "",
    apiKey: "",
    enabled: settings.enabled,
    subjectTemplate: settings.subject_template || DEFAULT_BRANDING.subjectTemplate,
    heading: settings.heading || DEFAULT_BRANDING.heading,
    introText: settings.intro_text || DEFAULT_BRANDING.introText,
    buttonLabel: settings.button_label || DEFAULT_BRANDING.buttonLabel,
    signature: settings.signature ?? DEFAULT_BRANDING.signature,
    primaryColor: settings.primary_color || DEFAULT_BRANDING.primaryColor,
    backgroundColor: settings.background_color || DEFAULT_BRANDING.backgroundColor,
    showLogo: settings.show_logo ?? true,
  };
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value);
}

function formatTestDate(value: string | null) {
  if (!value) return "Jamais";
  return new Intl.DateTimeFormat("fr-BE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function fillPreviewTokens(value: string, companyName: string) {
  return value
    .replaceAll("{{company_name}}", companyName)
    .replaceAll("{{quote_number}}", "DEV-2026-0011")
    .replaceAll("{{quote_title}}", "Travaux de peinture intérieure")
    .replaceAll("{{client_name}}", "Sophie Martin");
}

async function fetchEmailSettings(companyId: string) {
  return supabase
    .rpc("get_company_email_settings", { p_company_id: companyId })
    .maybeSingle();
}

export function EmailSettingsPanel({
  companyId,
  companyName,
  companyEmail,
  companyLogoUrl,
}: EmailSettingsPanelProps) {
  const [form, setForm] = useState<EmailSettingsForm>(() =>
    createInitialForm(companyName, companyEmail),
  );
  const [settings, setSettings] = useState<CompanyEmailSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const apiKeyConfigured = Boolean(settings?.api_key_last_four);
  const testRecipient = form.replyToEmail.trim() || companyEmail || "";
  const previewSubject = fillPreviewTokens(form.subjectTemplate, companyName);
  const previewIntro = fillPreviewTokens(form.introText, companyName);
  const previewStyle = {
    "--email-preview-primary": form.primaryColor,
    "--email-preview-background": form.backgroundColor,
  } as CSSProperties;

  async function loadEmailSettings() {
    setLoading(true);
    setError(null);

    const { data, error: loadError } = await fetchEmailSettings(companyId);

    if (loadError) {
      setError(loadError.message);
      setLoading(false);
      return;
    }

    const loaded = (data ?? null) as CompanyEmailSettings | null;
    setSettings(loaded);
    setForm(mapSettingsToForm(loaded, companyName, companyEmail));
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;

    void fetchEmailSettings(companyId).then(({ data, error: loadError }) => {
      if (cancelled) return;

      if (loadError) {
        setError(loadError.message);
        setLoading(false);
        return;
      }

      const loaded = (data ?? null) as CompanyEmailSettings | null;
      setSettings(loaded);
      setForm(mapSettingsToForm(loaded, companyName, companyEmail));
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [companyEmail, companyId, companyName]);

  function updateForm<K extends keyof EmailSettingsForm>(
    field: K,
    value: EmailSettingsForm[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function validateForm() {
    if (!form.fromName.trim()) return "Le nom de l'expéditeur est obligatoire.";
    if (!isValidEmail(form.fromEmail.trim())) return "L'adresse d'expédition est invalide.";
    if (form.replyToEmail.trim() && !isValidEmail(form.replyToEmail.trim())) {
      return "L'adresse de réponse est invalide.";
    }
    if (!apiKeyConfigured && !form.apiKey.trim()) {
      return "Ajoute une clé API Resend pour relier le compte d'envoi.";
    }
    if (form.apiKey.trim() && !form.apiKey.trim().startsWith("re_")) {
      return "La clé API Resend doit commencer par re_.";
    }
    if (!form.subjectTemplate.trim() || form.subjectTemplate.trim().length > 200) {
      return "L'objet doit contenir entre 1 et 200 caractères.";
    }
    if (!form.heading.trim() || form.heading.trim().length > 120) {
      return "Le titre doit contenir entre 1 et 120 caractères.";
    }
    if (!form.introText.trim() || form.introText.trim().length > 600) {
      return "Le texte d'introduction doit contenir entre 1 et 600 caractères.";
    }
    if (!form.buttonLabel.trim() || form.buttonLabel.trim().length > 60) {
      return "Le libellé du bouton doit contenir entre 1 et 60 caractères.";
    }
    if (form.signature.trim().length > 300) return "La signature est trop longue.";
    if (!isValidColor(form.primaryColor) || !isValidColor(form.backgroundColor)) {
      return "Les couleurs doivent être au format hexadécimal, par exemple #6f523c.";
    }
    return null;
  }

  async function persistSettings(options: { silent?: boolean } = {}) {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return false;
    }

    setSaving(true);
    setError(null);
    if (!options.silent) setSuccess(null);

    const { error: connectionError } = await supabase.rpc(
      "save_company_email_settings",
      {
        p_company_id: companyId,
        p_from_name: form.fromName.trim(),
        p_from_email: form.fromEmail.trim().toLowerCase(),
        p_reply_to_email: form.replyToEmail.trim().toLowerCase() || null,
        p_api_key: form.apiKey.trim() || null,
        p_enabled: form.enabled,
      },
    );

    if (connectionError) {
      setError(connectionError.message);
      setSaving(false);
      return false;
    }

    const { error: brandingError } = await supabase.rpc(
      "save_company_email_branding",
      {
        p_company_id: companyId,
        p_subject_template: form.subjectTemplate.trim(),
        p_heading: form.heading.trim(),
        p_intro_text: form.introText.trim(),
        p_button_label: form.buttonLabel.trim(),
        p_signature: form.signature.trim(),
        p_primary_color: form.primaryColor.toLowerCase(),
        p_background_color: form.backgroundColor.toLowerCase(),
        p_show_logo: form.showLogo,
      },
    );

    if (brandingError) {
      setError(brandingError.message);
      setSaving(false);
      return false;
    }

    setForm((current) => ({ ...current, apiKey: "" }));
    setSaving(false);
    if (!options.silent) {
      setSuccess("Compte d'envoi et design de l'e-mail enregistrés.");
    }
    await loadEmailSettings();
    return true;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await persistSettings();
  }

  async function handleTest() {
    setTesting(true);
    setError(null);
    setSuccess(null);

    const saved = await persistSettings({ silent: true });
    if (!saved) {
      setTesting(false);
      return;
    }

    const { data, error: testError } = await supabase.functions.invoke(
      "test-resend-configuration",
      { body: { companyId } },
    );

    if (testError) {
      setTesting(false);
      const context = (testError as { context?: Response }).context;
      const payload = context
        ? await context.clone().json().catch(() => null) as { error?: string } | null
        : null;
      await loadEmailSettings();
      setError(payload?.error ?? testError.message);
      return;
    }

    const result = data as { error?: string; recipient?: string } | null;
    if (result?.error) {
      setTesting(false);
      await loadEmailSettings();
      setError(result.error);
      return;
    }

    setSuccess(`E-mail personnalisé de test envoyé à ${result?.recipient ?? testRecipient}.`);
    setTesting(false);
    await loadEmailSettings();
  }

  function resetForm() {
    setError(null);
    setSuccess(null);
    setForm(mapSettingsToForm(settings, companyName, companyEmail));
  }

  if (loading) {
    return (
      <Card>
        <p className="settings-premium-page__email-loading">
          Chargement de la configuration e-mail…
        </p>
      </Card>
    );
  }

  return (
    <form className="settings-premium-page__layout" onSubmit={handleSubmit}>
      <div className="settings-premium-page__center">
        <Card>
          <div className="settings-premium-page__section-header">
            <div>
              <p className="settings-premium-page__section-eyebrow">Compte d'envoi</p>
              <h2 className="settings-premium-page__section-title">
                Connexion e-mail avec Resend
              </h2>
            </div>
            <span
              className={`settings-premium-page__email-status ${
                form.enabled && apiKeyConfigured
                  ? "settings-premium-page__email-status--active"
                  : ""
              }`}
            >
              {form.enabled && apiKeyConfigured ? "Connecté" : "Non connecté"}
            </span>
          </div>

          <div className="settings-premium-page__email-intro">
            <p>
              Chaque entreprise relie son propre compte Resend et son domaine
              d'expédition. La clé est stockée dans Supabase Vault et n'est jamais
              renvoyée au navigateur.
            </p>
          </div>

          <div className="settings-premium-page__form-block">
            <FormGrid columns="2">
              <FormField label="Nom de l'expéditeur">
                <TextInput
                  value={form.fromName}
                  maxLength={120}
                  onChange={(event) => updateForm("fromName", event.target.value)}
                  placeholder="Moment D.Art"
                />
              </FormField>
              <FormField label="Adresse d'expédition">
                <TextInput
                  type="email"
                  value={form.fromEmail}
                  onChange={(event) => updateForm("fromEmail", event.target.value)}
                  placeholder="contact@momentdart.be"
                />
              </FormField>
            </FormGrid>

            <FormField label="Adresse de réponse">
              <TextInput
                type="email"
                value={form.replyToEmail}
                onChange={(event) => updateForm("replyToEmail", event.target.value)}
                placeholder="contact@momentdart.be"
              />
            </FormField>

            <FormField label={apiKeyConfigured ? "Remplacer la clé API" : "Clé API Resend"}>
              <TextInput
                type="password"
                value={form.apiKey}
                onChange={(event) => updateForm("apiKey", event.target.value)}
                placeholder={
                  apiKeyConfigured
                    ? `Clé configurée ••••${settings?.api_key_last_four}`
                    : "re_…"
                }
                autoComplete="new-password"
                spellCheck={false}
              />
              <span className="settings-premium-page__email-field-hint">
                {apiKeyConfigured
                  ? "Laisse ce champ vide pour conserver la clé actuelle."
                  : "Crée une clé limitée à l'envoi depuis le domaine de cette entreprise."}
              </span>
            </FormField>

            <label className="settings-premium-page__email-toggle">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(event) => updateForm("enabled", event.target.checked)}
              />
              <span>
                <strong>Activer l'envoi des devis par e-mail</strong>
                <small>
                  Enregistre puis envoie un test avant le premier devis client.
                </small>
              </span>
            </label>
          </div>
        </Card>

        <Card>
          <div className="settings-premium-page__section-header">
            <div>
              <p className="settings-premium-page__section-eyebrow">Personnalisation</p>
              <h2 className="settings-premium-page__section-title">Design de l'e-mail</h2>
            </div>
          </div>

          <div className="settings-premium-page__form-block">
            <FormField label="Objet de l'e-mail">
              <TextInput
                value={form.subjectTemplate}
                maxLength={200}
                onChange={(event) => updateForm("subjectTemplate", event.target.value)}
              />
              <span className="settings-premium-page__email-field-hint">
                Variables : {"{{company_name}}"}, {"{{quote_number}}"}, {"{{quote_title}}"} et {"{{client_name}}"}.
              </span>
            </FormField>

            <FormField label="Titre principal">
              <TextInput
                value={form.heading}
                maxLength={120}
                onChange={(event) => updateForm("heading", event.target.value)}
              />
            </FormField>

            <FormField label="Texte d'introduction">
              <TextArea
                rows={4}
                value={form.introText}
                maxLength={600}
                onChange={(event) => updateForm("introText", event.target.value)}
              />
            </FormField>

            <FormGrid columns="2">
              <FormField label="Texte du bouton">
                <TextInput
                  value={form.buttonLabel}
                  maxLength={60}
                  onChange={(event) => updateForm("buttonLabel", event.target.value)}
                />
              </FormField>
              <FormField label="Signature">
                <TextInput
                  value={form.signature}
                  maxLength={300}
                  onChange={(event) => updateForm("signature", event.target.value)}
                />
              </FormField>
            </FormGrid>

            <div className="settings-premium-page__email-colors">
              <FormField label="Couleur principale">
                <div className="settings-premium-page__email-color-control">
                  <input
                    type="color"
                    value={isValidColor(form.primaryColor) ? form.primaryColor : DEFAULT_BRANDING.primaryColor}
                    onChange={(event) => updateForm("primaryColor", event.target.value)}
                    aria-label="Choisir la couleur principale"
                  />
                  <TextInput
                    value={form.primaryColor}
                    maxLength={7}
                    onChange={(event) => updateForm("primaryColor", event.target.value)}
                  />
                </div>
              </FormField>

              <FormField label="Couleur de fond">
                <div className="settings-premium-page__email-color-control">
                  <input
                    type="color"
                    value={isValidColor(form.backgroundColor) ? form.backgroundColor : DEFAULT_BRANDING.backgroundColor}
                    onChange={(event) => updateForm("backgroundColor", event.target.value)}
                    aria-label="Choisir la couleur de fond"
                  />
                  <TextInput
                    value={form.backgroundColor}
                    maxLength={7}
                    onChange={(event) => updateForm("backgroundColor", event.target.value)}
                  />
                </div>
              </FormField>
            </div>

            <label className="settings-premium-page__email-toggle">
              <input
                type="checkbox"
                checked={form.showLogo}
                onChange={(event) => updateForm("showLogo", event.target.checked)}
              />
              <span>
                <strong>Afficher le logo de l'entreprise</strong>
                <small>
                  {companyLogoUrl
                    ? "Le logo configuré dans Apparence sera repris dans l'e-mail."
                    : "Ajoute d'abord un logo dans la page Apparence pour le voir dans l'e-mail."}
                </small>
              </span>
            </label>
          </div>
        </Card>

        {error && <ErrorMessage message={error} />}
        {success && (
          <p className="settings-premium-page__email-success" role="status">
            {success}
          </p>
        )}

        <div className="settings-premium-page__form-actions">
          <Button type="submit" disabled={saving || testing}>
            {saving ? "Enregistrement…" : "Enregistrer l'e-mail"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleTest}
            disabled={saving || testing || !form.enabled}
          >
            {testing ? "Envoi du test…" : "Envoyer l'aperçu par e-mail"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={resetForm}
            disabled={saving || testing}
          >
            Annuler les modifications
          </Button>
        </div>
      </div>

      <aside className="settings-premium-page__right settings-premium-page__email-aside">
        <Card>
          <div className="settings-premium-page__side-card">
            <p className="settings-premium-page__side-label">État de la connexion</p>
            <ul className="settings-premium-page__meta-list">
              <li>
                <span>Compte</span>
                <strong>{apiKeyConfigured ? `Relié ••••${settings?.api_key_last_four}` : "Non relié"}</strong>
              </li>
              <li>
                <span>Expéditeur</span>
                <strong>{form.fromEmail || "-"}</strong>
              </li>
              <li>
                <span>Test envoyé à</span>
                <strong>{testRecipient || "-"}</strong>
              </li>
              <li>
                <span>Dernier test</span>
                <strong>{formatTestDate(settings?.last_tested_at ?? null)}</strong>
              </li>
              <li>
                <span>Résultat</span>
                <strong>
                  {settings?.last_test_status === "success"
                    ? "Réussi"
                    : settings?.last_test_status === "error"
                      ? "Échec"
                      : "Non testé"}
                </strong>
              </li>
            </ul>
            {settings?.last_test_status === "error" && settings.last_error_message && (
              <p className="settings-premium-page__email-last-error">
                {settings.last_error_message}
              </p>
            )}
          </div>
        </Card>

        <Card className="settings-premium-page__email-preview-card">
          <div className="settings-premium-page__email-preview-heading">
            <span>Aperçu en direct</span>
            <strong>{previewSubject}</strong>
          </div>
          <div className="settings-premium-page__email-preview" style={previewStyle}>
            <div className="settings-premium-page__email-preview-shell">
              {form.showLogo && companyLogoUrl ? (
                <img src={companyLogoUrl} alt={`Logo ${companyName}`} />
              ) : null}
              <small>Votre devis</small>
              <h3>{fillPreviewTokens(form.heading, companyName)}</h3>
              <p>Bonjour Sophie Martin,</p>
              <p>{previewIntro}</p>
              <div className="settings-premium-page__email-preview-summary">
                <span>DEV-2026-0011</span>
                <strong>2 450,00 €</strong>
              </div>
              <span className="settings-premium-page__email-preview-button">
                {fillPreviewTokens(form.buttonLabel, companyName)}
              </span>
              {form.signature ? <p>{fillPreviewTokens(form.signature, companyName)}</p> : null}
            </div>
          </div>
        </Card>
      </aside>
    </form>
  );
}
