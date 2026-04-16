import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { LoadingBlock } from "../../../components/ui/LoadingBlock/LoadingBlock";
import { EmptyState } from "../../../components/ui/EmptyState/EmptyState";
import { ErrorMessage } from "../../../components/ui/ErrorMessage/ErrorMessage";
import { PageHeader } from "../../../components/ui/PageHeader/PageHeader";
import { Button } from "../../../components/ui/Button/Button";
import { Card } from "../../../components/ui/Card/Card";
import { DataTable } from "../../../components/ui/DataTable/DataTable";
import { FormField } from "../../../components/ui/FormField/FormField";
import { TextInput } from "../../../components/ui/TextInput/TextInput";
import "./ArchivedCustomersPage.css";

type ArchivedCustomerRow = {
  id: string;
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  billing_city: string | null;
  archived_at: string | null;
};

function getCustomerName(customer: ArchivedCustomerRow) {
  return (
    customer.company_name ||
    [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
    "Sans nom"
  );
}

export function ArchivedCustomersPage() {
  const [customers, setCustomers] = useState<ArchivedCustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [restoringCustomerId, setRestoringCustomerId] = useState<string | null>(null);

  async function loadArchivedCustomers() {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("customers")
      .select(
        "id, company_name, first_name, last_name, email, phone, billing_city, archived_at"
      )
      .not("archived_at", "is", null)
      .order("archived_at", { ascending: false });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setCustomers((data ?? []) as ArchivedCustomerRow[]);
    setLoading(false);
  }

  useEffect(() => {
    loadArchivedCustomers();
  }, []);

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

  async function handleRestoreCustomer(customerId: string) {
    const confirmed = window.confirm("Restaurer ce client ?");
    if (!confirmed) return;

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

  if (loading) {
    return <LoadingBlock message="Chargement des clients archivés..." />;
  }

  return (
    <section>
      <PageHeader
        title="Clients archivés"
        description="Liste des clients archivés avec possibilité de restauration."
        actions={
          <Link to="/clients">
            <Button type="button" variant="secondary">
              Retour aux clients
            </Button>
          </Link>
        }
      />

      <Card>
        <div className="archived-customers-page__toolbar">
          <FormField label="Rechercher un client archivé">
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
          title={customers.length === 0 ? "Aucun client archivé" : "Aucun résultat"}
          description={
            customers.length === 0
              ? "Aucun client n'est archivé pour le moment."
              : "Aucun client archivé ne correspond à ta recherche."
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
              <th>Date archivage</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          }
        >
          {filteredCustomers.map((customer) => (
            <tr key={customer.id}>
              <td>
                <Link to={`/clients/${customer.id}`}>{getCustomerName(customer)}</Link>
              </td>
              <td>{customer.email || "-"}</td>
              <td>{customer.phone || "-"}</td>
              <td>{customer.billing_city || "-"}</td>
              <td>
                {customer.archived_at
                  ? new Date(customer.archived_at).toLocaleDateString("fr-BE")
                  : "-"}
              </td>
              <td style={{ textAlign: "right" }}>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => handleRestoreCustomer(customer.id)}
                  disabled={restoringCustomerId === customer.id}
                >
                  {restoringCustomerId === customer.id ? "Restauration..." : "Restaurer"}
                </Button>
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </section>
  );
}