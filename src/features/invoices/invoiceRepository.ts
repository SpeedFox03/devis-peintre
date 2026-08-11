import { supabase } from "../../lib/supabase";
import type {
  AcceptedQuote,
  CustomerSummary,
  InvoiceDetail,
  InvoiceLine,
  InvoiceRow,
  StorecovePreview,
} from "./types";

type CustomerRelation = CustomerSummary | CustomerSummary[] | null;

function firstCustomer(value: CustomerRelation) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export async function loadInvoicesPage() {
  const [documentsResult, quotesResult] = await Promise.all([
    supabase
      .from("sales_documents")
      .select("id, source_quote_id, document_number, document_status, delivery_status, payment_status, issue_date, due_date, total_ttc, payable_amount, created_at, customer:customers!sales_documents_customer_company_fk(company_name, first_name, last_name)")
      .eq("document_kind", "invoice")
      .order("created_at", { ascending: false }),
    supabase
      .from("quotes")
      .select("id, quote_number, title, total_ttc, customers(company_name, first_name, last_name)")
      .eq("status", "accepted")
      .order("updated_at", { ascending: false }),
  ]);

  const error = documentsResult.error ?? quotesResult.error;
  if (error) throw error;

  const invoices = (documentsResult.data ?? []).map((row) => ({
    ...row,
    customer: firstCustomer(row.customer as CustomerRelation),
  })) as InvoiceRow[];
  const usedQuoteIds = new Set(invoices.map((invoice) => invoice.source_quote_id).filter(Boolean));
  const acceptedQuotes = (quotesResult.data ?? [])
    .filter((quote) => !usedQuoteIds.has(quote.id))
    .map((quote) => ({
      id: quote.id,
      quote_number: quote.quote_number,
      title: quote.title,
      total_ttc: Number(quote.total_ttc),
      customer: firstCustomer(quote.customers as CustomerRelation),
    })) as AcceptedQuote[];

  return { invoices, acceptedQuotes };
}

export async function createInvoiceFromQuote(quoteId: string) {
  const { data, error } = await supabase.rpc("create_sales_document_from_quote", {
    p_quote_id: quoteId,
  });
  if (error) throw error;
  return String(data);
}

export async function loadInvoiceDetail(invoiceId: string) {
  const [documentResult, linesResult, submissionsResult, eventsResult] = await Promise.all([
    supabase
      .from("sales_documents")
      .select("id, company_id, customer_id, source_quote_id, document_number, document_status, delivery_status, payment_status, issue_date, due_date, currency_code, customer_reference, payment_terms, payment_account_iban, notes, seller_snapshot, buyer_snapshot, subtotal_ht, total_tax, total_ttc, payable_amount, metadata, created_at, customer:customers!sales_documents_customer_company_fk(company_name, first_name, last_name)")
      .eq("id", invoiceId)
      .single(),
    supabase
      .from("sales_document_lines")
      .select("id, position, room_label, label, description, quantity, unit_label, unit_price_ht, line_extension_amount, vat_rate, tax_amount")
      .eq("document_id", invoiceId)
      .order("position"),
    supabase
      .from("einvoice_submissions")
      .select("id, environment, status, network, requested_at, submitted_at, completed_at, error_message")
      .eq("document_id", invoiceId)
      .order("created_at", { ascending: false }),
    supabase
      .from("einvoice_events")
      .select("id, event_name, details, received_at")
      .eq("document_id", invoiceId)
      .order("received_at", { ascending: false })
      .limit(20),
  ]);

  const error = documentResult.error ?? linesResult.error ?? submissionsResult.error ?? eventsResult.error;
  if (error) throw error;
  if (!documentResult.data) throw new Error("Facture introuvable.");

  const document = {
    ...documentResult.data,
    customer: firstCustomer(documentResult.data.customer as CustomerRelation),
  } as InvoiceDetail;

  return {
    document,
    lines: (linesResult.data ?? []) as InvoiceLine[],
    submissions: submissionsResult.data ?? [],
    events: eventsResult.data ?? [],
  };
}

export async function issueInvoice(invoiceId: string, issueDate: string, dueDate: string) {
  const { data, error } = await supabase.rpc("issue_sales_document", {
    p_document_id: invoiceId,
    p_issue_date: issueDate,
    p_due_date: dueDate,
  });
  if (error) throw error;
  return String(data);
}

export async function previewStorecoveInvoice(invoiceId: string) {
  const { data, error } = await supabase.functions.invoke("invoice-storecove-preview", {
    body: { documentId: invoiceId, environment: "sandbox" },
  });
  if (error) throw await getFunctionError(error);
  return data as StorecovePreview;
}

export async function submitStorecoveInvoice(invoiceId: string) {
  const { data, error } = await supabase.functions.invoke("invoice-storecove-submit", {
    body: { documentId: invoiceId, environment: "sandbox" },
  });
  if (error) throw await getFunctionError(error);
  return data as { ok: true; submissionId: string; providerGuid: string; status: string };
}

async function getFunctionError(error: unknown) {
  const context = (error as { context?: Response })?.context;
  if (context && typeof context.clone === "function") {
    try {
      const payload = await context.clone().json() as { error?: string };
      if (payload.error) return new Error(payload.error);
    } catch {
      // La réponse n'est pas du JSON : le message SDK reste le meilleur détail disponible.
    }
  }
  return error instanceof Error ? error : new Error("La fonction serveur a échoué.");
}
