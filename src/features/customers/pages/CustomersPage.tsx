import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { LoadingBlock } from "../../../components/ui/LoadingBlock/LoadingBlock";
import { EmptyState } from "../../../components/ui/EmptyState/EmptyState";
import { ErrorMessage } from "../../../components/ui/ErrorMessage/ErrorMessage";
import { PageHeader } from "../../../components/ui/PageHeader/PageHeader";
import { Button } from "../../../components/ui/Button/Button";
import { Card } from "../../../components/ui/Card/Card";
import { FormField } from "../../../components/ui/FormField/FormField";
import { FormGrid } from "../../../components/ui/FormGrid/FormGrid";
import { TextInput } from "../../../components/ui/TextInput/TextInput";
import { TextArea } from "../../../components/ui/TextArea/TextArea";
import { DataTable } from "../../../components/ui/DataTable/DataTable";
import { Select } from "../../../components/ui/Select/Select";
import "./CustomersPage.css";

type CustomerRow = {
  id: string;
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  billing_city: string | null;
  created_at: string;
  archived_at: string | null;
};

type QuoteCustomerRef = {
  customer_id: string;
};

type CustomerFormState = {
  company_name: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  billing_address_line1: string;
  billing_postal_code: string;
  billing_city: string;
  notes: string;
};

type CustomerSortField = "name" | "city" | "created_at";
type SortDirection = "asc" | "desc";
type QuotesFilter = "all" | "with_quotes" | "without_quotes";

const initialForm: CustomerFormState = {
  company_name: "",
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  billing_address_line1: "",
  billing_postal_code: "",
  billing_city: "",
  notes: "",
};

function getCustomerName(customer: CustomerRow) {
  return (
    customer.company_name ||
    [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
    "Sans nom"
  );
}

export function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [quoteCountByCustomerId, setQuoteCountByCustomerId] = useState<
    Record<string, number>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CustomerFormState>(initialForm);
  const [saving, setSaving] = useState(false);
  const [archivingCustomerId, setArchivingCustomerId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<CustomerSortField>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [quotesFilter, setQuotesFilter] = useState<QuotesFilter>("all");

  async function loadCustomers() {
    setLoading(true);
    setError(null);

    const [customersRes, quotesRes] = await Promise.all([
      supabase
        .from("customers")
        .select(
          "id, company_name, first_name, last_name, email, phone, billing_city, created_at, archived_at"
        )
        .is("archived_at", null)
        .order("created_at", { ascending: false }),
      supabase.from("quotes").select("customer_id"),
    ]);

    if (customersRes.error) {
      setError(customersRes.error.message);
      setLoading(false);
      return;
    }

    if (quotesRes.error) {
      setError(quotesRes.error.message);
      setLoading(false);
      return;
    }

    const counts: Record<string, number> = {};
    ((quotesRes.data ?? []) as QuoteCustomerRef[]).forEach((quote) => {
      counts[quote.customer_id] = (counts[quote.customer_id] ?? 0) + 1;
    });

    setCustomers((customersRes.data ?? []) as CustomerRow[]);
    setQuoteCountByCustomerId(counts);
    setLoading(false);
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  const filteredCustomers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    const filtered = customers.filter((customer) => {
      const quoteCount = quoteCountByCustomerId[customer.id] ?? 0;

      if (quotesFilter === "with_quotes" && quoteCount === 0) {
        return false;
      }

      if (quotesFilter === "without_quotes" && quoteCount > 0) {
        return false;
      }

      if (!normalizedSearch) return true;

      const haystack = [
        customer.company_name,
        customer.first_name,
        customer.last_name,
        customer.email,
        customer.phone,
        customer.billing_city,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });

    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;

      if (sortField === "name") {
        comparison = getCustomerName(a).localeCompare(getCustomerName(b), "fr", {
          sensitivity: "base",
        });
      } else if (sortField === "city") {
        comparison = (a.billing_city || "").localeCompare(b.billing_city || "", "fr", {
          sensitivity: "base",
        });
      } else {
        comparison =
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [customers, quoteCountByCustomerId, search, sortField, sortDirection, quotesFilter]);

  function updateField<K extends keyof CustomerFormState>(
    field: K,
    value: CustomerFormState[K]
  ) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
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

    const payload = {
      owner_user_id: user.id,
      company_name: form.company_name || null,
      first_name: form.first_name || null,
      last_name: form.last_name || null,
      email: form.email || null,
      phone: form.phone || null,
      billing_address_line1: form.billing_address_line1 || null,
      billing_postal_code: form.billing_postal_code || null,
      billing_city: form.billing_city || null,
      billing_country: "Belgique",
      jobsite_address_line1: form.billing_address_line1 || null,
      jobsite_postal_code: form.billing_postal_code || null,
      jobsite_city: form.billing_city || null,
      jobsite_country: "Belgique",
      notes: form.notes || null,
      archived_at: null,
    };

    const { error: insertError } = await supabase.from("customers").insert(payload);

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    setForm(initialForm);
    setShowForm(false);
    setSaving(false);
    await loadCustomers();
  }

  async function handleArchiveCustomer(customer: CustomerRow) {
    const confirmed = window.confirm("Archiver ce client ?");
    if (!confirmed) return;

    setArchivingCustomerId(customer.id);
    setError(null);

    const { error: updateError } = await supabase
      .from("customers")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", customer.id);

    if (updateError) {
      setError(updateError.message);
      setArchivingCustomerId(null);
      return;
    }

    setArchivingCustomerId(null);
    await loadCustomers();
  }

  if (loading) {
    return <LoadingBlock message="Chargement des clients..." />;
  }

  return (
    <section>
      <PageHeader
        title="Clients"
        description="Liste des clients actifs."
        actions={
          <div className="customers-page__actions">
            <Link to="/clients/archives">
              <Button type="button" variant="secondary">
                Clients archivés
              </Button>
            </Link>

            <Button variant="secondary" onClick={() => setShowForm((prev) => !prev)}>
              {showForm ? "Fermer" : "Nouveau client"}
            </Button>
          </div>
        }
      />

      {showForm && (
        <Card>
          <form className="customers-page__form" onSubmit={handleSubmit}>
            <h2 className="customers-page__form-title">Créer un client</h2>

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

            <div className="customers-page__grid customers-page__grid--2">
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
            </div>

            <div className="customers-page__grid customers-page__grid--2">
              <FormField label="Téléphone">
                <TextInput
                  value={form.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                />
              </FormField>

              <FormField label="Ville">
                <TextInput
                  value={form.billing_city}
                  onChange={(e) => updateField("billing_city", e.target.value)}
                />
              </FormField>
            </div>

            <FormGrid columns="3-1">
              <FormField label="Adresse">
                <TextInput
                  value={form.billing_address_line1}
                  onChange={(e) =>
                    updateField("billing_address_line1", e.target.value)
                  }
                />
              </FormField>

              <FormField label="Code postal">
                <TextInput
                  value={form.billing_postal_code}
                  onChange={(e) => updateField("billing_postal_code", e.target.value)}
                />
              </FormField>
            </FormGrid>

            <FormField label="Notes">
              <TextArea
                rows={4}
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
              />
            </FormField>

            {error && <ErrorMessage message={error} />}

            <div className="customers-page__actions">
              <Button type="submit" disabled={saving}>
                {saving ? "Enregistrement..." : "Enregistrer le client"}
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowForm(false);
                  setForm(initialForm);
                  setError(null);
                }}
              >
                Annuler
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <div className="customers-page__toolbar">
          <FormField label="Rechercher un client">
            <TextInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nom, société, email, téléphone, ville..."
            />
          </FormField>

          <div className="customers-page__toolbar-grid customers-page__toolbar-grid--3">
            <FormField label="Avec devis">
              <Select
                value={quotesFilter}
                onChange={(e) => setQuotesFilter(e.target.value as QuotesFilter)}
              >
                <option value="all">Tous</option>
                <option value="with_quotes">Avec devis</option>
                <option value="without_quotes">Sans devis</option>
              </Select>
            </FormField>

            <FormField label="Trier par">
              <Select
                value={sortField}
                onChange={(e) => setSortField(e.target.value as CustomerSortField)}
              >
                <option value="created_at">Date de création</option>
                <option value="name">Nom</option>
                <option value="city">Ville</option>
              </Select>
            </FormField>

            <FormField label="Ordre">
              <Select
                value={sortDirection}
                onChange={(e) => setSortDirection(e.target.value as SortDirection)}
              >
                <option value="asc">Croissant</option>
                <option value="desc">Décroissant</option>
              </Select>
            </FormField>
          </div>
        </div>
      </Card>

      {error && !showForm && <ErrorMessage message={error} />}

      {filteredCustomers.length === 0 ? (
        <EmptyState
          title={customers.length === 0 ? "Aucun client" : "Aucun résultat"}
          description={
            customers.length === 0
              ? "Crée ton premier client avec le bouton ci-dessus."
              : "Aucun client ne correspond à tes filtres."
          }
        />
      ) : (
        <DataTable
          headers={
            <tr>
              <th>Nom</th>
              <th>Email</th>
              <th>Téléphone</th>
              <th>Ville</th>
              <th>Devis</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          }
        >
          {filteredCustomers.map((customer) => {
            const name = getCustomerName(customer);
            const quoteCount = quoteCountByCustomerId[customer.id] ?? 0;

            return (
              <tr key={customer.id}>
                <td>
                  <Link to={`/clients/${customer.id}`}>{name}</Link>
                </td>
                <td>{customer.email || "-"}</td>
                <td>{customer.phone || "-"}</td>
                <td>{customer.billing_city || "-"}</td>
                <td>{quoteCount}</td>
                <td style={{ textAlign: "right" }}>
                  <div
                    style={{
                      display: "inline-flex",
                      gap: "8px",
                      justifyContent: "flex-end",
                    }}
                  >
                    <Link to={`/?new=1&customerId=${customer.id}`}>
                      <Button type="button" variant="secondary">
                        Nouveau devis
                      </Button>
                    </Link>

                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => handleArchiveCustomer(customer)}
                      disabled={archivingCustomerId === customer.id}
                    >
                      {archivingCustomerId === customer.id ? "Archivage..." : "Archiver"}
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </DataTable>
      )}
    </section>
  );
}