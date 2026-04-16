import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { PageHeader } from "../../../components/ui/PageHeader/PageHeader";
import { LoadingBlock } from "../../../components/ui/LoadingBlock/LoadingBlock";
import { ErrorMessage } from "../../../components/ui/ErrorMessage/ErrorMessage";
import { EmptyState } from "../../../components/ui/EmptyState/EmptyState";
import { Card } from "../../../components/ui/Card/Card";
import { DataTable } from "../../../components/ui/DataTable/DataTable";
import { Button } from "../../../components/ui/Button/Button";
import { FormField } from "../../../components/ui/FormField/FormField";
import { FormGrid } from "../../../components/ui/FormGrid/FormGrid";
import { TextInput } from "../../../components/ui/TextInput/TextInput";
import { TextArea } from "../../../components/ui/TextArea/TextArea";
import "./CustomerDetailsPage.css";

type CustomerDetails = {
  id: string;
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  billing_address_line1: string | null;
  billing_address_line2: string | null;
  billing_postal_code: string | null;
  billing_city: string | null;
  billing_country: string | null;
  jobsite_address_line1: string | null;
  jobsite_address_line2: string | null;
  jobsite_postal_code: string | null;
  jobsite_city: string | null;
  jobsite_country: string | null;
  notes: string | null;
  archived_at: string | null;
};

type CustomerQuoteRow = {
  id: string;
  quote_number: string;
  title: string;
  status: "draft" | "sent" | "accepted" | "rejected" | "expired" | "invoiced";
  issue_date: string;
  total_ttc: number;
};

type CustomerFormState = {
  company_name: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  billing_address_line1: string;
  billing_address_line2: string;
  billing_postal_code: string;
  billing_city: string;
  billing_country: string;
  jobsite_address_line1: string;
  jobsite_address_line2: string;
  jobsite_postal_code: string;
  jobsite_city: string;
  jobsite_country: string;
  notes: string;
};

function getCustomerDisplayName(customer: CustomerDetails) {
  return (
    customer.company_name ||
    [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
    "Sans nom"
  );
}

function getStatusLabel(status: CustomerQuoteRow["status"]) {
  switch (status) {
    case "draft":
      return "Brouillon";
    case "sent":
      return "Envoyé";
    case "accepted":
      return "Accepté";
    case "rejected":
      return "Refusé";
    case "expired":
      return "Expiré";
    case "invoiced":
      return "Facturé";
    default:
      return status;
  }
}

function buildAddressLines(address: {
  line1: string | null;
  line2: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
}) {
  const lines: string[] = [];

  if (address.line1) lines.push(address.line1);
  if (address.line2) lines.push(address.line2);

  const cityLine = [address.postalCode, address.city].filter(Boolean).join(" ");
  if (cityLine) lines.push(cityLine);

  if (address.country) lines.push(address.country);

  return lines;
}

function createCustomerForm(customer: CustomerDetails | null): CustomerFormState {
  return {
    company_name: customer?.company_name ?? "",
    first_name: customer?.first_name ?? "",
    last_name: customer?.last_name ?? "",
    email: customer?.email ?? "",
    phone: customer?.phone ?? "",
    billing_address_line1: customer?.billing_address_line1 ?? "",
    billing_address_line2: customer?.billing_address_line2 ?? "",
    billing_postal_code: customer?.billing_postal_code ?? "",
    billing_city: customer?.billing_city ?? "",
    billing_country: customer?.billing_country ?? "Belgique",
    jobsite_address_line1: customer?.jobsite_address_line1 ?? "",
    jobsite_address_line2: customer?.jobsite_address_line2 ?? "",
    jobsite_postal_code: customer?.jobsite_postal_code ?? "",
    jobsite_city: customer?.jobsite_city ?? "",
    jobsite_country: customer?.jobsite_country ?? "Belgique",
    notes: customer?.notes ?? "",
  };
}

function isValidEmail(value: string) {
  if (!value.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function CustomerDetailsPage() {
  const { customerId } = useParams();
  const navigate = useNavigate();

  const [customer, setCustomer] = useState<CustomerDetails | null>(null);
  const [quotes, setQuotes] = useState<CustomerQuoteRow[]>([]);
  const [form, setForm] = useState<CustomerFormState>(createCustomerForm(null));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCustomerPage() {
      if (!customerId) {
        setError("Client introuvable.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const [customerRes, quotesRes] = await Promise.all([
        supabase
          .from("customers")
          .select(
            `
            id,
            company_name,
            first_name,
            last_name,
            email,
            phone,
            billing_address_line1,
            billing_address_line2,
            billing_postal_code,
            billing_city,
            billing_country,
            jobsite_address_line1,
            jobsite_address_line2,
            jobsite_postal_code,
            jobsite_city,
            jobsite_country,
            notes,
            archived_at
          `
          )
          .eq("id", customerId)
          .single(),
        supabase
          .from("quotes")
          .select("id, quote_number, title, status, issue_date, total_ttc")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false }),
      ]);

      if (cancelled) return;

      if (customerRes.error) {
        setError(customerRes.error.message);
        setLoading(false);
        return;
      }

      if (quotesRes.error) {
        setError(quotesRes.error.message);
        setLoading(false);
        return;
      }

      const loadedCustomer = customerRes.data as CustomerDetails;

      setCustomer(loadedCustomer);
      setForm(createCustomerForm(loadedCustomer));
      setQuotes((quotesRes.data ?? []) as CustomerQuoteRow[]);
      setLoading(false);
    }

    loadCustomerPage();

    return () => {
      cancelled = true;
    };
  }, [customerId]);

  const signedPotential = useMemo(() => {
    return quotes
      .filter((quote) => quote.status === "accepted" || quote.status === "invoiced")
      .reduce((sum, quote) => sum + Number(quote.total_ttc), 0);
  }, [quotes]);

  function updateField<K extends keyof CustomerFormState>(
    field: K,
    value: CustomerFormState[K]
  ) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function resetForm() {
    setForm(createCustomerForm(customer));
    setError(null);
    setSuccessMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!customer) {
      setError("Client introuvable.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    if (!form.company_name.trim() && !form.first_name.trim() && !form.last_name.trim()) {
      setError("Renseigne au moins une société ou un nom de client.");
      setSaving(false);
      return;
    }

    if (!isValidEmail(form.email)) {
      setError("L’adresse email n’est pas valide.");
      setSaving(false);
      return;
    }

    const payload = {
      company_name: form.company_name.trim() || null,
      first_name: form.first_name.trim() || null,
      last_name: form.last_name.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      billing_address_line1: form.billing_address_line1.trim() || null,
      billing_address_line2: form.billing_address_line2.trim() || null,
      billing_postal_code: form.billing_postal_code.trim() || null,
      billing_city: form.billing_city.trim() || null,
      billing_country: form.billing_country.trim() || "Belgique",
      jobsite_address_line1: form.jobsite_address_line1.trim() || null,
      jobsite_address_line2: form.jobsite_address_line2.trim() || null,
      jobsite_postal_code: form.jobsite_postal_code.trim() || null,
      jobsite_city: form.jobsite_city.trim() || null,
      jobsite_country: form.jobsite_country.trim() || "Belgique",
      notes: form.notes.trim() || null,
    };

    const { error: updateError } = await supabase
      .from("customers")
      .update(payload)
      .eq("id", customer.id);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    const updatedCustomer: CustomerDetails = {
      ...customer,
      ...payload,
    };

    setCustomer(updatedCustomer);
    setForm(createCustomerForm(updatedCustomer));
    setSuccessMessage("Client mis à jour avec succès.");
    setSaving(false);
  }

  async function handleArchiveToggle() {
    if (!customer) return;

    const nextArchivedAt = customer.archived_at ? null : new Date().toISOString();
    const confirmMessage = customer.archived_at
      ? "Réactiver ce client ?"
      : "Archiver ce client ?";

    const confirmed = window.confirm(confirmMessage);
    if (!confirmed) return;

    setArchiving(true);
    setError(null);
    setSuccessMessage(null);

    const { error: updateError } = await supabase
      .from("customers")
      .update({ archived_at: nextArchivedAt })
      .eq("id", customer.id);

    if (updateError) {
      setError(updateError.message);
      setArchiving(false);
      return;
    }

    const updatedCustomer: CustomerDetails = {
      ...customer,
      archived_at: nextArchivedAt,
    };

    setCustomer(updatedCustomer);
    setSuccessMessage(
      nextArchivedAt ? "Client archivé avec succès." : "Client réactivé avec succès."
    );
    setArchiving(false);
  }

  async function handleBackToList() {
    navigate("/clients");
  }

  if (loading) {
    return <LoadingBlock message="Chargement du client..." />;
  }

  if (error && !customer) {
    return <ErrorMessage message={error} />;
  }

  if (!customer) {
    return (
      <EmptyState
        title="Client introuvable"
        description="Ce client n'existe pas ou n'est pas accessible."
      />
    );
  }

  const billingAddressLines = buildAddressLines({
    line1: customer.billing_address_line1,
    line2: customer.billing_address_line2,
    postalCode: customer.billing_postal_code,
    city: customer.billing_city,
    country: customer.billing_country,
  });

  const jobsiteAddressLines = buildAddressLines({
    line1: customer.jobsite_address_line1,
    line2: customer.jobsite_address_line2,
    postalCode: customer.jobsite_postal_code,
    city: customer.jobsite_city,
    country: customer.jobsite_country,
  });

  return (
    <section className="customer-details-page">
      <PageHeader
        title={getCustomerDisplayName(customer)}
        description={`Fiche client détaillée — ${customer.archived_at ? "Archivé" : "Actif"}.`}
        actions={
          <div className="customer-details-page__actions">
            {!customer.archived_at && (
              <Link to={`/?new=1&customerId=${customer.id}`}>
                <Button type="button" variant="secondary">
                  Nouveau devis
                </Button>
              </Link>
            )}

            <Button
              type="button"
              variant="secondary"
              onClick={handleArchiveToggle}
              disabled={archiving}
            >
              {archiving
                ? "Mise à jour..."
                : customer.archived_at
                ? "Réactiver"
                : "Archiver"}
            </Button>

            <Button type="button" variant="secondary" onClick={handleBackToList}>
              Retour aux clients
            </Button>
          </div>
        }
      />

      <div className="customer-details-page__grid">
        <Card>
          <div className="customer-details-page__section">
            <h2 className="customer-details-page__title">Identité actuelle</h2>

            <dl className="customer-details-page__list">
              <div>
                <dt>Société</dt>
                <dd>{customer.company_name || "-"}</dd>
              </div>
              <div>
                <dt>Prénom</dt>
                <dd>{customer.first_name || "-"}</dd>
              </div>
              <div>
                <dt>Nom</dt>
                <dd>{customer.last_name || "-"}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{customer.email || "-"}</dd>
              </div>
              <div>
                <dt>Téléphone</dt>
                <dd>{customer.phone || "-"}</dd>
              </div>
              <div>
                <dt>Statut</dt>
                <dd>{customer.archived_at ? "Archivé" : "Actif"}</dd>
              </div>
            </dl>
          </div>
        </Card>

        <Card>
          <div className="customer-details-page__section">
            <h2 className="customer-details-page__title">Résumé commercial</h2>

            <dl className="customer-details-page__list">
              <div>
                <dt>Nombre de devis</dt>
                <dd>{quotes.length}</dd>
              </div>
              <div>
                <dt>Total signé potentiel</dt>
                <dd>{signedPotential.toFixed(2)} €</dd>
              </div>
            </dl>
          </div>
        </Card>
      </div>

      <Card>
        <form className="customer-details-page__form" onSubmit={handleSubmit}>
          <h2 className="customer-details-page__title">Modifier le client</h2>

          <FormGrid columns="2">
            <FormField label="Société">
              <TextInput
                value={form.company_name}
                onChange={(e) => updateField("company_name", e.target.value)}
              />
            </FormField>

            <FormField label="Email">
              <TextInput
                type="email"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
              />
            </FormField>
          </FormGrid>

          <FormGrid columns="2">
            <FormField label="Prénom">
              <TextInput
                value={form.first_name}
                onChange={(e) => updateField("first_name", e.target.value)}
              />
            </FormField>

            <FormField label="Nom">
              <TextInput
                value={form.last_name}
                onChange={(e) => updateField("last_name", e.target.value)}
              />
            </FormField>
          </FormGrid>

          <FormGrid columns="2">
            <FormField label="Téléphone">
              <TextInput
                value={form.phone}
                onChange={(e) => updateField("phone", e.target.value)}
              />
            </FormField>

            <FormField label="Pays facturation">
              <TextInput
                value={form.billing_country}
                onChange={(e) => updateField("billing_country", e.target.value)}
              />
            </FormField>
          </FormGrid>

          <h3 className="customer-details-page__subtitle">Adresse de facturation</h3>

          <FormField label="Adresse">
            <TextInput
              value={form.billing_address_line1}
              onChange={(e) => updateField("billing_address_line1", e.target.value)}
            />
          </FormField>

          <FormField label="Complément d’adresse">
            <TextInput
              value={form.billing_address_line2}
              onChange={(e) => updateField("billing_address_line2", e.target.value)}
            />
          </FormField>

          <FormGrid columns="2">
            <FormField label="Code postal">
              <TextInput
                value={form.billing_postal_code}
                onChange={(e) => updateField("billing_postal_code", e.target.value)}
              />
            </FormField>

            <FormField label="Ville">
              <TextInput
                value={form.billing_city}
                onChange={(e) => updateField("billing_city", e.target.value)}
              />
            </FormField>
          </FormGrid>

          <h3 className="customer-details-page__subtitle">Adresse chantier</h3>

          <FormGrid columns="2">
            <FormField label="Pays chantier">
              <TextInput
                value={form.jobsite_country}
                onChange={(e) => updateField("jobsite_country", e.target.value)}
              />
            </FormField>

            <div />
          </FormGrid>

          <FormField label="Adresse chantier">
            <TextInput
              value={form.jobsite_address_line1}
              onChange={(e) => updateField("jobsite_address_line1", e.target.value)}
            />
          </FormField>

          <FormField label="Complément d’adresse chantier">
            <TextInput
              value={form.jobsite_address_line2}
              onChange={(e) => updateField("jobsite_address_line2", e.target.value)}
            />
          </FormField>

          <FormGrid columns="2">
            <FormField label="Code postal chantier">
              <TextInput
                value={form.jobsite_postal_code}
                onChange={(e) => updateField("jobsite_postal_code", e.target.value)}
              />
            </FormField>

            <FormField label="Ville chantier">
              <TextInput
                value={form.jobsite_city}
                onChange={(e) => updateField("jobsite_city", e.target.value)}
              />
            </FormField>
          </FormGrid>

          <FormField label="Notes internes">
            <TextArea
              rows={5}
              value={form.notes}
              onChange={(e) => updateField("notes", e.target.value)}
            />
          </FormField>

          {error && <ErrorMessage message={error} />}
          {successMessage && (
            <p className="customer-details-page__success">{successMessage}</p>
          )}

          <div className="customer-details-page__actions">
            <Button type="submit" disabled={saving}>
              {saving ? "Enregistrement..." : "Enregistrer"}
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={resetForm}
              disabled={saving}
            >
              Réinitialiser
            </Button>
          </div>
        </form>
      </Card>

      <div className="customer-details-page__grid">
        <Card>
          <div className="customer-details-page__section">
            <h2 className="customer-details-page__title">Adresse de facturation</h2>

            {billingAddressLines.length === 0 ? (
              <p className="customer-details-page__empty">Aucune adresse renseignée.</p>
            ) : (
              <div className="customer-details-page__address">
                {billingAddressLines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <div className="customer-details-page__section">
            <h2 className="customer-details-page__title">Adresse chantier</h2>

            {jobsiteAddressLines.length === 0 ? (
              <p className="customer-details-page__empty">Aucune adresse renseignée.</p>
            ) : (
              <div className="customer-details-page__address">
                {jobsiteAddressLines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {quotes.length === 0 ? (
        <EmptyState
          title="Aucun devis lié"
          description="Ce client n'a encore aucun devis."
        />
      ) : (
        <DataTable
          headers={
            <tr>
              <th>Numéro</th>
              <th>Titre</th>
              <th>Statut</th>
              <th>Date</th>
              <th style={{ textAlign: "right" }}>Total TTC</th>
            </tr>
          }
        >
          {quotes.map((quote) => (
            <tr key={quote.id}>
              <td>{quote.quote_number}</td>
              <td>
                <Link to={`/devis/${quote.id}`}>{quote.title}</Link>
              </td>
              <td>{getStatusLabel(quote.status)}</td>
              <td>{quote.issue_date}</td>
              <td style={{ textAlign: "right" }}>
                {Number(quote.total_ttc).toFixed(2)} €
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </section>
  );
}