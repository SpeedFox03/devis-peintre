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
};

export type QuotePdfItem = {
  id: string;
  room_id: string | null;
  label: string;
  description: string | null;
  unit: string;
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
};

export type QuotePdfData = {
  company: QuotePdfCompany | null;
  customer: QuotePdfCustomer | null;
  quote: QuotePdfQuote;
  rooms: QuotePdfRoom[];
  items: QuotePdfItem[];
}; 