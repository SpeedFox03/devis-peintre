import { useEffect, useState } from "react";
import { Button } from "../../../components/ui/Button/Button";
import { Card } from "../../../components/ui/Card/Card";
import { ErrorMessage } from "../../../components/ui/ErrorMessage/ErrorMessage";
import { FormField } from "../../../components/ui/FormField/FormField";
import { FormGrid } from "../../../components/ui/FormGrid/FormGrid";
import { TextInput } from "../../../components/ui/TextInput/TextInput";
import { supabase } from "../../../lib/supabase";

type EmailSettingsPanelProps = {
  companyId: string;
  companyName: string;
  companyEmail: string | null;
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
};

type EmailSettingsForm = {
  fromName: string;
  fromEmail: string;
  replyToEmail: string;
  apiKey: string;
  enabled: boolean;
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
  };
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function formatTestDate(value: string | null) {
  if (!value) return "Jamais";
  return new Intl.DateTimeFormat("fr-BE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

async function fetchEmailSettings(companyId: string) {
  return supabase
    .from("company_email_settings")
    .select(
      "provider, from_name, from_email, reply_to_email, api_key_last_four, enabled, last_tested_at, last_test_status, last_error_message",
    )
    .eq("company_id", companyId)
    .maybeSingle();
}

export function EmailSettingsPanel({
  companyId,
  companyName,
  companyEmail,
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
    setForm({
      fromName: loaded?.from_name ?? companyName,
      fromEmail: loaded?.from_email ?? companyEmail ?? "",
      replyToEmail: loaded?.reply_to_email ?? companyEmail ?? "",
      apiKey: "",
      enabled: loaded?.enabled ?? false,
    });
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
      setForm({
        fromName: loaded?.from_name ?? companyName,
        fromEmail: loaded?.from_email ?? companyEmail ?? "",
        replyToEmail: loaded?.reply_to_email ?? companyEmail ?? "",
        apiKey: "",
        enabled: loaded?.enabled ?? false,
      });
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
      return "Ajoute une clé API Resend pour enregistrer cette configuration.";
    }
    if (form.apiKey.trim() && !form.apiKey.trim().startsWith("re_")) {
      return "La clé API Resend doit commencer par re_.";
    }
    if (form.enabled && !apiKeyConfigured && !form.apiKey.trim()) {
      return "La configuration ne peut pas être activée sans clé API.";
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

    const { error: saveError } = await supabase.rpc(
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

    if (saveError) {
      setError(saveError.message);
      setSaving(false);
      return false;
    }

    setForm((current) => ({ ...current, apiKey: "" }));
    setSaving(false);
    if (!options.silent) {
      setSuccess("Configuration e-mail enregistrée en toute sécurité.");
    }
    await loadEmailSettings();
    return true;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
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

    setSuccess(`E-mail de test envoyé à ${result?.recipient ?? testRecipient}.`);
    setTesting(false);
    await loadEmailSettings();
  }

  function resetForm() {
    setError(null);
    setSuccess(null);
    setForm({
      fromName: settings?.from_name ?? companyName,
      fromEmail: settings?.from_email ?? companyEmail ?? "",
      replyToEmail: settings?.reply_to_email ?? companyEmail ?? "",
      apiKey: "",
      enabled: settings?.enabled ?? false,
    });
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
              <p className="settings-premium-page__section-eyebrow">Envoi des devis</p>
              <h2 className="settings-premium-page__section-title">
                Configuration Resend
              </h2>
            </div>
            <span
              className={`settings-premium-page__email-status ${
                form.enabled && apiKeyConfigured
                  ? "settings-premium-page__email-status--active"
                  : ""
              }`}
            >
              {form.enabled && apiKeyConfigured ? "Actif" : "Inactif"}
            </span>
          </div>

          <div className="settings-premium-page__email-intro">
            <p>
              Chaque entreprise utilise sa propre clé Resend et son propre domaine
              d'expédition. La clé est chiffrée côté Supabase et n'est jamais
              renvoyée au navigateur.
            </p>
          </div>

          <div className="settings-premium-page__form-block">
            <FormField label="Service d'envoi">
              <TextInput value="Resend" readOnly />
            </FormField>

            <FormGrid columns="2">
              <FormField label="Nom de l'expéditeur">
                <TextInput
                  value={form.fromName}
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
                  : "Utilise une clé Resend limitée à l'envoi et à ce domaine."}
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
                  Les boutons d'envoi ne seront disponibles que lorsque cette
                  configuration aura été testée.
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
            {saving ? "Enregistrement…" : "Enregistrer la configuration"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleTest}
            disabled={saving || testing || !form.enabled}
          >
            {testing ? "Envoi du test…" : "Envoyer un e-mail de test"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={resetForm}
            disabled={saving || testing}
          >
            Réinitialiser
          </Button>
        </div>
      </div>

      <aside className="settings-premium-page__right">
        <Card>
          <div className="settings-premium-page__side-card">
            <p className="settings-premium-page__side-label">État de l'envoi</p>
            <ul className="settings-premium-page__meta-list">
              <li>
                <span>Clé API</span>
                <strong>
                  {apiKeyConfigured
                    ? `Configurée ••••${settings?.api_key_last_four}`
                    : "Non configurée"}
                </strong>
              </li>
              <li>
                <span>Expéditeur</span>
                <strong>{form.fromEmail || "-"}</strong>
              </li>
              <li>
                <span>Destinataire du test</span>
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
      </aside>
    </form>
  );
}
