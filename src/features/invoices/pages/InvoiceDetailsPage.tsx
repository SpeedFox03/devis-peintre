import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { PageHeader } from "../../../components/ui/PageHeader/PageHeader";
import { LoadingBlock } from "../../../components/ui/LoadingBlock/LoadingBlock";
import { ErrorMessage } from "../../../components/ui/ErrorMessage/ErrorMessage";
import { EmptyState } from "../../../components/ui/EmptyState/EmptyState";
import { SectionCard } from "../../../components/ui/SectionCard/SectionCard";
import { DataTable } from "../../../components/ui/DataTable/DataTable";
import { Button } from "../../../components/ui/Button/Button";
import { Card } from "../../../components/ui/Card/Card";
import { FormField } from "../../../components/ui/FormField/FormField";
import { FormGrid } from "../../../components/ui/FormGrid/FormGrid";
import { TextInput } from "../../../components/ui/TextInput/TextInput";
import { TextArea } from "../../../components/ui/TextArea/TextArea";
import { Select } from "../../../components/ui/Select/Select";
import { exportPeppolInvoiceXml } from "../peppol/exportPeppolInvoiceXml";
import { sendPeppolInvoice } from "../peppol/sendPeppolInvoice";

type InvoiceStatus =
  | "draft"
  | "issued"
  | "sent"
  | "partially_paid"
  | "paid"
  | "cancelled"
  | "credited";

type InvoiceType = "invoice" | "deposit" | "final" | "credit_note";

type InvoiceDetails = {
  id: string;
  invoice_number: string;
  invoice_type: InvoiceType;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string | null;
  currency_code: string;
  customer_reference: string | null;
  purchase_order_reference: string | null;
  payment_terms: string | null;
  notes: string | null;
  subtotal_ht: number;
  discount_amount: number;
  total_tva: number;
  total_ttc: number;
  amount_paid: number;
  balance_due: number;
  peppol_status: string;
  source_quote_id: string | null;

  company_name_snapshot: string | null;
  company_vat_number_snapshot: string | null;
  company_email_snapshot: string | null;
  company_phone_snapshot: string | null;
  company_address_line1_snapshot: string | null;
  company_address_line2_snapshot: string | null;
  company_postal_code_snapshot: string | null;
  company_city_snapshot: string | null;
  company_country_snapshot: string | null;
  company_iban_snapshot: string | null;
  company_bic_snapshot: string | null;

  customer_company_name_snapshot: string | null;
  customer_first_name_snapshot: string | null;
  customer_last_name_snapshot: string | null;
  customer_email_snapshot: string | null;
  customer_phone_snapshot: string | null;
  customer_billing_address_line1_snapshot: string | null;
  customer_billing_address_line2_snapshot: string | null;
  customer_billing_postal_code_snapshot: string | null;
  customer_billing_city_snapshot: string | null;
  customer_billing_country_snapshot: string | null;
  customer_jobsite_address_line1_snapshot: string | null;
  customer_jobsite_address_line2_snapshot: string | null;
  customer_jobsite_postal_code_snapshot: string | null;
  customer_jobsite_city_snapshot: string | null;
  customer_jobsite_country_snapshot: string | null;

  seller_endpoint_id?: string | null;
  seller_endpoint_scheme?: string | null;
  buyer_endpoint_id?: string | null;
  buyer_endpoint_scheme?: string | null;
  payment_means_code?: string | null;
};

type InvoiceItem = {
  id: string;
  invoice_id: string;
  room_label: string | null;
  item_type: string;
  category: string | null;
  label: string;
  description: string | null;
  unit: string;
  quantity: number;
  unit_price_ht: number;
  discount_amount: number;
  tva_rate: number;
  line_subtotal_ht: number;
  line_total_tva: number;
  line_total_ttc: number;
  sort_order: number;
};

type InvoicePayment = {
  id: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  reference: string | null;
  notes: string | null;
  created_at: string;
};

type PaymentFormState = {
  payment_date: string;
  amount: string;
  payment_method: string;
  reference: string;
  notes: string;
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

function getPeppolStatusLabel(status: string) {
  switch (status) {
    case "not_sent":
      return "Non envoyé";
    case "ready":
      return "Prêt";
    case "submitted":
      return "Soumis";
    case "delivered":
      return "Distribué";
    case "rejected":
      return "Rejeté";
    case "error":
      return "Erreur";
    default:
      return status;
  }
}

function getPeppolStatusColor(status: string): string {
  switch (status) {
    case "delivered":
      return "#16a34a";
    case "submitted":
      return "#2563eb";
    case "ready":
      return "#7c3aed";
    case "rejected":
    case "error":
      return "#dc2626";
    default:
      return "#6b7280";
  }
}

function getPaymentMethodLabel(method: string) {
  switch (method) {
    case "bank_transfer":
      return "Virement";
    case "cash":
      return "Espèces";
    case "card":
      return "Carte";
    case "check":
      return "Chèque";
    case "other":
      return "Autre";
    default:
      return method;
  }
}

function formatDateForInput(date: Date) {
  return date.toISOString().split("T")[0];
}

function createInitialPaymentForm(balanceDue = 0): PaymentFormState {
  return {
    payment_date: formatDateForInput(new Date()),
    amount: balanceDue > 0 ? String(balanceDue) : "0",
    payment_method: "bank_transfer",
    reference: "",
    notes: "",
  };
}

function getCustomerDisplayName(invoice: InvoiceDetails) {
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

function buildAddressBlock(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(", ");
}

/** Returns true if this invoice can be sent via Peppol network */
function canSendViaPeppol(invoice: InvoiceDetails): boolean {
  const sendableStatuses: InvoiceStatus[] = ["issued", "sent", "partially_paid"];
  return (
    sendableStatuses.includes(invoice.status) &&
    !!invoice.seller_endpoint_id?.trim() &&
    !!invoice.buyer_endpoint_id?.trim() &&
    invoice.peppol_status !== "delivered"
  );
}

export function InvoiceDetailsPage() {
  const { invoiceId } = useParams();

  const [invoice, setInvoice] = useState<InvoiceDetails | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [payments, setPayments] = useState<InvoicePayment[]>([]);

  const [loading, setLoading] = useState(true);
  const [issuingInvoice, setIssuingInvoice] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);
  const [exportingPeppolXml, setExportingPeppolXml] = useState(false);
  const [sendingPeppol, setSendingPeppol] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>(
    createInitialPaymentForm()
  );

  useEffect(() => {
    void loadInvoicePage();
  }, [invoiceId]);

  useEffect(() => {
    setPaymentForm(createInitialPaymentForm(invoice?.balance_due ?? 0));
  }, [invoice?.balance_due]);

  async function loadInvoicePage() {
    if (!invoiceId) {
      setError("Facture introuvable.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const [invoiceRes, itemsRes, paymentsRes] = await Promise.all([
      supabase
        .from("invoices")
        .select(
          `
          id,
          invoice_number,
          invoice_type,
          status,
          issue_date,
          due_date,
          currency_code,
          customer_reference,
          purchase_order_reference,
          payment_terms,
          notes,
          subtotal_ht,
          discount_amount,
          total_tva,
          total_ttc,
          amount_paid,
          balance_due,
          peppol_status,
          source_quote_id,
          seller_endpoint_id,
          seller_endpoint_scheme,
          buyer_endpoint_id,
          buyer_endpoint_scheme,
          payment_means_code,

          company_name_snapshot,
          company_vat_number_snapshot,
          company_email_snapshot,
          company_phone_snapshot,
          company_address_line1_snapshot,
          company_address_line2_snapshot,
          company_postal_code_snapshot,
          company_city_snapshot,
          company_country_snapshot,
          company_iban_snapshot,
          company_bic_snapshot,

          customer_company_name_snapshot,
          customer_first_name_snapshot,
          customer_last_name_snapshot,
          customer_email_snapshot,
          customer_phone_snapshot,
          customer_billing_address_line1_snapshot,
          customer_billing_address_line2_snapshot,
          customer_billing_postal_code_snapshot,
          customer_billing_city_snapshot,
          customer_billing_country_snapshot,
          customer_jobsite_address_line1_snapshot,
          customer_jobsite_address_line2_snapshot,
          customer_jobsite_postal_code_snapshot,
          customer_jobsite_city_snapshot,
          customer_jobsite_country_snapshot
        `
        )
        .eq("id", invoiceId)
        .single(),
      supabase
        .from("invoice_items")
        .select(
          `
          id,
          invoice_id,
          room_label,
          item_type,
          category,
          label,
          description,
          unit,
          quantity,
          unit_price_ht,
          discount_amount,
          tva_rate,
          line_subtotal_ht,
          line_total_tva,
          line_total_ttc,
          sort_order
        `
        )
        .eq("invoice_id", invoiceId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("invoice_payments")
        .select(
          `
          id,
          payment_date,
          amount,
          payment_method,
          reference,
          notes,
          created_at
        `
        )
        .eq("invoice_id", invoiceId)
        .order("payment_date", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);

    if (invoiceRes.error) {
      setError(invoiceRes.error.message);
      setLoading(false);
      return;
    }

    if (itemsRes.error) {
      setError(itemsRes.error.message);
      setLoading(false);
      return;
    }

    if (paymentsRes.error) {
      setError(paymentsRes.error.message);
      setLoading(false);
      return;
    }

    setInvoice(invoiceRes.data as InvoiceDetails);
    setItems((itemsRes.data ?? []) as InvoiceItem[]);
    setPayments((paymentsRes.data ?? []) as InvoicePayment[]);
    setLoading(false);
  }

  function updatePaymentField<K extends keyof PaymentFormState>(
    field: K,
    value: PaymentFormState[K]
  ) {
    setPaymentForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function openPaymentForm() {
    setPaymentForm(createInitialPaymentForm(invoice?.balance_due ?? 0));
    setShowPaymentForm(true);
    setError(null);
  }

  function closePaymentForm() {
    setShowPaymentForm(false);
    setError(null);
  }

  async function handleIssueInvoice() {
    if (!invoice) {
      setError("Facture introuvable.");
      return;
    }

    setIssuingInvoice(true);
    setError(null);

    const { error: rpcError } = await supabase.rpc("issue_invoice", {
      p_invoice_id: invoice.id,
    });

    if (rpcError) {
      setError(rpcError.message);
      setIssuingInvoice(false);
      return;
    }

    setIssuingInvoice(false);
    await loadInvoicePage();
  }

  async function handleExportPeppolXml() {
    if (!invoice) {
      setError("Facture introuvable.");
      return;
    }

    setExportingPeppolXml(true);
    setError(null);

    try {
      await exportPeppolInvoiceXml(invoice.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'exporter le XML Peppol.");
    } finally {
      setExportingPeppolXml(false);
    }
  }

  async function handleSendPeppol() {
    if (!invoice || !invoiceId) {
      setError("Facture introuvable.");
      return;
    }

    const confirmed = window.confirm(
      `Envoyer la facture ${invoice.invoice_number} via le réseau Peppol ?\n\nCette action transmet la facture à l'acheteur de façon électronique.`
    );
    if (!confirmed) return;

    setSendingPeppol(true);
    setError(null);

    try {
      await sendPeppolInvoice(invoiceId);
      // Reload to reflect the new peppol_status ("submitted")
      await loadInvoicePage();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible d'envoyer la facture via Peppol."
      );
    } finally {
      setSendingPeppol(false);
    }
  }

  async function handleRegisterPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!invoice) {
      setError("Facture introuvable.");
      return;
    }

    const amount = Number(paymentForm.amount || 0);

    if (amount <= 0) {
      setError("Le montant du paiement doit être supérieur à 0.");
      return;
    }

    setSavingPayment(true);
    setError(null);

    const { error: rpcError } = await supabase.rpc("register_invoice_payment", {
      p_invoice_id: invoice.id,
      p_amount: amount,
      p_payment_date: paymentForm.payment_date,
      p_payment_method: paymentForm.payment_method,
      p_reference: paymentForm.reference.trim() || null,
      p_notes: paymentForm.notes.trim() || null,
    });

    if (rpcError) {
      setError(rpcError.message);
      setSavingPayment(false);
      return;
    }

    setSavingPayment(false);
    setShowPaymentForm(false);
    await loadInvoicePage();
  }

  async function handleDeletePayment(paymentId: string) {
    const confirmed = window.confirm("Supprimer ce paiement ?");
    if (!confirmed) return;

    setDeletingPaymentId(paymentId);
    setError(null);

    const { error: rpcError } = await supabase.rpc("delete_invoice_payment", {
      p_payment_id: paymentId,
    });

    if (rpcError) {
      setError(rpcError.message);
      setDeletingPaymentId(null);
      return;
    }

    setDeletingPaymentId(null);
    await loadInvoicePage();
  }

  const groupedItems = useMemo(() => {
    const groups = new Map<string, InvoiceItem[]>();

    for (const item of items) {
      const key = item.room_label?.trim() || "Sans pièce";
      const existing = groups.get(key) ?? [];
      existing.push(item);
      groups.set(key, existing);
    }

    return Array.from(groups.entries()).map(([roomLabel, roomItems]) => ({
      roomLabel,
      items: roomItems,
    }));
  }, [items]);

  if (loading) {
    return <LoadingBlock message="Chargement de la facture..." />;
  }

  if (error && !invoice) {
    return <ErrorMessage message={error} />;
  }

  if (!invoice) {
    return (
      <EmptyState
        title="Facture introuvable"
        description="Cette facture n'existe pas ou n'est pas accessible."
      />
    );
  }

  const companyAddress = buildAddressBlock([
    invoice.company_address_line1_snapshot,
    invoice.company_address_line2_snapshot,
    invoice.company_postal_code_snapshot,
    invoice.company_city_snapshot,
    invoice.company_country_snapshot,
  ]);

  const customerAddress = buildAddressBlock([
    invoice.customer_billing_address_line1_snapshot,
    invoice.customer_billing_address_line2_snapshot,
    invoice.customer_billing_postal_code_snapshot,
    invoice.customer_billing_city_snapshot,
    invoice.customer_billing_country_snapshot,
  ]);

  const jobsiteAddress = buildAddressBlock([
    invoice.customer_jobsite_address_line1_snapshot,
    invoice.customer_jobsite_address_line2_snapshot,
    invoice.customer_jobsite_postal_code_snapshot,
    invoice.customer_jobsite_city_snapshot,
    invoice.customer_jobsite_country_snapshot,
  ]);

  const peppolSendable = canSendViaPeppol(invoice);

  return (
    <section>
      <PageHeader
        title={`${invoice.invoice_number} — ${getInvoiceTypeLabel(invoice.invoice_type)}`}
        description={`Statut : ${getInvoiceStatusLabel(invoice.status)}`}
        actions={
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {invoice.status === "draft" && (
              <Button
                type="button"
                onClick={handleIssueInvoice}
                disabled={issuingInvoice}
              >
                {issuingInvoice ? "Émission..." : "Émettre la facture"}
              </Button>
            )}

            <Button
              type="button"
              variant="secondary"
              onClick={handleExportPeppolXml}
              disabled={exportingPeppolXml}
            >
              {exportingPeppolXml ? "Export XML..." : "Exporter Peppol (XML)"}
            </Button>

            {peppolSendable && (
              <Button
                type="button"
                onClick={handleSendPeppol}
                disabled={sendingPeppol}
              >
                {sendingPeppol ? "Envoi en cours..." : "Envoyer via Peppol"}
              </Button>
            )}

            <Button
              type="button"
              variant="secondary"
              onClick={showPaymentForm ? closePaymentForm : openPaymentForm}
            >
              {showPaymentForm ? "Fermer le paiement" : "Ajouter un paiement"}
            </Button>

            {invoice.source_quote_id && (
              <Link to={`/devis/${invoice.source_quote_id}`}>
                <Button type="button" variant="secondary">
                  Voir le devis source
                </Button>
              </Link>
            )}

            <Link to="/factures">
              <Button type="button" variant="secondary">
                Retour aux factures
              </Button>
            </Link>
          </div>
        }
      />

      <SectionCard title="Résumé facture">
        <FormGrid columns="3">
          <Card>
            <h3 style={{ marginTop: 0 }}>Informations document</h3>
            <p><strong>Numéro :</strong> {invoice.invoice_number}</p>
            <p><strong>Type :</strong> {getInvoiceTypeLabel(invoice.invoice_type)}</p>
            <p><strong>Statut :</strong> {getInvoiceStatusLabel(invoice.status)}</p>
            <p><strong>Date :</strong> {invoice.issue_date}</p>
            <p><strong>Échéance :</strong> {invoice.due_date || "-"}</p>
            <p><strong>Devise :</strong> {invoice.currency_code}</p>
            <p>
              <strong>Peppol :</strong>{" "}
              <span style={{ color: getPeppolStatusColor(invoice.peppol_status), fontWeight: 600 }}>
                {getPeppolStatusLabel(invoice.peppol_status)}
              </span>
            </p>
          </Card>

          <Card>
            <h3 style={{ marginTop: 0 }}>Entreprise</h3>
            <p><strong>Nom :</strong> {invoice.company_name_snapshot || "-"}</p>
            <p><strong>TVA :</strong> {invoice.company_vat_number_snapshot || "-"}</p>
            <p><strong>Email :</strong> {invoice.company_email_snapshot || "-"}</p>
            <p><strong>Téléphone :</strong> {invoice.company_phone_snapshot || "-"}</p>
            <p><strong>Adresse :</strong> {companyAddress || "-"}</p>
            <p><strong>IBAN :</strong> {invoice.company_iban_snapshot || "-"}</p>
            <p><strong>BIC :</strong> {invoice.company_bic_snapshot || "-"}</p>
          </Card>

          <Card>
            <h3 style={{ marginTop: 0 }}>Client</h3>
            <p><strong>Nom :</strong> {getCustomerDisplayName(invoice)}</p>
            <p><strong>Email :</strong> {invoice.customer_email_snapshot || "-"}</p>
            <p><strong>Téléphone :</strong> {invoice.customer_phone_snapshot || "-"}</p>
            <p><strong>Adresse facturation :</strong> {customerAddress || "-"}</p>
            <p><strong>Adresse chantier :</strong> {jobsiteAddress || "-"}</p>
          </Card>
        </FormGrid>
      </SectionCard>

      <SectionCard title="Préparation Peppol">
        <FormGrid columns="3">
          <Card>
            <h3 style={{ marginTop: 0 }}>Vendeur</h3>
            <p><strong>Endpoint ID :</strong> {invoice.seller_endpoint_id || "-"}</p>
            <p><strong>Scheme :</strong> {invoice.seller_endpoint_scheme || "-"}</p>
          </Card>

          <Card>
            <h3 style={{ marginTop: 0 }}>Acheteur</h3>
            <p><strong>Endpoint ID :</strong> {invoice.buyer_endpoint_id || "-"}</p>
            <p><strong>Scheme :</strong> {invoice.buyer_endpoint_scheme || "-"}</p>
          </Card>

          <Card>
            <h3 style={{ marginTop: 0 }}>Paiement</h3>
            <p><strong>PaymentMeansCode :</strong> {invoice.payment_means_code || "-"}</p>
            <p><strong>IBAN :</strong> {invoice.company_iban_snapshot || "-"}</p>
          </Card>
        </FormGrid>

        {/* Avertissement si les endpoints ne sont pas configurés */}
        {(["issued", "sent", "partially_paid"] as InvoiceStatus[]).includes(invoice.status) &&
          (!invoice.seller_endpoint_id || !invoice.buyer_endpoint_id) && (
          <p style={{ marginTop: 12, color: "#b45309", fontSize: "0.9rem" }}>
            ⚠️ Les endpoints Peppol vendeur et/ou acheteur ne sont pas renseignés.
            L'envoi réseau est désactivé jusqu'à leur configuration.
          </p>
        )}

        {invoice.peppol_status === "delivered" && (
          <p style={{ marginTop: 12, color: "#16a34a", fontSize: "0.9rem" }}>
            ✓ Cette facture a été distribuée avec succès via le réseau Peppol.
          </p>
        )}

        {invoice.peppol_status === "rejected" && (
          <p style={{ marginTop: 12, color: "#dc2626", fontSize: "0.9rem" }}>
            ✗ Cette facture a été rejetée. Corrigez les erreurs et renvoyez-la.
          </p>
        )}
      </SectionCard>

      <SectionCard title="Totaux">
        <FormGrid columns="4">
          <Card>
            <h3 style={{ marginTop: 0 }}>HT</h3>
            <p style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: 0 }}>
              {Number(invoice.subtotal_ht).toFixed(2)} €
            </p>
          </Card>

          <Card>
            <h3 style={{ marginTop: 0 }}>TVA</h3>
            <p style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: 0 }}>
              {Number(invoice.total_tva).toFixed(2)} €
            </p>
          </Card>

          <Card>
            <h3 style={{ marginTop: 0 }}>TTC</h3>
            <p style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: 0 }}>
              {Number(invoice.total_ttc).toFixed(2)} €
            </p>
          </Card>

          <Card>
            <h3 style={{ marginTop: 0 }}>Solde restant</h3>
            <p style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: 0 }}>
              {Number(invoice.balance_due).toFixed(2)} €
            </p>
          </Card>
        </FormGrid>
      </SectionCard>

      {(invoice.customer_reference ||
        invoice.purchase_order_reference ||
        invoice.payment_terms ||
        invoice.notes) && (
        <SectionCard title="Informations complémentaires">
          <FormGrid columns="2">
            <Card>
              <h3 style={{ marginTop: 0 }}>Références</h3>
              <p><strong>Référence client :</strong> {invoice.customer_reference || "-"}</p>
              <p>
                <strong>Référence commande :</strong>{" "}
                {invoice.purchase_order_reference || "-"}
              </p>
            </Card>

            <Card>
              <h3 style={{ marginTop: 0 }}>Conditions</h3>
              <p><strong>Conditions de paiement :</strong> {invoice.payment_terms || "-"}</p>
              <p><strong>Notes :</strong> {invoice.notes || "-"}</p>
            </Card>
          </FormGrid>
        </SectionCard>
      )}

      {showPaymentForm && (
        <SectionCard title="Ajouter un paiement">
          <form onSubmit={handleRegisterPayment}>
            <FormGrid columns="2">
              <FormField label="Date de paiement">
                <TextInput
                  type="date"
                  value={paymentForm.payment_date}
                  onChange={(e) =>
                    updatePaymentField("payment_date", e.target.value)
                  }
                />
              </FormField>

              <FormField label="Montant">
                <TextInput
                  type="number"
                  step="0.01"
                  value={paymentForm.amount}
                  onChange={(e) => updatePaymentField("amount", e.target.value)}
                />
              </FormField>

              <FormField label="Mode de paiement">
                <Select
                  value={paymentForm.payment_method}
                  onChange={(e) =>
                    updatePaymentField("payment_method", e.target.value)
                  }
                >
                  <option value="bank_transfer">Virement</option>
                  <option value="cash">Espèces</option>
                  <option value="card">Carte</option>
                  <option value="check">Chèque</option>
                  <option value="other">Autre</option>
                </Select>
              </FormField>

              <FormField label="Référence">
                <TextInput
                  value={paymentForm.reference}
                  onChange={(e) => updatePaymentField("reference", e.target.value)}
                  placeholder="Communication / référence"
                />
              </FormField>
            </FormGrid>

            <FormField label="Notes">
              <TextArea
                rows={3}
                value={paymentForm.notes}
                onChange={(e) => updatePaymentField("notes", e.target.value)}
              />
            </FormField>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Button type="submit" disabled={savingPayment}>
                {savingPayment ? "Enregistrement..." : "Enregistrer le paiement"}
              </Button>

              <Button type="button" variant="secondary" onClick={closePaymentForm}>
                Annuler
              </Button>
            </div>
          </form>
        </SectionCard>
      )}

      <SectionCard title={`Lignes (${items.length})`}>
        {groupedItems.length === 0 ? (
          <EmptyState
            title="Aucune ligne"
            description="Cette facture ne contient aucune ligne."
          />
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {groupedItems.map((group) => (
              <div key={group.roomLabel}>
                <h3 style={{ marginBottom: 12 }}>{group.roomLabel}</h3>
                <DataTable
                  headers={
                    <tr>
                      <th>Libellé</th>
                      <th>Unité</th>
                      <th>Qté</th>
                      <th>PU HT</th>
                      <th>TVA</th>
                      <th>HT</th>
                      <th>TTC</th>
                    </tr>
                  }
                >
                  {group.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div>{item.label}</div>
                        {item.description && (
                          <div
                            style={{
                              marginTop: 4,
                              color: "#6b7280",
                              fontSize: "0.92rem",
                            }}
                          >
                            {item.description}
                          </div>
                        )}
                      </td>
                      <td>{item.unit}</td>
                      <td>{Number(item.quantity).toFixed(2)}</td>
                      <td>{Number(item.unit_price_ht).toFixed(2)} €</td>
                      <td>{Number(item.tva_rate).toFixed(2)} %</td>
                      <td>{Number(item.line_subtotal_ht).toFixed(2)} €</td>
                      <td>{Number(item.line_total_ttc).toFixed(2)} €</td>
                    </tr>
                  ))}
                </DataTable>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title={`Paiements (${payments.length})`}>
        {payments.length === 0 ? (
          <EmptyState
            title="Aucun paiement"
            description="Ajoute un paiement pour suivre le règlement de cette facture."
          />
        ) : (
          <DataTable
            headers={
              <tr>
                <th>Date</th>
                <th>Montant</th>
                <th>Méthode</th>
                <th>Référence</th>
                <th>Notes</th>
                <th />
              </tr>
            }
          >
            {payments.map((payment) => (
              <tr key={payment.id}>
                <td>{payment.payment_date}</td>
                <td>{Number(payment.amount).toFixed(2)} €</td>
                <td>{getPaymentMethodLabel(payment.payment_method)}</td>
                <td>{payment.reference || "-"}</td>
                <td>{payment.notes || "-"}</td>
                <td>
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    disabled={deletingPaymentId === payment.id}
                    onClick={() => handleDeletePayment(payment.id)}
                  >
                    {deletingPaymentId === payment.id
                      ? "Suppression..."
                      : "Supprimer"}
                  </Button>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </SectionCard>

      {error && <ErrorMessage message={error} />}
    </section>
  );
}