import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { LoadingBlock } from "../../../components/ui/LoadingBlock/LoadingBlock";
import { ErrorMessage } from "../../../components/ui/ErrorMessage/ErrorMessage";
import { EmptyState } from "../../../components/ui/EmptyState/EmptyState";
import { Card } from "../../../components/ui/Card/Card";
import { DataTable } from "../../../components/ui/DataTable/DataTable";
import { Button } from "../../../components/ui/Button/Button";
import { FormField } from "../../../components/ui/FormField/FormField";
import { TextInput } from "../../../components/ui/TextInput/TextInput";
import { Select } from "../../../components/ui/Select/Select";
import "./InvoicesPage.css";

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
    case "draft": return "Brouillon";
    case "issued": return "Émise";
    case "sent": return "Envoyée";
    case "partially_paid": return "Partiellement payée";
    case "paid": return "Payée";
    case "cancelled": return "Annulée";
    case "credited": return "Avoirée";
    default: return status;
  }
}

function getInvoiceTypeLabel(type: InvoiceType) {
  switch (type) {
    case "invoice": return "Facture";
    case "deposit": return "Acompte";
    case "final": return "Finale";
    case "credit_note": return "Avoir";
    default: return type;
  }
}

function getCustomerDisplayName(invoice: InvoiceListItem) {
  if (invoice.customer_company_name_snapshot?.trim()) return invoice.customer_company_name_snapshot;
  const fullName = [invoice.customer_first_name_snapshot, invoice.customer_last_name_snapshot]
    .filter(Boolean).join(" ").trim();
  return fullName || "Client non renseigné";
}

function formatCurrency(value: number) {
  return `${Number(value || 0).toFixed(2)} €`;
}

export function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => { void loadInvoices(); }, []);

  async function loadInvoices() {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from("invoices")
      .select(`id, invoice_number, invoice_type, status, issue_date, due_date,
        total_ttc, amount_paid, balance_due, customer_company_name_snapshot,
        customer_first_name_snapshot, customer_last_name_snapshot, source_quote_id`)
      .order("issue_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (fetchError) { setError(fetchError.message); setLoading(false); return; }
    setInvoices((data ?? []) as InvoiceListItem[]);
    setLoading(false);
  }

  const filteredInvoices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter((inv) => {
      const name = getCustomerDisplayName(inv).toLowerCase();
      const matchSearch = !q || inv.invoice_number.toLowerCase().includes(q) || name.includes(q);
      const matchStatus = statusFilter === "all" || inv.status === statusFilter;
      const matchType = typeFilter === "all" || inv.invoice_type === typeFilter;
      return matchSearch && matchStatus && matchType;
    });
  }, [invoices, search, statusFilter, typeFilter]);

  if (loading) return <LoadingBlock message="Chargement des factures..." />;

  return (
    <section className="invoices-premium-page">
      <header className="invoices-premium-page__hero">
        <div className="invoices-premium-page__hero-main">
          <p className="invoices-premium-page__eyebrow">Comptabilité</p>
          <h1 className="invoices-premium-page__title">Factures</h1>
          <p className="invoices-premium-page__description">
            Consulte et filtre les factures générées depuis les devis.
          </p>
        </div>
      </header>

      <Card className="invoices-premium-page__filters-card">
        <div className="invoices-premium-page__filters-grid">
          <FormField label="Recherche">
            <TextInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="N° facture ou client"
            />
          </FormField>

          <FormField label="Statut">
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
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
              <option value="deposit">Acompte</option>
              <option value="final">Finale</option>
              <option value="credit_note">Avoir</option>
            </Select>
          </FormField>
        </div>
      </Card>

      {error && <ErrorMessage message={error} />}

      {filteredInvoices.length === 0 ? (
        <EmptyState
          title="Aucune facture"
          description="Transforme un devis en facture pour la voir apparaître ici."
        />
      ) : (
        <>
          {/* ── Tableau desktop ── */}
          <div className="invoices-premium-page__table-shell">
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
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              }
            >
              {filteredInvoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td>
                    <span className="invoices-premium-page__invoice-number">
                      {invoice.invoice_number}
                    </span>
                  </td>
                  <td>{getInvoiceTypeLabel(invoice.invoice_type)}</td>
                  <td style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {getCustomerDisplayName(invoice)}
                  </td>
                  <td>
                    <span className={`invoices-premium-page__status-chip invoices-premium-page__status-chip--${invoice.status}`}>
                      {getInvoiceStatusLabel(invoice.status)}
                    </span>
                  </td>
                  <td>{invoice.issue_date}</td>
                  <td>{invoice.due_date || "—"}</td>
                  <td><strong>{formatCurrency(invoice.total_ttc)}</strong></td>
                  <td>{formatCurrency(invoice.amount_paid)}</td>
                  <td>{formatCurrency(invoice.balance_due)}</td>
                  <td>
                    <div className="invoices-premium-page__row-actions">
                      <Link to={`/factures/${invoice.id}`}>
                        <Button size="sm" type="button">Voir</Button>
                      </Link>
                      {invoice.source_quote_id && (
                        <Link to={`/devis/${invoice.source_quote_id}`}>
                          <Button size="sm" variant="secondary" type="button">Devis</Button>
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </DataTable>
          </div>

          {/* ── Vue cartes mobile ── */}
          <div className="invoices-premium-page__card-list">
            {filteredInvoices.map((invoice) => (
              <article key={invoice.id} className="invoices-premium-page__invoice-card">
                <div className="invoices-premium-page__invoice-card-header">
                  <div className="invoices-premium-page__invoice-card-main">
                    <span className="invoices-premium-page__invoice-number">
                      {invoice.invoice_number}
                    </span>
                    <p className="invoices-premium-page__invoice-card-customer">
                      {getCustomerDisplayName(invoice)}
                    </p>
                    <p className="invoices-premium-page__invoice-card-type">
                      {getInvoiceTypeLabel(invoice.invoice_type)}
                    </p>
                  </div>
                  <span className="invoices-premium-page__invoice-card-total">
                    {formatCurrency(invoice.total_ttc)}
                  </span>
                </div>

                <div className="invoices-premium-page__invoice-card-meta">
                  <span className={`invoices-premium-page__status-chip invoices-premium-page__status-chip--${invoice.status}`}>
                    {getInvoiceStatusLabel(invoice.status)}
                  </span>
                  <span className="invoices-premium-page__invoice-card-date">
                    {invoice.issue_date}
                    {invoice.due_date ? ` · éch. ${invoice.due_date}` : ""}
                  </span>
                </div>

                <div className="invoices-premium-page__invoice-card-balances">
                  <div className="invoices-premium-page__invoice-card-balance">
                    <span className="invoices-premium-page__invoice-card-balance-label">Payé</span>
                    <span className="invoices-premium-page__invoice-card-balance-value">{formatCurrency(invoice.amount_paid)}</span>
                  </div>
                  <div className="invoices-premium-page__invoice-card-balance">
                    <span className="invoices-premium-page__invoice-card-balance-label">Solde</span>
                    <span className="invoices-premium-page__invoice-card-balance-value">{formatCurrency(invoice.balance_due)}</span>
                  </div>
                </div>

                <div className="invoices-premium-page__invoice-card-actions">
                  <Link to={`/factures/${invoice.id}`} style={{ flex: "1 1 auto" }}>
                    <Button type="button" style={{ width: "100%", justifyContent: "center" }}>Voir</Button>
                  </Link>
                  {invoice.source_quote_id && (
                    <Link to={`/devis/${invoice.source_quote_id}`} style={{ flex: "1 1 auto" }}>
                      <Button type="button" variant="secondary" style={{ width: "100%", justifyContent: "center" }}>
                        Voir le devis
                      </Button>
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}