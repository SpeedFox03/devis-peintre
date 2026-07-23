export type QuotePdfCompany = {
  name: string;
  vat_number: string | null;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  website?: string | null;
  logo_url?: string | null;
};

export type QuotePdfCustomer = {
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

export type QuotePdfRoom = {
  id: string;
  name: string;
  sort_order: number;
  pdf_page_break: QuoteRoomPageBreak;
};

export type QuoteRoomPageBreak = "auto" | "keep" | "before";

export function resolveQuoteRoomPageBreak(
  value: unknown,
): QuoteRoomPageBreak {
  return value === "keep" || value === "before" ? value : "auto";
}

export type QuotePdfItem = {
  id: string;
  room_id: string | null;
  sort_order?: number;
  label: string;
  description: string | null;
  unit: string;
  quantity: number;
  unit_price_ht: number;
  tva_rate?: number;
};

export type QuoteItemInlineEdit = {
  label: string;
  quantity: number;
  unit_price_ht: number;
};

export type QuotePdfQuote = {
  quote_number: string;
  title: string;
  description: string | null;
  issue_date: string;
  valid_until: string | null;
  notes: string | null;
  terms: string | null;
  subtotal_ht: number;
  total_tva: number;
  total_ttc: number;
  tva_rate: number;
  pdf_font_size_adjustment?: number | null;
  pdf_other_section_position?: number | null;
};

export type QuotePdfData = {
  company: QuotePdfCompany | null;
  customer: QuotePdfCustomer | null;
  quote: QuotePdfQuote;
  rooms: QuotePdfRoom[];
  items: QuotePdfItem[];
  colorMode?: boolean | null;
  accentColor?: string | null;
  logoBase64?: string | null;
};


export type PdfTheme = "normal" | "aere" | "compact" | "elegant";

export const PDF_THEME_LABELS: Record<PdfTheme, string> = {
  normal:   "Normal",
  aere:     "Aéré",
  compact:  "Compact",
  elegant:  "Élégant",
};

export function isPdfTheme(value: unknown): value is PdfTheme {
  return value === "normal" || value === "aere" || value === "compact" || value === "elegant";
}

export function resolvePdfTheme(value: unknown): PdfTheme {
  return isPdfTheme(value) ? value : "normal";
}
