import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "../../../components/ui/Button/Button";
import { ErrorMessage } from "../../../components/ui/ErrorMessage/ErrorMessage";
import { InvoiceIcon } from "../../../components/ui/Icons/AppIcons";
import { LoadingBlock } from "../../../components/ui/LoadingBlock/LoadingBlock";
import { TextInput } from "../../../components/ui/TextInput/TextInput";
import { formatDisplayDate } from "../../../lib/formatters";
import { issueInvoice, loadInvoiceDetail, previewStorecoveInvoice, submitStorecoveInvoice } from "../invoiceRepository";
import type { InvoiceDetail, InvoiceLine, StorecovePreview } from "../types";
import "./InvoiceDetailsPage.css";

type Submission = {
  id: string;
  environment: string;
  status: string;
  network: string | null;
  requested_at: string;
  error_message: string | null;
};

type InvoiceEvent = {
  id: string;
  event_name: string;
  details: string | null;
  received_at: string;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(Number(value || 0));
}

function today() {
  return new Intl.DateTimeFormat("sv-SE").format(new Date());
}

function defaultDueDate() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return new Intl.DateTimeFormat("sv-SE").format(date);
}

function customerName(document: InvoiceDetail) {
  const snapshotName = document.buyer_snapshot?.name;
  if (typeof snapshotName === "string" && snapshotName) return snapshotName;
  const customer = document.customer;
  return customer?.company_name || [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") || "Client";
}

function metadataString(document: InvoiceDetail, key: string) {
  const value = document.metadata?.[key];
  return typeof value === "string" ? value : null;
}

export function InvoiceDetailsPage() {
  const { invoiceId = "" } = useParams();
  const [document, setDocument] = useState<InvoiceDetail | null>(null);
  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [events, setEvents] = useState<InvoiceEvent[]>([]);
  const [issueDate, setIssueDate] = useState(today());
  const [dueDate, setDueDate] = useState(defaultDueDate());
  const [preview, setPreview] = useState<StorecovePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const data = await loadInvoiceDetail(invoiceId);
    setDocument(data.document);
    setLines(data.lines);
    setSubmissions(data.submissions as Submission[]);
    setEvents(data.events as InvoiceEvent[]);
  }

  useEffect(() => {
    let cancelled = false;
    loadInvoiceDetail(invoiceId)
      .then((data) => {
        if (cancelled) return;
        setDocument(data.document);
        setLines(data.lines);
        setSubmissions(data.submissions as Submission[]);
        setEvents(data.events as InvoiceEvent[]);
      })
      .catch((reason: Error) => !cancelled && setError(reason.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [invoiceId]);

  async function handleIssue() {
    if (!document) return;
    const confirmed = window.confirm(
      "Émettre cette facture ? Un numéro définitif sera attribué et les coordonnées seront figées.",
    );
    if (!confirmed) return;

    setIssuing(true);
    setError(null);
    try {
      await issueInvoice(document.id, issueDate, dueDate);
      await reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible d’émettre la facture.");
    } finally {
      setIssuing(false);
    }
  }

  async function handlePreview() {
    if (!document) return;
    setPreviewing(true);
    setError(null);
    try {
      setPreview(await previewStorecoveInvoice(document.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible de préparer l’aperçu Storecove.");
    } finally {
      setPreviewing(false);
    }
  }

  async function handleSubmit() {
    if (!document || !preview?.ready) return;
    const confirmed = window.confirm(
      `Envoyer définitivement ${document.document_number ?? "cette facture"} à Storecove en environnement sandbox ?`,
    );
    if (!confirmed) return;

    setSubmitting(true);
    setError(null);
    try {
      await submitStorecoveInvoice(document.id);
      await reload();
      setPreview(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Transmission Storecove impossible.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingBlock message="Chargement de la facture…" />;
  if (!document) return <ErrorMessage message={error ?? "Facture introuvable."} />;

  return (
    <div className="invoice-details">
      <Link className="invoice-details__back" to="/factures">← Retour aux factures</Link>

      <header className="invoice-details__header">
        <div className="invoice-details__header-icon"><InvoiceIcon /></div>
        <div className="invoice-details__header-copy">
          <span className="invoice-details__eyebrow">{document.document_status === "draft" ? "Brouillon de facture" : "Facture émise"}</span>
          <h1>{document.document_number ?? metadataString(document, "sourceQuoteTitle") ?? "Nouvelle facture"}</h1>
          <p>{customerName(document)}{document.customer_reference ? ` · devis ${document.customer_reference}` : ""}</p>
        </div>
        <div className="invoice-details__header-total"><span>Total TVAC</span><strong>{formatCurrency(document.total_ttc)}</strong></div>
      </header>

      {error ? <ErrorMessage message={error} /> : null}

      <section className="invoice-details__progress" aria-label="Avancement de la facture">
        <div className="invoice-details__progress-step invoice-details__progress-step--done"><span>1</span><div><strong>Brouillon créé</strong><small>Depuis le devis accepté</small></div></div>
        <div className={`invoice-details__progress-step${document.document_status !== "draft" ? " invoice-details__progress-step--done" : " invoice-details__progress-step--current"}`}><span>2</span><div><strong>Facture émise</strong><small>Numéro et instantanés figés</small></div></div>
        <div className={`invoice-details__progress-step${document.delivery_status !== "not_submitted" ? " invoice-details__progress-step--done" : ""}`}><span>3</span><div><strong>Transmission</strong><small>{document.delivery_status === "not_submitted" ? "En attente de Storecove" : document.delivery_status}</small></div></div>
      </section>

      <div className="invoice-details__grid">
        <main className="invoice-details__main">
          <section className="invoice-details__panel">
            <div className="invoice-details__panel-heading"><div><span className="invoice-details__section-index">01</span><h2>Lignes facturées</h2></div><span>{lines.length} ligne(s)</span></div>
            <div className="invoice-details__lines">
              <div className="invoice-details__line invoice-details__line--head"><span>Description</span><span>Qté</span><span>Prix HT</span><span>TVA</span><span>Total HT</span></div>
              {lines.map((line) => (
                <div className="invoice-details__line" key={line.id}>
                  <span className="invoice-details__line-copy"><strong>{line.label}</strong>{line.room_label ? <small>{line.room_label}</small> : null}{line.description ? <small>{line.description}</small> : null}</span>
                  <span>{Number(line.quantity)} {line.unit_label ?? ""}</span>
                  <span>{formatCurrency(line.unit_price_ht)}</span>
                  <span>{Number(line.vat_rate)} %</span>
                  <strong>{formatCurrency(line.line_extension_amount)}</strong>
                </div>
              ))}
            </div>
            <div className="invoice-details__totals">
              <div><span>Sous-total HT</span><strong>{formatCurrency(document.subtotal_ht)}</strong></div>
              <div><span>TVA</span><strong>{formatCurrency(document.total_tax)}</strong></div>
              <div className="invoice-details__total-final"><span>Total TVAC</span><strong>{formatCurrency(document.total_ttc)}</strong></div>
            </div>
          </section>

          {document.document_status === "draft" ? (
            <section className="invoice-details__panel invoice-details__issue-panel">
              <div className="invoice-details__panel-heading"><div><span className="invoice-details__section-index">02</span><h2>Émettre la facture</h2></div></div>
              <p>Cette opération attribue le prochain numéro légal et fige les coordonnées du vendeur et du client.</p>
              <div className="invoice-details__dates">
                <label>Date d’émission<TextInput type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} /></label>
                <label>Date d’échéance<TextInput type="date" value={dueDate} min={issueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
              </div>
              <Button type="button" disabled={issuing || !issueDate || !dueDate} onClick={handleIssue}>{issuing ? "Émission…" : "Émettre avec un numéro définitif"}</Button>
            </section>
          ) : null}
        </main>

        <aside className="invoice-details__aside">
          <section className="invoice-details__panel invoice-details__storecove">
            <span className="invoice-details__section-index">Storecove</span>
            <h2>Contrôle e-facturation</h2>
            <p>L’envoi réel reste verrouillé tant que la clé API et la LegalEntity ne sont pas configurées.</p>
            <Button type="button" variant="secondary" disabled={previewing || document.document_status === "draft"} onClick={handlePreview}>
              {previewing ? "Analyse…" : "Analyser la facture"}
            </Button>
            {document.document_status === "draft" ? <small>Émettez d’abord la facture pour contrôler son payload définitif.</small> : null}
            {preview ? (
              <div className={`storecove-check ${preview.ready ? "storecove-check--ready" : "storecove-check--blocked"}`}>
                <strong>{preview.ready ? "Prête à envoyer" : "Configuration incomplète"}</strong>
                {preview.blockingIssues.length ? <ul>{preview.blockingIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul> : null}
                {preview.warnings.length ? <div className="storecove-check__warnings"><span>À vérifier</span><ul>{preview.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div> : null}
                {preview.ready ? <Button type="button" disabled={submitting} onClick={handleSubmit}>{submitting ? "Transmission…" : "Envoyer en sandbox"}</Button> : null}
                <details><summary>Voir le JSON préparé</summary><pre>{JSON.stringify(preview.payload, null, 2)}</pre></details>
              </div>
            ) : null}
          </section>

          <section className="invoice-details__panel invoice-details__facts">
            <h2>Informations</h2>
            <dl>
              <div><dt>Statut</dt><dd>{document.document_status === "draft" ? "Brouillon" : "Émise"}</dd></div>
              <div><dt>Émission</dt><dd>{formatDisplayDate(document.issue_date)}</dd></div>
              <div><dt>Échéance</dt><dd>{formatDisplayDate(document.due_date)}</dd></div>
              <div><dt>Paiement</dt><dd>{document.payment_status}</dd></div>
              <div><dt>Solde</dt><dd>{formatCurrency(document.payable_amount)}</dd></div>
            </dl>
          </section>

          {submissions.length || events.length ? (
            <section className="invoice-details__panel invoice-details__timeline">
              <h2>Suivi Storecove</h2>
              {submissions.map((submission) => <div key={submission.id}><span /> <p><strong>{submission.status}</strong><small>{submission.environment} · {formatDisplayDate(submission.requested_at)}</small>{submission.error_message ? <small>{submission.error_message}</small> : null}</p></div>)}
              {events.map((event) => <div key={event.id}><span /> <p><strong>{event.event_name}</strong><small>{event.details ?? formatDisplayDate(event.received_at)}</small></p></div>)}
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
