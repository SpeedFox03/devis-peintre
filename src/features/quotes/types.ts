export type QuoteStatus =
  | "draft"
  | "sent"
  | "accepted"
  | "rejected"
  | "expired"
  | "invoiced";

export type QuoteDetails = {
  id: string;
  quote_number: string;
  title: string;
  description: string | null;
  status: QuoteStatus;
  issue_date: string;
  valid_until: string | null;
  tva_rate: number;
  notes: string | null;
  terms: string | null;
  subtotal_ht: number;
  total_tva: number;
  total_ttc: number;
  customer_id: string;
  company_id: string;
};

export type QuoteItem = {
  id: string;
  quote_id: string;
  room_id: string | null;
  item_type: string;
  category: string | null;
  label: string;
  description: string | null;
  unit: string;
  quantity: number;
  unit_price_ht: number;
  tva_rate: number;
  sort_order: number;
};

export type Room = {
  id: string;
  name: string;
  sort_order: number;
};

export type Company = {
  id: string;
  name: string;
  vat_number: string | null;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  default_tva_rate: number | null;
  default_quote_validity_days: number | null;
  default_notes: string | null;
  default_terms: string | null;
  pdf_theme: string;   // "normal" | "aere" | "compact"
  pdf_color_mode: boolean;
  logo_url: string | null;
  accent_color: string | null;
};

export type Customer = {
  id: string;
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  billing_address_line1: string | null;
  billing_address_line2: string | null;
  billing_postal_code: string | null;
  billing_city: string | null;
  billing_country: string | null;
  jobsite_address_line1: string | null;
  jobsite_address_line2: string | null;
  jobsite_postal_code: string | null;
  jobsite_city: string | null;
  jobsite_country: string | null;
};

export type QuoteItemFormState = {
  room_id: string;
  item_type: string;
  category: string;
  label: string;
  description: string;
  unit: string;
  quantity: string;
  unit_price_ht: string;
  tva_rate: string;
};

export type RoomFormState = {
  name: string;
  notes: string;
};

export type QuoteGeneralFormState = {
  title: string;
  description: string;
  status: QuoteStatus;
  issue_date: string;
  valid_until: string;
  tva_rate: string;
  notes: string;
  terms: string;
};

export function getQuoteStatusLabel(status: QuoteStatus) {
  switch (status) {
    case "draft":
      return "Brouillon";
    case "sent":
      return "Envoyé";
    case "accepted":
      return "Accepté";
    case "rejected":
      return "Refusé";
    case "expired":
      return "Expiré";
    case "invoiced":
      return "Facturé";
    default:
      return status;
  }
}