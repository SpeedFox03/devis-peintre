import { fetchInvoiceForPeppol } from "./fetchInvoiceForPeppol";
import { buildPeppolInvoiceXml, validatePeppolInvoiceForExport } from "./buildPeppolInvoiceXml";
import { supabase } from "../../../lib/supabase";

/**
 * Valide, construit et déclenche le téléchargement du XML Peppol UBL.
 *
 * Utilise la validation export (minimale) : seuls le nom de l'entreprise,
 * le nom du client, le numéro de facture, la devise et les lignes sont requis.
 * Les endpoints Peppol et le payment means code ne sont PAS nécessaires
 * pour un simple export fichier importable par un logiciel tiers.
 *
 * Met aussi à jour peppol_status → "ready" et peppol_exported_at dans la DB.
 */
export async function exportPeppolInvoiceXml(invoiceId: string): Promise<void> {
  const { invoice, items } = await fetchInvoiceForPeppol(invoiceId);

  // Validation minimale — ne bloque pas sur les endpoints ou payment means
  validatePeppolInvoiceForExport({ invoice, items });

  // buildPeppolInvoiceXml sans l'option validateForNetwork → mode export
  const xml = buildPeppolInvoiceXml({ invoice, items });

  // Persist status change avant le téléchargement
  await supabase
    .from("invoices")
    .update({
      peppol_status: "ready",
      peppol_exported_at: new Date().toISOString(),
    })
    .eq("id", invoiceId);

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