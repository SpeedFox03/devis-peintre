export type SalesDocumentStatus = "draft" | "issued" | "cancelled" | "credited";
export type SalesDeliveryStatus =
  | "not_submitted"
  | "queued"
  | "submitted"
  | "cleared"
  | "succeeded"
  | "accepted"
  | "rejected"
  | "failed";
export type SalesPaymentStatus = "unpaid" | "partially_paid" | "paid";

export type CustomerSummary = {
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
};

export type InvoiceRow = {
  id: string;
  source_quote_id: string | null;
  document_number: string | null;
  document_status: SalesDocumentStatus;
  delivery_status: SalesDeliveryStatus;
  payment_status: SalesPaymentStatus;
  issue_date: string | null;
  due_date: string | null;
  total_ttc: number;
  payable_amount: number;
  created_at: string;
  customer: CustomerSummary | null;
};

export type AcceptedQuote = {
  id: string;
  quote_number: string;
  title: string;
  total_ttc: number;
  customer: CustomerSummary | null;
};

export type InvoiceDetail = {
  id: string;
  company_id: string;
  customer_id: string;
  source_quote_id: string | null;
  document_number: string | null;
  document_status: SalesDocumentStatus;
  delivery_status: SalesDeliveryStatus;
  payment_status: SalesPaymentStatus;
  issue_date: string | null;
  due_date: string | null;
  currency_code: string;
  customer_reference: string | null;
  payment_terms: string | null;
  payment_account_iban: string | null;
  notes: string | null;
  seller_snapshot: Record<string, unknown>;
  buyer_snapshot: Record<string, unknown>;
  subtotal_ht: number;
  total_tax: number;
  total_ttc: number;
  payable_amount: number;
  metadata: Record<string, unknown>;
  created_at: string;
  customer: CustomerSummary | null;
};

export type InvoiceLine = {
  id: string;
  position: number;
  room_label: string | null;
  label: string;
  description: string | null;
  quantity: number;
  unit_label: string | null;
  unit_price_ht: number;
  line_extension_amount: number;
  vat_rate: number;
  tax_amount: number;
};

export type StorecovePreview = {
  environment: "sandbox" | "production";
  ready: boolean;
  blockingIssues: string[];
  warnings: string[];
  payload: Record<string, unknown>;
};
