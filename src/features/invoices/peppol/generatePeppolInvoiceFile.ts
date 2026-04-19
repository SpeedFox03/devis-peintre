import { fetchInvoiceForPeppol } from "./fetchInvoiceForPeppol";
import { buildPeppolInvoiceXml, validatePeppolInvoiceInput } from "./buildPeppolInvoiceXml";

/**
 * Validates and builds the Peppol UBL XML for server-side use
 * (e.g. sending to an Access Point, storing in Supabase Storage).
 * Does NOT trigger a browser download — use exportPeppolInvoiceXml for that.
 */
export async function generatePeppolInvoiceFile(invoiceId: string): Promise<{
  fileName: string;
  xml: string;
}> {
  const { invoice, items } = await fetchInvoiceForPeppol(invoiceId);

  validatePeppolInvoiceInput({ invoice, items });
  const xml = buildPeppolInvoiceXml({ invoice, items });

  return {
    fileName: `${invoice.invoice_number}.xml`,
    xml,
  };
}