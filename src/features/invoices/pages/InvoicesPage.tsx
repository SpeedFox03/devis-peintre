import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../../../components/ui/Button/Button";
import { EmptyState } from "../../../components/ui/EmptyState/EmptyState";
import { ErrorMessage } from "../../../components/ui/ErrorMessage/ErrorMessage";
import { InvoiceIcon, PlusIcon } from "../../../components/ui/Icons/AppIcons";
import { LoadingBlock } from "../../../components/ui/LoadingBlock/LoadingBlock";
import { Select } from "../../../components/ui/Select/Select";
import { TextInput } from "../../../components/ui/TextInput/TextInput";
import { formatDisplayDate } from "../../../lib/formatters";
import { createInvoiceFromQuote, loadInvoicesPage } from "../invoiceRepository";
import type { AcceptedQuote, InvoiceRow, SalesDocumentStatus } from "../types";
import "./InvoicesPage.css";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(Number(value || 0));
}

function customerName(customer: InvoiceRow["customer"] | AcceptedQuote["customer"]) {
  if (!customer) return "Client";
  return customer.company_name || [customer.first_name, customer.last_name].filter(Boolean).join(" ") || "Client";
}

function statusLabel(status: SalesDocumentStatus) {
  if (status === "draft") return "Brouillon";
  if (status === "issued") return "Émise";
  if (status === "cancelled") return "Annulée";
  return "Créditée";
}

export function InvoicesPage() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [acceptedQuotes, setAcceptedQuotes] = useState<AcceptedQuote[]>([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState("");
  const [showCreator, setShowCreator] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadInvoicesPage()
      .then((data) => {
        if (cancelled) return;
        setInvoices(data.invoices);
        setAcceptedQuotes(data.acceptedQuotes);
        setSelectedQuoteId(data.acceptedQuotes[0]?.id ?? "");
        setError(null);
      })
      .catch((reason: Error) => !cancelled && setError(reason.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  const filteredInvoices = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("fr");
    return invoices.filter((invoice) => {
      const matchesStatus = status === "all" || invoice.document_status === status;
      const haystack = `${invoice.document_number ?? "brouillon"} ${customerName(invoice.customer)}`.toLocaleLowerCase("fr");
      return matchesStatus && (!normalizedSearch || haystack.includes(normalizedSearch));
    });
  }, [invoices, search, status]);

  const issuedTotal = invoices
    .filter((invoice) => invoice.document_status === "issued")
    .reduce((sum, invoice) => sum + Number(invoice.total_ttc), 0);
  const unpaidTotal = invoices
    .filter((invoice) => invoice.document_status === "issued")
    .reduce((sum, invoice) => sum + Number(invoice.payable_amount), 0);

  async function handleCreate() {
    if (!selectedQuoteId) return;
    setCreating(true);
    setError(null);
    try {
      const invoiceId = await createInvoiceFromQuote(selectedQuoteId);
      navigate(`/factures/${invoiceId}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible de créer la facture.");
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <LoadingBlock message="Chargement des factures…" />;

  return (
    <div className="invoices-page">
      <section className="invoices-page__hero">
        <div>
          <span className="invoices-page__eyebrow"><InvoiceIcon /> Nouveau module</span>
          <h1>Factures</h1>
          <p>Préparez vos factures et contrôlez leur compatibilité avant la connexion à Storecove.</p>
        </div>
        <Button type="button" onClick={() => setShowCreator((current) => !current)}>
          <PlusIcon /> Nouvelle facture
        </Button>
      </section>

      {error ? <ErrorMessage message={error} /> : null}

      {showCreator ? (
        <section className="invoices-page__creator" aria-labelledby="invoice-creator-title">
          <div>
            <span className="invoices-page__step">Étape 1</span>
            <h2 id="invoice-creator-title">Créer depuis un devis accepté</h2>
            <p>Les lignes sont copiées dans un brouillon indépendant. Le devis ne passe en historique qu’à l’émission.</p>
          </div>
          {acceptedQuotes.length ? (
            <div className="invoices-page__creator-actions">
              <Select value={selectedQuoteId} onChange={(event) => setSelectedQuoteId(event.target.value)} aria-label="Devis accepté">
                {acceptedQuotes.map((quote) => (
                  <option key={quote.id} value={quote.id}>
                    {quote.quote_number} · {quote.title} · {customerName(quote.customer)} · {formatCurrency(quote.total_ttc)}
                  </option>
                ))}
              </Select>
              <Button type="button" disabled={creating} onClick={handleCreate}>
                {creating ? "Création…" : "Créer le brouillon"}
              </Button>
            </div>
          ) : (
            <p className="invoices-page__hint">Aucun devis accepté n’est disponible pour une nouvelle facture.</p>
          )}
        </section>
      ) : null}

      <section className="invoices-page__stats" aria-label="Résumé des factures">
        <article><span>Documents</span><strong>{invoices.length}</strong><small>{invoices.filter((invoice) => invoice.document_status === "draft").length} brouillon(s)</small></article>
        <article><span>Total émis</span><strong>{formatCurrency(issuedTotal)}</strong><small>hors brouillons</small></article>
        <article><span>À encaisser</span><strong>{formatCurrency(unpaidTotal)}</strong><small>suivi des paiements à venir</small></article>
      </section>

      <section className="invoices-page__list-panel">
        <div className="invoices-page__list-heading">
          <div><h2>Toutes les factures</h2><p>{filteredInvoices.length} résultat(s)</p></div>
          <div className="invoices-page__filters">
            <TextInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un client ou numéro" aria-label="Rechercher une facture" />
            <Select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filtrer par statut">
              <option value="all">Tous les statuts</option>
              <option value="draft">Brouillons</option>
              <option value="issued">Émises</option>
              <option value="cancelled">Annulées</option>
              <option value="credited">Créditées</option>
            </Select>
          </div>
        </div>

        {!filteredInvoices.length ? (
          <EmptyState
            title={invoices.length ? "Aucune facture ne correspond" : "Aucune facture pour le moment"}
            description={invoices.length ? "Modifiez la recherche ou le filtre." : "Commencez à partir d’un devis accepté."}
            actionLabel={!invoices.length ? "Créer une facture" : undefined}
            onAction={!invoices.length ? () => setShowCreator(true) : undefined}
          />
        ) : (
          <>
            <div className="invoices-page__table-wrap">
              <table>
                <thead><tr><th>Numéro</th><th>Client</th><th>Émission</th><th>Statut</th><th>Storecove</th><th>Total</th></tr></thead>
                <tbody>
                  {filteredInvoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td><Link to={`/factures/${invoice.id}`}>{invoice.document_number ?? "Brouillon"}</Link></td>
                      <td>{customerName(invoice.customer)}</td>
                      <td>{formatDisplayDate(invoice.issue_date ?? invoice.created_at)}</td>
                      <td><span className={`invoice-status invoice-status--${invoice.document_status}`}>{statusLabel(invoice.document_status)}</span></td>
                      <td><span className={`delivery-status delivery-status--${invoice.delivery_status}`}>{invoice.delivery_status === "not_submitted" ? "Non envoyée" : invoice.delivery_status}</span></td>
                      <td className="invoices-page__amount">{formatCurrency(invoice.total_ttc)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="invoices-page__cards">
              {filteredInvoices.map((invoice) => (
                <Link className="invoice-card" to={`/factures/${invoice.id}`} key={invoice.id}>
                  <div className="invoice-card__top"><strong>{invoice.document_number ?? "Brouillon"}</strong><span>{formatCurrency(invoice.total_ttc)}</span></div>
                  <h3>{customerName(invoice.customer)}</h3>
                  <div className="invoice-card__meta"><span>{formatDisplayDate(invoice.issue_date ?? invoice.created_at)}</span><span className={`invoice-status invoice-status--${invoice.document_status}`}>{statusLabel(invoice.document_status)}</span></div>
                </Link>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
