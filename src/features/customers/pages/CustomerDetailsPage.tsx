import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { LoadingBlock } from "../../../components/ui/LoadingBlock/LoadingBlock";
import { EmptyState } from "../../../components/ui/EmptyState/EmptyState";
import { ErrorMessage } from "../../../components/ui/ErrorMessage/ErrorMessage";
import { Button } from "../../../components/ui/Button/Button";
import { Card } from "../../../components/ui/Card/Card";
import { DataTable } from "../../../components/ui/DataTable/DataTable";
import { FormField } from "../../../components/ui/FormField/FormField";
import { FormGrid } from "../../../components/ui/FormGrid/FormGrid";
import { TextArea } from "../../../components/ui/TextArea/TextArea";
import { TextInput } from "../../../components/ui/TextInput/TextInput";
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
  created_at: string;
};

type QuoteStatus =
  | "draft"
  | "sent"
  | "accepted"
  | "rejected"
  | "expired"
  | "invoiced";

type CustomerQuote = {
  id: string;
  quote_number: string;
  title: string;
  status: QuoteStatus;
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

function createInitialForm(customer: CustomerDetails | null): CustomerFormState {
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

function getCustomerName(customer: CustomerDetails) {
  return (
    customer.company_name ||
    [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
    "Client sans nom"
  );
}

function getStatusLabel(status: QuoteStatus) {
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

function formatCurrency(value: number) {
  return `${Number(value || 0).toFixed(2)} €`;
}

function buildAddress(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(", ");
}

const customerPages = [
  { id: "quotes", label: "Devis" },
  { id: "info",   label: "Informations" },
] as const;

type CustomerPageId = (typeof customerPages)[number]["id"];

export function CustomerDetailsPage() {
  const { customerId } = useParams();
  const navigate = useNavigate();

  const [activePage, setActivePage] = useState<CustomerPageId>("quotes");
  const [topbarPortalTarget, setTopbarPortalTarget] = useState<Element | null>(null);

  const [customer, setCustomer] = useState<CustomerDetails | null>(null);
  const [quotes, setQuotes] = useState<CustomerQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerFormState>(createInitialForm(null));

  useEffect(() => {
    const topbar = document.querySelector(".app-topbar");
    setTopbarPortalTarget(topbar);
    topbar?.classList.add("app-topbar--with-quote-nav");
    return () => { topbar?.classList.remove("app-topbar--with-quote-nav"); };
  }, []);

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
          archived_at,
          created_at
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
    setQuotes((quotesRes.data ?? []) as CustomerQuote[]);
    setForm(createInitialForm(loadedCustomer));
    setLoading(false);
  }

  useEffect(() => {
    void loadCustomerPage();
  }, [customerId]);

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
    setForm(createInitialForm(customer));
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!customer) {
      setError("Client introuvable.");
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      company_name: form.company_name || null,
      first_name: form.first_name || null,
      last_name: form.last_name || null,
      email: form.email || null,
      phone: form.phone || null,

      billing_address_line1: form.billing_address_line1 || null,
      billing_address_line2: form.billing_address_line2 || null,
      billing_postal_code: form.billing_postal_code || null,
      billing_city: form.billing_city || null,
      billing_country: form.billing_country || null,

      jobsite_address_line1: form.jobsite_address_line1 || null,
      jobsite_address_line2: form.jobsite_address_line2 || null,
      jobsite_postal_code: form.jobsite_postal_code || null,
      jobsite_city: form.jobsite_city || null,
      jobsite_country: form.jobsite_country || null,

      notes: form.notes || null,
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

    setSaving(false);
    await loadCustomerPage();
  }

  async function handleArchiveCustomer() {
    if (!customer) {
      setError("Client introuvable.");
      return;
    }

    const confirmed = window.confirm("Archiver ce client ?");
    if (!confirmed) return;

    setArchiving(true);
    setError(null);

    const { error: updateError } = await supabase
      .from("customers")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", customer.id);

    if (updateError) {
      setError(updateError.message);
      setArchiving(false);
      return;
    }

    setArchiving(false);
    navigate("/clients");
  }

  const acceptedQuotesCount = quotes.filter((quote) => quote.status === "accepted").length;
  const totalPotentialSigned = useMemo(() => {
    return quotes
      .filter((quote) => quote.status === "accepted")
      .reduce((sum, quote) => sum + Number(quote.total_ttc || 0), 0);
  }, [quotes]);

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

  const billingAddress = buildAddress([
    customer.billing_address_line1,
    customer.billing_address_line2,
    customer.billing_postal_code,
    customer.billing_city,
    customer.billing_country,
  ]);

  const jobsiteAddress = buildAddress([
    customer.jobsite_address_line1,
    customer.jobsite_address_line2,
    customer.jobsite_postal_code,
    customer.jobsite_city,
    customer.jobsite_country,
  ]);

  const tabNav = (
    <nav className="quote-topbar-nav" aria-label="Pages du client">
      {customerPages.map((page) => (
        <button
          key={page.id}
          type="button"
          className={`quote-topbar-nav__tab${activePage === page.id ? " quote-topbar-nav__tab--active" : ""}`}
          onClick={() => setActivePage(page.id)}
        >
          {page.label}
        </button>
      ))}
    </nav>
  );

  const tabNavMobile = (
    <div className="quote-page-tabs-mobile" aria-label="Pages du client">
      {customerPages.map((page) => (
        <button
          key={page.id}
          type="button"
          className={`quote-topbar-nav__tab${activePage === page.id ? " quote-topbar-nav__tab--active" : ""}`}
          onClick={() => setActivePage(page.id)}
        >
          {page.label}
        </button>
      ))}
    </div>
  );

  return (
    <section className="customer-details-premium-page">
      {topbarPortalTarget ? createPortal(tabNav, topbarPortalTarget) : null}

      <header className="customer-details-premium-page__hero">
        <div className="customer-details-premium-page__hero-main">
          <div className="customer-details-premium-page__topline">
            <Link to="/clients" className="customer-details-premium-page__backlink">
              ← Retour aux clients
            </Link>
          </div>

          <p className="customer-details-premium-page__eyebrow">Fiche client</p>
          <h1 className="customer-details-premium-page__title">
            {getCustomerName(customer)}
          </h1>
          <p className="customer-details-premium-page__description">
            Consulte les coordonnées, mets à jour les informations principales
            et retrouve rapidement l'historique des devis associés.
          </p>
        </div>

        <div className="customer-details-premium-page__hero-actions">
          <Link to={`/?new=1&customerId=${customer.id}`}>
            <Button type="button">Créer un devis</Button>
          </Link>

          <Button
            type="button"
            variant="secondary"
            onClick={handleArchiveCustomer}
            disabled={archiving}
          >
            {archiving ? "Archivage..." : "Archiver"}
          </Button>
        </div>
      </header>

      {tabNavMobile}

      <div className="customer-details-premium-page__stats">
        <Card>
          <p className="customer-details-premium-page__stat-label">Devis liés</p>
          <p className="customer-details-premium-page__stat-value">{quotes.length}</p>
        </Card>

        <Card>
          <p className="customer-details-premium-page__stat-label">Devis acceptés</p>
          <p className="customer-details-premium-page__stat-value">
            {acceptedQuotesCount}
          </p>
        </Card>

        <Card>
          <p className="customer-details-premium-page__stat-label">
            Potentiel signé
          </p>
          <p className="customer-details-premium-page__stat-value">
            {formatCurrency(totalPotentialSigned)}
          </p>
        </Card>

        <Card>
          <p className="customer-details-premium-page__stat-label">Créé le</p>
          <p className="customer-details-premium-page__stat-value customer-details-premium-page__stat-value--date">
            {new Date(customer.created_at).toLocaleDateString("fr-BE")}
          </p>
        </Card>
      </div>

      {/* ── Onglet Devis ── */}
      {activePage === "quotes" && (
        <Card>
          <div className="customer-details-premium-page__section-header">
            <div>
              <p className="customer-details-premium-page__section-eyebrow">
                Historique
              </p>
              <h2 className="customer-details-premium-page__section-title">
                Devis liés
              </h2>
            </div>
          </div>

          {quotes.length === 0 ? (
            <EmptyState
              title="Aucun devis lié"
              description="Ce client ne possède encore aucun devis. Crée-en un pour démarrer son historique commercial."
            />
          ) : (
            <>
              {/* ── Tableau desktop ── */}
              <div className="customer-details-premium-page__table-shell">
                <DataTable
                  headers={
                    <tr>
                      <th>Numéro</th>
                      <th>Titre</th>
                      <th>Statut</th>
                      <th>Date</th>
                      <th style={{ textAlign: "right" }}>Total TTC</th>
                      <th style={{ textAlign: "right" }}>Action</th>
                    </tr>
                  }
                >
                  {quotes.map((quote) => (
                    <tr key={quote.id}>
                      <td>
                        <span className="customer-details-premium-page__quote-number">
                          {quote.quote_number}
                        </span>
                      </td>
                      <td>{quote.title}</td>
                      <td>{getStatusLabel(quote.status)}</td>
                      <td>{quote.issue_date}</td>
                      <td style={{ textAlign: "right" }}>
                        <strong>{formatCurrency(quote.total_ttc)}</strong>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <Link to={`/devis/${quote.id}`}>
                          <Button type="button" variant="secondary">
                            Ouvrir
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </DataTable>
              </div>

              {/* ── Vue cartes mobile ── */}
              <div className="customer-details-premium-page__quote-card-list">
                {quotes.map((quote) => (
                  <article
                    key={quote.id}
                    className="customer-details-premium-page__quote-card"
                  >
                    <div className="customer-details-premium-page__quote-card-header">
                      <div className="customer-details-premium-page__quote-card-main">
                        <span className="customer-details-premium-page__quote-number">
                          {quote.quote_number}
                        </span>
                        <Link
                          to={`/devis/${quote.id}`}
                          className="customer-details-premium-page__quote-card-title"
                        >
                          {quote.title}
                        </Link>
                      </div>
                      <span className="customer-details-premium-page__quote-card-total">
                        {formatCurrency(quote.total_ttc)}
                      </span>
                    </div>

                    <div className="customer-details-premium-page__quote-card-meta">
                      <span className="customer-details-premium-page__quote-card-date">
                        {quote.issue_date}
                      </span>
                      <span className="customer-details-premium-page__quote-card-status">
                        {getStatusLabel(quote.status)}
                      </span>
                    </div>

                    <div className="customer-details-premium-page__quote-card-actions">
                      <Link to={`/devis/${quote.id}`} style={{ flex: "1 1 auto" }}>
                        <Button
                          type="button"
                          variant="secondary"
                          style={{ width: "100%", justifyContent: "center" }}
                        >
                          Ouvrir
                        </Button>
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </Card>
      )}

      {/* ── Onglet Informations ── */}
      {activePage === "info" && (
        <div className="customer-details-premium-page__layout">
          <aside className="customer-details-premium-page__left">
            <Card>
              <div className="customer-details-premium-page__side-card">
                <p className="customer-details-premium-page__side-label">Résumé</p>

                <ul className="customer-details-premium-page__meta-list">
                  <li>
                    <span>Email</span>
                    <strong>{customer.email || "-"}</strong>
                  </li>
                  <li>
                    <span>Téléphone</span>
                    <strong>{customer.phone || "-"}</strong>
                  </li>
                  <li>
                    <span>Adresse facturation</span>
                    <strong>{billingAddress || "-"}</strong>
                  </li>
                  <li>
                    <span>Adresse chantier</span>
                    <strong>{jobsiteAddress || "-"}</strong>
                  </li>
                </ul>
              </div>
            </Card>
          </aside>

          <div className="customer-details-premium-page__center">
            <Card>
              <div className="customer-details-premium-page__section-header">
                <div>
                  <p className="customer-details-premium-page__section-eyebrow">
                    Informations
                  </p>
                  <h2 className="customer-details-premium-page__section-title">
                    Modifier la fiche client
                  </h2>
                </div>
              </div>

              <form
                className="customer-details-premium-page__form"
                onSubmit={handleSubmit}
              >
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

                <div className="customer-details-premium-page__address-block">
                  <h3 className="customer-details-premium-page__subsection-title">
                    Adresse de facturation
                  </h3>

                  <FormGrid columns="2">
                    <FormField label="Adresse ligne 1">
                      <TextInput
                        value={form.billing_address_line1}
                        onChange={(e) =>
                          updateField("billing_address_line1", e.target.value)
                        }
                      />
                    </FormField>

                    <FormField label="Adresse ligne 2">
                      <TextInput
                        value={form.billing_address_line2}
                        onChange={(e) =>
                          updateField("billing_address_line2", e.target.value)
                        }
                      />
                    </FormField>
                  </FormGrid>

                  <FormGrid columns="3">
                    <FormField label="Code postal">
                      <TextInput
                        value={form.billing_postal_code}
                        onChange={(e) =>
                          updateField("billing_postal_code", e.target.value)
                        }
                      />
                    </FormField>

                    <FormField label="Ville">
                      <TextInput
                        value={form.billing_city}
                        onChange={(e) => updateField("billing_city", e.target.value)}
                      />
                    </FormField>

                    <FormField label="Pays">
                      <TextInput
                        value={form.billing_country}
                        onChange={(e) =>
                          updateField("billing_country", e.target.value)
                        }
                      />
                    </FormField>
                  </FormGrid>
                </div>

                <div className="customer-details-premium-page__address-block">
                  <h3 className="customer-details-premium-page__subsection-title">
                    Adresse chantier
                  </h3>

                  <FormGrid columns="2">
                    <FormField label="Adresse ligne 1">
                      <TextInput
                        value={form.jobsite_address_line1}
                        onChange={(e) =>
                          updateField("jobsite_address_line1", e.target.value)
                        }
                      />
                    </FormField>

                    <FormField label="Adresse ligne 2">
                      <TextInput
                        value={form.jobsite_address_line2}
                        onChange={(e) =>
                          updateField("jobsite_address_line2", e.target.value)
                        }
                      />
                    </FormField>
                  </FormGrid>

                  <FormGrid columns="3">
                    <FormField label="Code postal">
                      <TextInput
                        value={form.jobsite_postal_code}
                        onChange={(e) =>
                          updateField("jobsite_postal_code", e.target.value)
                        }
                      />
                    </FormField>

                    <FormField label="Ville">
                      <TextInput
                        value={form.jobsite_city}
                        onChange={(e) => updateField("jobsite_city", e.target.value)}
                      />
                    </FormField>

                    <FormField label="Pays">
                      <TextInput
                        value={form.jobsite_country}
                        onChange={(e) =>
                          updateField("jobsite_country", e.target.value)
                        }
                      />
                    </FormField>
                  </FormGrid>
                </div>

                <FormField label="Notes">
                  <TextArea
                    rows={5}
                    value={form.notes}
                    onChange={(e) => updateField("notes", e.target.value)}
                  />
                </FormField>

                {error && <ErrorMessage message={error} />}

                <div className="customer-details-premium-page__form-actions">
                  <Button type="submit" disabled={saving}>
                    {saving ? "Enregistrement..." : "Enregistrer"}
                  </Button>

                  <Button type="button" variant="secondary" onClick={resetForm}>
                    Réinitialiser
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        </div>
      )}
    </section>
  );
}