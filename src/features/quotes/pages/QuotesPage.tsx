import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { LoadingBlock } from "../../../components/ui/LoadingBlock/LoadingBlock";
import { EmptyState } from "../../../components/ui/EmptyState/EmptyState";
import { ErrorMessage } from "../../../components/ui/ErrorMessage/ErrorMessage";
import { Button } from "../../../components/ui/Button/Button";
import { DataTable } from "../../../components/ui/DataTable/DataTable";
import { Card } from "../../../components/ui/Card/Card";
import { FormField } from "../../../components/ui/FormField/FormField";
import { TextInput } from "../../../components/ui/TextInput/TextInput";
import { TextArea } from "../../../components/ui/TextArea/TextArea";
import { Select } from "../../../components/ui/Select/Select";
import { FormGrid } from "../../../components/ui/FormGrid/FormGrid";
import "./QuotesPage.css";

type QuoteStatus =
  | "draft"
  | "sent"
  | "accepted"
  | "rejected"
  | "expired"
  | "invoiced";

type QuoteRow = {
  id: string;
  quote_number: string;
  title: string;
  status: QuoteStatus;
  total_ttc: number;
  issue_date: string;
};

type CustomerOption = {
  id: string;
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
};

type CompanyOption = {
  id: string;
  name: string;
  default_tva_rate: number;
  default_quote_validity_days: number | null;
  default_notes: string | null;
  default_terms: string | null;
};

type QuoteFormState = {
  company_id: string;
  customer_id: string;
  quote_number: string;
  title: string;
  description: string;
  issue_date: string;
  valid_until: string;
  tva_rate: string;
  notes: string;
  terms: string;
};

function formatDateForInput(date: Date) {
  return date.toISOString().split("T")[0];
}

function getDefaultValidUntil(validityDays = 30) {
  const date = new Date();
  date.setDate(date.getDate() + validityDays);
  return formatDateForInput(date);
}

function createInitialForm(
  companies: CompanyOption[] = [],
  presetCustomerId = ""
): QuoteFormState {
  const firstCompany = companies[0];

  return {
    company_id: firstCompany?.id || "",
    customer_id: presetCustomerId,
    quote_number: "",
    title: "",
    description: "",
    issue_date: formatDateForInput(new Date()),
    valid_until: getDefaultValidUntil(
      firstCompany?.default_quote_validity_days ?? 30
    ),
    tva_rate: String(firstCompany?.default_tva_rate ?? 21),
    notes: firstCompany?.default_notes ?? "",
    terms: firstCompany?.default_terms ?? "",
  };
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

export function QuotesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const presetCustomerId = searchParams.get("customerId") ?? "";
  const shouldOpenCreate = searchParams.get("new") === "1";

  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<QuoteFormState>(createInitialForm());
  const [saving, setSaving] = useState(false);
  const [duplicatingQuoteId, setDuplicatingQuoteId] = useState<string | null>(null);
  const [deletingQuoteId, setDeletingQuoteId] = useState<string | null>(null);
  const [updatingStatusQuoteId, setUpdatingStatusQuoteId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;

    async function fetchPageData() {
      const [quotesRes, customersRes, companiesRes] = await Promise.all([
        supabase
          .from("quotes")
          .select("id, quote_number, title, status, total_ttc, issue_date")
          .order("created_at", { ascending: false }),
        supabase
          .from("customers")
          .select("id, company_name, first_name, last_name")
          .is("archived_at", null)
          .order("created_at", { ascending: false }),
        supabase
          .from("companies")
          .select(
            "id, name, default_tva_rate, default_quote_validity_days, default_notes, default_terms"
          )
          .order("created_at", { ascending: false }),
      ]);

      if (cancelled) return;

      if (quotesRes.error) {
        setError(quotesRes.error.message);
        setLoading(false);
        return;
      }

      if (customersRes.error) {
        setError(customersRes.error.message);
        setLoading(false);
        return;
      }

      if (companiesRes.error) {
        setError(companiesRes.error.message);
        setLoading(false);
        return;
      }

      const loadedCompanies = companiesRes.data ?? [];
      const loadedCustomers = customersRes.data ?? [];

      setQuotes((quotesRes.data ?? []) as QuoteRow[]);
      setCustomers(loadedCustomers);
      setCompanies(loadedCompanies);
      setForm(createInitialForm(loadedCompanies, presetCustomerId));
      setShowForm(shouldOpenCreate);
      setError(null);
      setLoading(false);
    }

    void fetchPageData();

    return () => {
      cancelled = true;
    };
  }, [presetCustomerId, shouldOpenCreate]);

  async function reloadQuotesOnly() {
    const { data, error } = await supabase
      .from("quotes")
      .select("id, quote_number, title, status, total_ttc, issue_date")
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
      return;
    }

    setQuotes((data ?? []) as QuoteRow[]);
  }

  function updateField<K extends keyof QuoteFormState>(
    field: K,
    value: QuoteFormState[K]
  ) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function openCreateForm() {
    setForm(createInitialForm(companies, presetCustomerId));
    setError(null);
    setShowForm(true);
  }

  function closeCreateForm() {
    setShowForm(false);
    setError(null);
    if (searchParams.get("customerId") || searchParams.get("new")) {
      setSearchParams({}, { replace: true });
    }
  }

  function handleCompanyChange(companyId: string) {
    const selectedCompany = companies.find((company) => company.id === companyId);

    setForm((prev) => ({
      ...prev,
      company_id: companyId,
      tva_rate: selectedCompany
        ? String(selectedCompany.default_tva_rate)
        : prev.tva_rate,
      valid_until: selectedCompany
        ? getDefaultValidUntil(selectedCompany.default_quote_validity_days ?? 30)
        : prev.valid_until,
      notes: selectedCompany?.default_notes ?? "",
      terms: selectedCompany?.default_terms ?? "",
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setError("Utilisateur non connecté.");
      setSaving(false);
      return;
    }

    if (!form.company_id || !form.customer_id || !form.title) {
      setError("Merci de remplir les champs obligatoires du devis.");
      setSaving(false);
      return;
    }

    const { error: insertError } = await supabase.rpc("create_quote", {
      p_company_id: form.company_id,
      p_customer_id: form.customer_id,
      p_title: form.title,
      p_description: form.description || null,
      p_issue_date: form.issue_date,
      p_valid_until: form.valid_until || null,
      p_tva_rate: Number(form.tva_rate || 21),
      p_notes: form.notes || null,
      p_terms: form.terms || null,
    });

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    setForm(createInitialForm(companies));
    setShowForm(false);
    setSaving(false);
    if (searchParams.get("customerId") || searchParams.get("new")) {
      setSearchParams({}, { replace: true });
    }
    await reloadQuotesOnly();
  }

  async function handleDuplicateQuote(quoteId: string) {
    setDuplicatingQuoteId(quoteId);
    setError(null);

    const { error } = await supabase.rpc("duplicate_quote", {
      p_quote_id: quoteId,
    });

    if (error) {
      setError(error.message);
      setDuplicatingQuoteId(null);
      return;
    }

    setDuplicatingQuoteId(null);
    await reloadQuotesOnly();
  }

  async function handleDeleteQuote(quoteId: string) {
    const confirmed = window.confirm(
      "Supprimer ce devis ? Cette action supprimera aussi ses pièces et ses lignes."
    );

    if (!confirmed) return;

    setDeletingQuoteId(quoteId);
    setError(null);

    const { error } = await supabase.from("quotes").delete().eq("id", quoteId);

    if (error) {
      setError(error.message);
      setDeletingQuoteId(null);
      return;
    }

    setDeletingQuoteId(null);
    await reloadQuotesOnly();
  }

  async function handleStatusChange(quoteId: string, status: QuoteStatus) {
    setUpdatingStatusQuoteId(quoteId);
    setError(null);

    const { error } = await supabase
      .from("quotes")
      .update({ status })
      .eq("id", quoteId);

    if (error) {
      setError(error.message);
      setUpdatingStatusQuoteId(null);
      return;
    }

    setQuotes((prev) =>
      prev.map((quote) =>
        quote.id === quoteId ? { ...quote, status } : quote
      )
    );
    setUpdatingStatusQuoteId(null);
  }

  function getCustomerLabel(customer: CustomerOption) {
    return (
      customer.company_name ||
      [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
      "Sans nom"
    );
  }

  const filteredQuotes = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return quotes.filter((quote) => {
      const matchesSearch =
        !normalizedSearch ||
        quote.quote_number.toLowerCase().includes(normalizedSearch) ||
        quote.title.toLowerCase().includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "all" || quote.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [quotes, search, statusFilter]);

  const totalQuotes = quotes.length;
  const draftCount = quotes.filter((quote) => quote.status === "draft").length;
  const acceptedCount = quotes.filter((quote) => quote.status === "accepted").length;
  const totalPortfolio = quotes.reduce(
    (sum, quote) => sum + Number(quote.total_ttc || 0),
    0
  );

  if (loading) {
    return <LoadingBlock message="Chargement des devis..." />;
  }

  return (
    <section className="quotes-premium-page">
      <header className="quotes-premium-page__hero">
        <div className="quotes-premium-page__hero-main">
          <p className="quotes-premium-page__eyebrow">Pilotage commercial</p>
          <h1 className="quotes-premium-page__title">Devis</h1>
          <p className="quotes-premium-page__description">
            Crée, filtre et pilote tes devis dans une interface plus claire,
            plus rapide et plus agréable sur desktop comme sur mobile.
          </p>
        </div>

        <div className="quotes-premium-page__hero-actions">
          <Button
            variant="primary"
            onClick={showForm ? closeCreateForm : openCreateForm}
          >
            {showForm ? "Fermer le formulaire" : "Nouveau devis"}
          </Button>
        </div>
      </header>

      <div className="quotes-premium-page__stats">
        <Card className="quotes-premium-page__stat-card">
          <p className="quotes-premium-page__stat-label">Nombre de devis</p>
          <p className="quotes-premium-page__stat-value">{totalQuotes}</p>
        </Card>

        <Card className="quotes-premium-page__stat-card">
          <p className="quotes-premium-page__stat-label">Brouillons</p>
          <p className="quotes-premium-page__stat-value">{draftCount}</p>
        </Card>

        <Card className="quotes-premium-page__stat-card">
          <p className="quotes-premium-page__stat-label">Acceptés</p>
          <p className="quotes-premium-page__stat-value">{acceptedCount}</p>
        </Card>

        <Card className="quotes-premium-page__stat-card">
          <p className="quotes-premium-page__stat-label">Montant cumulé TTC</p>
          <p className="quotes-premium-page__stat-value quotes-premium-page__stat-value--highlight">
            {formatCurrency(totalPortfolio)}
          </p>
        </Card>
      </div>

      {showForm ? (
        <Card className="quotes-premium-page__form-card">
          <div className="quotes-premium-page__form-intro">
            <div>
              <p className="quotes-premium-page__section-eyebrow">Création</p>
              <h2 className="quotes-premium-page__section-title">Créer un devis</h2>
              <p className="quotes-premium-page__section-description">
                Sélectionne l’entreprise, le client, puis prépare les informations
                générales du document.
              </p>
            </div>
          </div>

          <form className="quotes-premium-page__form" onSubmit={handleSubmit}>
            <FormGrid columns="2">
              <FormField label="Entreprise">
                <Select
                  value={form.company_id}
                  onChange={(e) => handleCompanyChange(e.target.value)}
                >
                  <option value="">Sélectionner une entreprise</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Client">
                <Select
                  value={form.customer_id}
                  onChange={(e) => updateField("customer_id", e.target.value)}
                >
                  <option value="">Sélectionner un client</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {getCustomerLabel(customer)}
                    </option>
                  ))}
                </Select>
              </FormField>
            </FormGrid>

            <FormGrid columns="2">
              <FormField label="Numéro de devis">
                <TextInput
                  value={form.quote_number}
                  placeholder="Généré automatiquement à l’enregistrement"
                  readOnly
                />
              </FormField>

              <FormField label="Titre">
                <TextInput
                  value={form.title}
                  onChange={(e) => updateField("title", e.target.value)}
                  placeholder="Peinture intérieure maison"
                />
              </FormField>
            </FormGrid>

            <FormField label="Description">
              <TextArea
                rows={3}
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
              />
            </FormField>

            <FormGrid columns="2">
              <FormField label="Date du devis">
                <TextInput
                  type="date"
                  value={form.issue_date}
                  onChange={(e) => updateField("issue_date", e.target.value)}
                />
              </FormField>

              <FormField label="Valable jusqu'au">
                <TextInput
                  type="date"
                  value={form.valid_until}
                  onChange={(e) => updateField("valid_until", e.target.value)}
                />
              </FormField>
            </FormGrid>

            <FormGrid columns="2">
              <FormField label="TVA (%)">
                <TextInput
                  type="number"
                  step="0.01"
                  value={form.tva_rate}
                  onChange={(e) => updateField("tva_rate", e.target.value)}
                />
              </FormField>

              <div />
            </FormGrid>

            <FormField label="Notes">
              <TextArea
                rows={3}
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
              />
            </FormField>

            <FormField label="Conditions">
              <TextArea
                rows={4}
                value={form.terms}
                onChange={(e) => updateField("terms", e.target.value)}
              />
            </FormField>

            {error ? <ErrorMessage message={error} /> : null}

            <div className="quotes-premium-page__form-actions">
              <Button type="submit" disabled={saving}>
                {saving ? "Enregistrement..." : "Créer le devis"}
              </Button>

              <Button type="button" variant="secondary" onClick={closeCreateForm}>
                Annuler
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <Card className="quotes-premium-page__filters-card">
          <div className="quotes-premium-page__filters">
            <div className="quotes-premium-page__filters-intro">
              <p className="quotes-premium-page__section-eyebrow">Liste</p>
              <h2 className="quotes-premium-page__section-title">Tous les devis</h2>
              <p className="quotes-premium-page__section-description">
                Recherche rapidement un devis par numéro ou titre et filtre son statut.
              </p>
            </div>

            <div className="quotes-premium-page__filters-grid">
              <FormField label="Recherche">
                <TextInput
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Numéro ou titre du devis"
                />
              </FormField>

              <FormField label="Statut">
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">Tous les statuts</option>
                  <option value="draft">{getStatusLabel("draft")}</option>
                  <option value="sent">{getStatusLabel("sent")}</option>
                  <option value="accepted">{getStatusLabel("accepted")}</option>
                  <option value="rejected">{getStatusLabel("rejected")}</option>
                  <option value="expired">{getStatusLabel("expired")}</option>
                  <option value="invoiced">{getStatusLabel("invoiced")}</option>
                </Select>
              </FormField>
            </div>
          </div>
        </Card>
      )}

      {error && !showForm ? <ErrorMessage message={error} /> : null}

      {!showForm && filteredQuotes.length === 0 ? (
        <EmptyState
          title="Aucun devis"
          description={
            quotes.length === 0
              ? "Crée ton premier devis pour démarrer ton activité commerciale."
              : "Aucun devis ne correspond aux filtres actuellement sélectionnés."
          }
        />
      ) : null}

      {!showForm && filteredQuotes.length > 0 ? (
        <>
          {/* ── Tableau desktop ── */}
          <div className="quotes-premium-page__table-shell">
            <DataTable
              headers={
                <tr>
                  <th>Numéro</th>
                  <th>Titre</th>
                  <th>Statut</th>
                  <th>Date</th>
                  <th style={{ textAlign: "right" }}>Total TTC</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              }
            >
              {filteredQuotes.map((quote) => (
                <tr key={quote.id}>
                  <td>
                    <span className="quotes-premium-page__quote-number">
                      {quote.quote_number}
                    </span>
                  </td>

                  <td>
                    <Link
                      to={`/devis/${quote.id}`}
                      className="quotes-premium-page__quote-link"
                    >
                      {quote.title}
                    </Link>
                  </td>

                  <td>
                    <Select
                      value={quote.status}
                      onChange={(e) =>
                        handleStatusChange(quote.id, e.target.value as QuoteStatus)
                      }
                      disabled={
                        updatingStatusQuoteId === quote.id ||
                        duplicatingQuoteId === quote.id ||
                        deletingQuoteId === quote.id
                      }
                    >
                      <option value="draft">{getStatusLabel("draft")}</option>
                      <option value="sent">{getStatusLabel("sent")}</option>
                      <option value="accepted">{getStatusLabel("accepted")}</option>
                      <option value="rejected">{getStatusLabel("rejected")}</option>
                      <option value="expired">{getStatusLabel("expired")}</option>
                      <option value="invoiced">{getStatusLabel("invoiced")}</option>
                    </Select>
                  </td>

                  <td>{quote.issue_date}</td>

                  <td style={{ textAlign: "right" }}>
                    <strong>{formatCurrency(quote.total_ttc)}</strong>
                  </td>

                  <td style={{ textAlign: "right" }}>
                    <div className="quotes-premium-page__row-actions">
                      <Link to={`/devis/${quote.id}`} className="quotes-premium-page__row-link">
                        <Button type="button" variant="secondary">
                          Ouvrir
                        </Button>
                      </Link>

                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => handleDuplicateQuote(quote.id)}
                        disabled={
                          duplicatingQuoteId === quote.id ||
                          deletingQuoteId === quote.id ||
                          updatingStatusQuoteId === quote.id
                        }
                      >
                        {duplicatingQuoteId === quote.id ? "Duplication..." : "Dupliquer"}
                      </Button>

                      <Button
                        type="button"
                        variant="danger"
                        onClick={() => handleDeleteQuote(quote.id)}
                        disabled={
                          deletingQuoteId === quote.id ||
                          duplicatingQuoteId === quote.id ||
                          updatingStatusQuoteId === quote.id
                        }
                      >
                        {deletingQuoteId === quote.id ? "Suppression..." : "Supprimer"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </DataTable>
          </div>

          {/* ── Vue cartes mobile ── */}
          <div className="quotes-premium-page__card-list">
            {filteredQuotes.map((quote) => (
              <article key={quote.id} className="quotes-premium-page__quote-card">
                <div className="quotes-premium-page__quote-card-header">
                  <div className="quotes-premium-page__quote-card-main">
                    <span className="quotes-premium-page__quote-number">
                      {quote.quote_number}
                    </span>
                    <Link
                      to={`/devis/${quote.id}`}
                      className="quotes-premium-page__quote-card-title"
                    >
                      {quote.title}
                    </Link>
                  </div>
                  <span className="quotes-premium-page__quote-card-total">
                    {formatCurrency(quote.total_ttc)}
                  </span>
                </div>

                <div className="quotes-premium-page__quote-card-meta">
                  <span className="quotes-premium-page__quote-card-date">
                    {quote.issue_date}
                  </span>
                  <div className="quotes-premium-page__quote-card-status">
                    <Select
                      value={quote.status}
                      onChange={(e) =>
                        handleStatusChange(quote.id, e.target.value as QuoteStatus)
                      }
                      disabled={
                        updatingStatusQuoteId === quote.id ||
                        duplicatingQuoteId === quote.id ||
                        deletingQuoteId === quote.id
                      }
                    >
                      <option value="draft">{getStatusLabel("draft")}</option>
                      <option value="sent">{getStatusLabel("sent")}</option>
                      <option value="accepted">{getStatusLabel("accepted")}</option>
                      <option value="rejected">{getStatusLabel("rejected")}</option>
                      <option value="expired">{getStatusLabel("expired")}</option>
                      <option value="invoiced">{getStatusLabel("invoiced")}</option>
                    </Select>
                  </div>
                </div>

                <div className="quotes-premium-page__quote-card-actions">
                  <Link to={`/devis/${quote.id}`} className="quotes-premium-page__row-link" style={{ flex: "1 1 auto" }}>
                    <Button type="button" variant="secondary" style={{ width: "100%", justifyContent: "center" }}>
                      Ouvrir
                    </Button>
                  </Link>

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => handleDuplicateQuote(quote.id)}
                    disabled={
                      duplicatingQuoteId === quote.id ||
                      deletingQuoteId === quote.id ||
                      updatingStatusQuoteId === quote.id
                    }
                  >
                    {duplicatingQuoteId === quote.id ? "Duplication..." : "Dupliquer"}
                  </Button>

                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => handleDeleteQuote(quote.id)}
                    disabled={
                      deletingQuoteId === quote.id ||
                      duplicatingQuoteId === quote.id ||
                      updatingStatusQuoteId === quote.id
                    }
                  >
                    {deletingQuoteId === quote.id ? "Suppression..." : "Supprimer"}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}