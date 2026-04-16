import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { PageHeader } from "../../../components/ui/PageHeader/PageHeader";
import { LoadingBlock } from "../../../components/ui/LoadingBlock/LoadingBlock";
import { ErrorMessage } from "../../../components/ui/ErrorMessage/ErrorMessage";
import { EmptyState } from "../../../components/ui/EmptyState/EmptyState";
import { SectionCard } from "../../../components/ui/SectionCard/SectionCard";
import { DataTable } from "../../../components/ui/DataTable/DataTable";
import { Button } from "../../../components/ui/Button/Button";
import { FormField } from "../../../components/ui/FormField/FormField";
import { FormGrid } from "../../../components/ui/FormGrid/FormGrid";
import { TextInput } from "../../../components/ui/TextInput/TextInput";
import { Select } from "../../../components/ui/Select/Select";

type InvoiceStatus =
  | "draft"
  | "issued"
  | "sent"
  | "partially_paid"
  | "paid"
  | "cancelled"
  | "credited";

type InvoiceType = "invoice" | "deposit" | "final" | "credit_note";

type InvoiceListItem = {
  id: string;
  invoice_number: string;
  invoice_type: InvoiceType;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string | null;
  total_ttc: number;
  amount_paid: number;
  balance_due: number;
  customer_company_name_snapshot: string | null;
  customer_first_name_snapshot: string | null;
  customer_last_name_snapshot: string | null;
  source_quote_id: string | null;
};

function getInvoiceStatusLabel(status: InvoiceStatus) {
  switch (status) {
    case "draft":
      return "Brouillon";
    case "issued":
      return "Émise";
    case "sent":
      return "Envoyée";
    case "partially_paid":
      return "Partiellement payée";
    case "paid":
      return "Payée";
    case "cancelled":
      return "Annulée";
    case "credited":
      return "Avoirée";
    default:
      return status;
  }
}

function getInvoiceTypeLabel(type: InvoiceType) {
  switch (type) {
    case "invoice":
      return "Facture";
    case "deposit":
      return "Facture d'acompte";
    case "final":
      return "Facture finale";
    case "credit_note":
      return "Avoir";
    default:
      return type;
  }
}

function getCustomerDisplayName(invoice: InvoiceListItem) {
  if (invoice.customer_company_name_snapshot?.trim()) {
    return invoice.customer_company_name_snapshot;
  }

  const fullName = [
    invoice.customer_first_name_snapshot,
    invoice.customer_last_name_snapshot,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return fullName || "Client non renseigné";
}

export function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {
    void loadInvoices();
  }, []);

  async function loadInvoices() {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from("invoices")
      .select(
        `
        id,
        invoice_number,
        invoice_type,
        status,
        issue_date,
        due_date,
        total_ttc,
        amount_paid,
        balance_due,
        customer_company_name_snapshot,
        customer_first_name_snapshot,
        customer_last_name_snapshot,
        source_quote_id
      `
      )
      .order("issue_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    setInvoices((data ?? []) as InvoiceListItem[]);
    setLoading(false);
  }

  const filteredInvoices = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return invoices.filter((invoice) => {
      const customerName = getCustomerDisplayName(invoice).toLowerCase();

      const matchesSearch =
        !normalizedSearch ||
        invoice.invoice_number.toLowerCase().includes(normalizedSearch) ||
        customerName.includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "all" || invoice.status === statusFilter;

      const matchesType = typeFilter === "all" || invoice.invoice_type === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [invoices, search, statusFilter, typeFilter]);

  if (loading) {
    return <LoadingBlock message="Chargement des factures..." />;
  }

  return (
    <section>
      <PageHeader
        title="Factures"
        description="Consulte et filtre les factures générées depuis les devis."
      />

      <SectionCard title="Filtres">
        <FormGrid columns="3">
          <FormField label="Recherche">
            <TextInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="N° facture ou client"
            />
          </FormField>

          <FormField label="Statut">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Tous</option>
              <option value="draft">Brouillon</option>
              <option value="issued">Émise</option>
              <option value="sent">Envoyée</option>
              <option value="partially_paid">Partiellement payée</option>
              <option value="paid">Payée</option>
              <option value="cancelled">Annulée</option>
              <option value="credited">Avoirée</option>
            </Select>
          </FormField>

          <FormField label="Type">
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="all">Tous</option>
              <option value="invoice">Facture</option>
              <option value="deposit">Facture d'acompte</option>
              <option value="final">Facture finale</option>
              <option value="credit_note">Avoir</option>
            </Select>
          </FormField>
        </FormGrid>
      </SectionCard>

      {error && <ErrorMessage message={error} />}

      {filteredInvoices.length === 0 ? (
        <EmptyState
          title="Aucune facture"
          description="Transforme un devis en facture pour la voir apparaître ici."
        />
      ) : (
        <SectionCard title={`Factures (${filteredInvoices.length})`}>
          <DataTable
            headers={
              <tr>
                <th>Numéro</th>
                <th>Type</th>
                <th>Client</th>
                <th>Statut</th>
                <th>Date</th>
                <th>Échéance</th>
                <th>Total TTC</th>
                <th>Payé</th>
                <th>Solde</th>
                <th />
              </tr>
            }
          >
            {filteredInvoices.map((invoice) => (
              <tr key={invoice.id}>
                <td>{invoice.invoice_number}</td>
                <td>{getInvoiceTypeLabel(invoice.invoice_type)}</td>
                <td>{getCustomerDisplayName(invoice)}</td>
                <td>{getInvoiceStatusLabel(invoice.status)}</td>
                <td>{invoice.issue_date}</td>
                <td>{invoice.due_date || "-"}</td>
                <td>{Number(invoice.total_ttc).toFixed(2)} €</td>
                <td>{Number(invoice.amount_paid).toFixed(2)} €</td>
                <td>{Number(invoice.balance_due).toFixed(2)} €</td>
                <td>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Link to={`/factures/${invoice.id}`}>
                      <Button size="sm" type="button">
                        Voir
                      </Button>
                    </Link>

                    {invoice.source_quote_id && (
                      <Link to={`/devis/${invoice.source_quote_id}`}>
                        <Button size="sm" variant="secondary" type="button">
                          Voir le devis
                        </Button>
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        </SectionCard>
      )}
    </section>
  );
}