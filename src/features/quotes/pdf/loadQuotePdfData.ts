import { supabase } from "../../../lib/supabase";
import type { QuotePdfData } from "./quotePdfTypes";

type LoadedQuotePdfData = {
  data: Omit<QuotePdfData, "logoBase64">;
  theme: string | null;
  colorMode: boolean | null;
  accentColor: string | null;
};

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function requireData<T>(data: T | null, error: { message: string } | null, label: string): T {
  throwIfError(error);
  if (!data) throw new Error(`${label} introuvable.`);
  return data;
}

export async function loadQuotePdfData(quoteId: string): Promise<LoadedQuotePdfData> {
  const quoteRes = await supabase
    .from("quotes")
    .select(
      "quote_number, title, description, issue_date, valid_until, notes, terms, subtotal_ht, total_tva, total_ttc, tva_rate, pdf_font_size_adjustment, pdf_other_section_position, customer_id, company_id",
    )
    .eq("id", quoteId)
    .single();

  const quote = requireData(quoteRes.data, quoteRes.error, "Devis");

  const [
    itemsRes,
    roomsRes,
    companyRes,
    companySettingsRes,
    companyAddressRes,
    customerRes,
    customerAddressesRes,
  ] = await Promise.all([
    supabase
      .from("quote_items")
      .select("id, room_id, sort_order, label, description, unit, quantity, unit_price_ht, tva_rate")
      .eq("quote_id", quoteId)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true }),
    supabase
      .from("quote_rooms")
      .select("id, name, sort_order, pdf_page_break")
      .eq("quote_id", quoteId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("companies")
      .select("name, vat_number, email, phone, website, logo_url")
      .eq("id", quote.company_id)
      .single(),
    supabase
      .from("company_settings")
      .select("pdf_theme, pdf_color_mode, pdf_accent_color")
      .eq("company_id", quote.company_id)
      .maybeSingle(),
    supabase
      .from("addresses")
      .select("line1, line2, postal_code, city, country")
      .eq("entity_id", quote.company_id)
      .eq("entity_type", "company")
      .eq("role", "main")
      .maybeSingle(),
    supabase
      .from("customers")
      .select("company_name, first_name, last_name, email, phone")
      .eq("id", quote.customer_id)
      .single(),
    supabase
      .from("addresses")
      .select("role, line1, line2, postal_code, city, country")
      .eq("entity_id", quote.customer_id)
      .eq("entity_type", "customer"),
  ]);

  [
    itemsRes.error,
    roomsRes.error,
    companyRes.error,
    companySettingsRes.error,
    companyAddressRes.error,
    customerRes.error,
    customerAddressesRes.error,
  ].forEach(throwIfError);

  const company = requireData(companyRes.data, companyRes.error, "Entreprise");
  const customer = requireData(customerRes.data, customerRes.error, "Client");
  const companyAddress = companyAddressRes.data;
  const customerAddresses = customerAddressesRes.data ?? [];
  const billingAddress = customerAddresses.find((address) => address.role === "billing");
  const jobsiteAddress = customerAddresses.find((address) => address.role === "jobsite");

  return {
    data: {
      company: {
        ...company,
        address_line1: companyAddress?.line1 ?? null,
        address_line2: companyAddress?.line2 ?? null,
        postal_code: companyAddress?.postal_code ?? null,
        city: companyAddress?.city ?? null,
        country: companyAddress?.country ?? null,
      },
      customer: {
        ...customer,
        billing_address_line1: billingAddress?.line1 ?? null,
        billing_address_line2: billingAddress?.line2 ?? null,
        billing_postal_code: billingAddress?.postal_code ?? null,
        billing_city: billingAddress?.city ?? null,
        billing_country: billingAddress?.country ?? null,
        jobsite_address_line1: jobsiteAddress?.line1 ?? null,
        jobsite_address_line2: jobsiteAddress?.line2 ?? null,
        jobsite_postal_code: jobsiteAddress?.postal_code ?? null,
        jobsite_city: jobsiteAddress?.city ?? null,
        jobsite_country: jobsiteAddress?.country ?? null,
      },
      quote: {
        quote_number: quote.quote_number,
        title: quote.title,
        description: quote.description,
        issue_date: quote.issue_date,
        valid_until: quote.valid_until,
        notes: quote.notes,
        terms: quote.terms,
        subtotal_ht: quote.subtotal_ht,
        total_tva: quote.total_tva,
        total_ttc: quote.total_ttc,
        tva_rate: quote.tva_rate,
        pdf_font_size_adjustment: quote.pdf_font_size_adjustment,
        pdf_other_section_position: quote.pdf_other_section_position,
      },
      rooms: roomsRes.data ?? [],
      items: itemsRes.data ?? [],
    },
    theme: companySettingsRes.data?.pdf_theme ?? null,
    colorMode: companySettingsRes.data?.pdf_color_mode ?? true,
    accentColor: companySettingsRes.data?.pdf_accent_color ?? null,
  };
}
