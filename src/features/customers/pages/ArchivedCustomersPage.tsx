import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { LoadingBlock } from "../../../components/ui/LoadingBlock/LoadingBlock";
import { EmptyState } from "../../../components/ui/EmptyState/EmptyState";
import { ErrorMessage } from "../../../components/ui/ErrorMessage/ErrorMessage";
import { Button } from "../../../components/ui/Button/Button";
import { Card } from "../../../components/ui/Card/Card";
import { DataTable } from "../../../components/ui/DataTable/DataTable";
import { FormField } from "../../../components/ui/FormField/FormField";
import { TextInput } from "../../../components/ui/TextInput/TextInput";
import { RestoreIcon } from "../../../components/ui/Icons/AppIcons";
import { formatDisplayDate } from "../../../lib/formatters";
import "./ArchivedCustomersPage.css";

type ArchivedCustomer = {
  id: string;
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  billing_city: string | null;
  archived_at: string | null;
};

function getCustomerName(customer: ArchivedCustomer) {
  return (
    customer.company_name ||
    [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
    "Sans nom"
  );
}

export function ArchivedCustomersPage() {
  const [customers, setCustomers] = useState<ArchivedCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringCustomerId, setRestoringCustomerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const loadArchivedCustomers = useCallback(async function loadArchivedCustomers() {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("customers")
      .select("id, company_name, first_name, last_name, email, phone, archived_at")
      .not("archived_at", "is", null)
      .order("archived_at", { ascending: false });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    const customerIds = (data ?? []).map((c) => c.id);
    const cityByCustomerId: Record<string, string | null> = {};
    if (customerIds.length > 0) {
      const { data: addrData } = await supabase
        .from("addresses")
        .select("entity_id, city")
        .in("entity_id", customerIds)
        .eq("entity_type", "customer")
        .eq("role", "billing");

      for (const addr of addrData ?? []) {
        cityByCustomerId[addr.entity_id] = addr.city;
      }
    }

    const customersWithCity: ArchivedCustomer[] = (data ?? []).map((c) => ({
      ...c,
      billing_city: cityByCustomerId[c.id] ?? null,
    }));

    setCustomers(customersWithCity);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadArchivedCustomers();
  }, [loadArchivedCustomers]);

  async function handleRestore(customerId: string) {
    setRestoringCustomerId(customerId);
    setError(null);

    const { error } = await supabase
      .from("customers")
      .update({ archived_at: null })
      .eq("id", customerId);

    if (error) {
      setError(error.message);
      setRestoringCustomerId(null);
      return;
    }

    setRestoringCustomerId(null);
    await loadArchivedCustomers();
  }

  const filteredCustomers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return customers.filter((customer) => {
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
  }, [customers, search]);

  if (loading) {
    return <LoadingBlock message="Chargement des clients archivés..." />;
  }

  return (
    <section className="archived-customers-premium-page">
      <header className="archived-customers-premium-page__hero">
        <div className="archived-customers-premium-page__hero-main">
          <p className="archived-customers-premium-page__eyebrow">Archives</p>
          <h1 className="archived-customers-premium-page__title">
            Clients archivés
          </h1>
        </div>

        <div className="archived-customers-premium-page__hero-actions">
          <Link to="/clients">
            <Button variant="secondary">Retour aux clients</Button>
          </Link>
        </div>
      </header>

      <Card>
        <div className="archived-customers-premium-page__filters">
          <FormField label="Recherche">
            <TextInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nom, société, email, téléphone, ville..."
            />
          </FormField>
        </div>
      </Card>

      {error && <ErrorMessage message={error} />}

      {filteredCustomers.length === 0 ? (
        <EmptyState
          title={customers.length === 0 ? "Aucune archive" : "Aucun résultat"}
          description={
            customers.length === 0
              ? "Aucun client archivé pour le moment."
              : "Aucun client archivé ne correspond à la recherche."
          }
        />
      ) : (
        <>
          <div className="archived-customers-premium-page__table-shell">
            <DataTable
            headers={
              <tr>
                <th>Nom</th>
                <th>Email</th>
                <th>Téléphone</th>
                <th>Ville</th>
                <th>Date d’archivage</th>
                <th style={{ textAlign: "right" }}>Action</th>
              </tr>
            }
          >
            {filteredCustomers.map((customer) => (
              <tr key={customer.id}>
                <td>{getCustomerName(customer)}</td>
                <td>{customer.email || "-"}</td>
                <td>{customer.phone || "-"}</td>
                <td>{customer.billing_city || "-"}</td>
                <td>
                  {formatDisplayDate(customer.archived_at)}
                </td>
                <td style={{ textAlign: "right" }}>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => handleRestore(customer.id)}
                    disabled={restoringCustomerId === customer.id}
                  >
                    <RestoreIcon />
                    {restoringCustomerId === customer.id
                      ? "Restauration..."
                      : "Restaurer"}
                  </Button>
                </td>
              </tr>
            ))}
            </DataTable>
          </div>

          <div className="archived-customers-premium-page__card-list">
            {filteredCustomers.map((customer) => (
              <article
                key={customer.id}
                className="archived-customers-premium-page__customer-card"
              >
                <div className="archived-customers-premium-page__customer-card-header">
                  <div>
                    <h2 className="archived-customers-premium-page__customer-card-name">
                      {getCustomerName(customer)}
                    </h2>
                    <p className="archived-customers-premium-page__customer-card-date">
                      Archivé le {formatDisplayDate(customer.archived_at)}
                    </p>
                  </div>
                  {customer.billing_city ? (
                    <span className="archived-customers-premium-page__city-chip">
                      {customer.billing_city}
                    </span>
                  ) : null}
                </div>

                <div className="archived-customers-premium-page__customer-card-contact">
                  {customer.email ? <span>{customer.email}</span> : null}
                  {customer.phone ? <span>{customer.phone}</span> : null}
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => handleRestore(customer.id)}
                  disabled={restoringCustomerId === customer.id}
                >
                  <RestoreIcon />
                  {restoringCustomerId === customer.id
                    ? "Restauration..."
                    : "Restaurer"}
                </Button>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
