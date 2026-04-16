import { supabase } from "../../../lib/supabase";
import {
  buildPeppolInvoiceXml,
  validatePeppolInvoiceInput,
} from "./buildPeppolInvoiceXml";

export async function exportPeppolInvoiceXml(invoiceId: string): Promise<void> {
  const [invoiceRes, itemsRes] = await Promise.all([
    supabase
      .from("invoices")
      .select(`
        id,
        invoice_number,
        invoice_type,
        issue_date,
        due_date,
        currency_code,
        tax_currency_code,
        customer_reference,
        purchase_order_reference,
        payment_terms,
        notes,
        buyer_reference,
        subtotal_ht,
        discount_amount,
        total_tva,
        total_ttc,
        amount_paid,
        balance_due,
        peppol_customization_id,
        peppol_profile_id,
        seller_endpoint_id,
        seller_endpoint_scheme,
        buyer_endpoint_id,
        buyer_endpoint_scheme,
        seller_company_id,
        buyer_company_id,
        payment_means_code,
        payment_account_iban,
        payment_account_bic,
        payment_due_date,
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
        customer_billing_country_snapshot
      `)
      .eq("id", invoiceId)
      .single(),
    supabase
      .from("invoice_items")
      .select(`
        id,
        label,
        description,
        quantity,
        unit,
        unit_code,
        unit_price_ht,
        discount_amount,
        tva_rate,
        vat_category_code,
        tax_exemption_reason,
        line_subtotal_ht,
        line_total_tva,
        line_total_ttc,
        sort_order
      `)
      .eq("invoice_id", invoiceId)
      .order("sort_order", { ascending: true }),
  ]);

  if (invoiceRes.error) {
    throw new Error(invoiceRes.error.message);
  }

  if (itemsRes.error) {
    throw new Error(itemsRes.error.message);
  }

  const invoice = invoiceRes.data;
  const items = itemsRes.data ?? [];

  validatePeppolInvoiceInput({ invoice, items });
  const xml = buildPeppolInvoiceXml({ invoice, items });

  const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
  const fileName = `${invoice.invoice_number}.xml`;

  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}