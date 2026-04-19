 export type InvoiceType = "invoice" | "deposit" | "final" | "credit_note";

export type PeppolInvoice = {
  id: string;
  invoice_number: string;
  invoice_type: InvoiceType;
  issue_date: string;
  due_date: string | null;
  currency_code: string;
  tax_currency_code: string | null;

  customer_reference: string | null;
  purchase_order_reference: string | null;
  payment_terms: string | null;
  notes: string | null;
  buyer_reference: string | null;

  subtotal_ht: number;
  discount_amount: number;
  total_tva: number;
  total_ttc: number;
  amount_paid: number;
  balance_due: number;

  peppol_customization_id: string;
  peppol_profile_id: string;

  seller_endpoint_id: string | null;
  seller_endpoint_scheme: string | null;
  buyer_endpoint_id: string | null;
  buyer_endpoint_scheme: string | null;

  seller_company_id: string | null;
  buyer_company_id: string | null;

  payment_means_code: string | null;
  payment_account_iban: string | null;
  payment_account_bic: string | null;
  payment_due_date: string | null;

  /**
   * For credit_note: the invoice_number of the original invoice being credited.
   * Required when invoice_type === "credit_note".
   */
  source_invoice_number: string | null;

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
};

export type PeppolInvoiceItem = {
  id: string;
  label: string;
  description: string | null;
  quantity: number;
  unit: string;
  unit_code: string | null;
  unit_price_ht: number;
  discount_amount: number;
  tva_rate: number;
  vat_category_code: string;
  tax_exemption_reason: string | null;
  line_subtotal_ht: number;
  line_total_tva: number;
  line_total_ttc: number;
  sort_order: number;
};

export type BuildPeppolInvoiceInput = {
  invoice: PeppolInvoice;
  items: PeppolInvoiceItem[];
};

export type PeppolValidationError = {
  field: string;
  message: string;
};

// ---------------------------------------------------------------------------
// Low-level XML helpers
// ---------------------------------------------------------------------------

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function xmlTag(tag: string, value: string | null | undefined): string {
  if (value == null || value === "") return "";
  return `<${tag}>${escapeXml(value)}</${tag}>`;
}

function xmlTagWithAttrs(
  tag: string,
  value: string | null | undefined,
  attrs: Record<string, string | null | undefined>
): string {
  if (value == null || value === "") return "";

  const attrString = Object.entries(attrs)
    .filter(([, attrValue]) => attrValue != null && attrValue !== "")
    .map(([key, attrValue]) => ` ${key}="${escapeXml(String(attrValue))}"`)
    .join("");

  return `<${tag}${attrString}>${escapeXml(value)}</${tag}>`;
}

function formatAmount(value: number): string {
  return Number(value || 0).toFixed(2);
}

function formatQuantity(value: number): string {
  return Number(value || 0).toFixed(6);
}

// ---------------------------------------------------------------------------
// Validation — pure, no XML build side-effect
// ---------------------------------------------------------------------------

/**
 * Returns a list of validation errors for the given Peppol invoice input.
 * Does NOT throw. Does NOT call buildPeppolInvoiceXml.
 */
export function getPeppolValidationErrors({
  invoice,
  items,
}: BuildPeppolInvoiceInput): PeppolValidationError[] {
  const errors: PeppolValidationError[] = [];

  function required(value: string | null | undefined, field: string, label: string) {
    if (!value?.trim()) {
      errors.push({ field, message: `Champ obligatoire manquant : ${label}` });
    }
  }

  // Document-level required fields
  required(invoice.invoice_number, "invoice_number", "Numéro de facture");
  required(invoice.issue_date, "issue_date", "Date d'émission");
  required(invoice.currency_code, "currency_code", "Devise");
  required(invoice.peppol_customization_id, "peppol_customization_id", "CustomizationID Peppol");
  required(invoice.peppol_profile_id, "peppol_profile_id", "ProfileID Peppol");
  required(invoice.payment_means_code, "payment_means_code", "Code moyen de paiement");

  // Endpoints
  required(invoice.seller_endpoint_id, "seller_endpoint_id", "Endpoint ID vendeur");
  required(invoice.seller_endpoint_scheme, "seller_endpoint_scheme", "Scheme endpoint vendeur");
  required(invoice.buyer_endpoint_id, "buyer_endpoint_id", "Endpoint ID acheteur");
  required(invoice.buyer_endpoint_scheme, "buyer_endpoint_scheme", "Scheme endpoint acheteur");

  // Seller party
  required(invoice.company_name_snapshot, "company_name_snapshot", "Nom de l'entreprise");

  // Buyer party
  const hasCompanyName = invoice.customer_company_name_snapshot?.trim();
  const hasPersonName =
    invoice.customer_first_name_snapshot?.trim() ||
    invoice.customer_last_name_snapshot?.trim();

  if (!hasCompanyName && !hasPersonName) {
    errors.push({ field: "customer_name", message: "Nom du client manquant." });
  }

  // Credit note: reference to original invoice is mandatory
  if (invoice.invoice_type === "credit_note") {
    required(
      invoice.source_invoice_number,
      "source_invoice_number",
      "Numéro de la facture d'origine (avoir)"
    );
  }

  // Amounts
  if (Number(invoice.total_ttc || 0) < Number(invoice.amount_paid || 0)) {
    errors.push({
      field: "amount_paid",
      message: "Le montant payé ne peut pas dépasser le total TTC.",
    });
  }

  // Items
  if (items.length === 0) {
    errors.push({ field: "items", message: "La facture ne contient aucune ligne." });
  }

  for (const item of items) {
    const lineRef = item.label?.trim() || `id=${item.id}`;

    if (!item.label?.trim()) {
      errors.push({ field: `item.${item.id}.label`, message: `Ligne sans libellé (id=${item.id}).` });
    }

    if (Number(item.quantity) < 0) {
      errors.push({ field: `item.${item.id}.quantity`, message: `Quantité négative sur la ligne "${lineRef}".` });
    }

    if (Number(item.unit_price_ht) < 0) {
      errors.push({ field: `item.${item.id}.unit_price_ht`, message: `Prix unitaire négatif sur la ligne "${lineRef}".` });
    }

    if (!item.vat_category_code?.trim()) {
      errors.push({ field: `item.${item.id}.vat_category_code`, message: `Catégorie TVA manquante sur la ligne "${lineRef}".` });
    }
  }

  return errors;
}

/**
 * Throws an aggregated Error if any validation errors are found.
 */
export function validatePeppolInvoiceInput(input: BuildPeppolInvoiceInput): void {
  const errors = getPeppolValidationErrors(input);
  if (errors.length > 0) {
    throw new Error(errors.map((e) => e.message).join("\n"));
  }
}

// ---------------------------------------------------------------------------
// Party / section builders
// ---------------------------------------------------------------------------

function toIsoCountryCode(value: string | null | undefined): string {
  const normalized = (value || "").trim().toLowerCase();

  switch (normalized) {
    case "be":
    case "belgique":
    case "belgium":
      return "BE";
    case "fr":
    case "france":
      return "FR";
    case "nl":
    case "nederland":
    case "netherlands":
    case "pays-bas":
      return "NL";
    case "lu":
    case "luxembourg":
      return "LU";
    case "de":
    case "germany":
    case "allemagne":
      return "DE";
    default:
      if (normalized.length === 2) return normalized.toUpperCase();
      throw new Error(
        `Code pays invalide ou non mappé pour l'e-facture : "${value ?? ""}"`
      );
  }
}

function requireField(value: string | null | undefined, label: string): string {
  if (!value || !value.trim()) {
    throw new Error(`Champ obligatoire manquant pour l'e-facture : ${label}`);
  }
  return value.trim();
}

function getCustomerPartyName(invoice: PeppolInvoice): string {
  if (invoice.customer_company_name_snapshot?.trim()) {
    return invoice.customer_company_name_snapshot.trim();
  }

  const fullName = [
    invoice.customer_first_name_snapshot?.trim(),
    invoice.customer_last_name_snapshot?.trim(),
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (!fullName) throw new Error("Nom du client manquant pour l'e-facture.");
  return fullName;
}

function buildPartyAddress(
  addressLine1: string | null,
  addressLine2: string | null,
  city: string | null,
  postalCode: string | null,
  country: string | null
): string {
  const countryCode = toIsoCountryCode(country);

  return `
    <cac:PostalAddress>
      ${xmlTag("cbc:StreetName", addressLine1 || "")}
      ${xmlTag("cbc:AdditionalStreetName", addressLine2 || "")}
      ${xmlTag("cbc:CityName", city || "")}
      ${xmlTag("cbc:PostalZone", postalCode || "")}
      <cac:Country>
        <cbc:IdentificationCode>${escapeXml(countryCode)}</cbc:IdentificationCode>
      </cac:Country>
    </cac:PostalAddress>
  `;
}

function buildSupplierParty(invoice: PeppolInvoice): string {
  const endpointId = requireField(invoice.seller_endpoint_id, "seller_endpoint_id");
  const endpointScheme = requireField(invoice.seller_endpoint_scheme, "seller_endpoint_scheme");
  const supplierName = requireField(invoice.company_name_snapshot, "company_name_snapshot");

  return `
    <cac:AccountingSupplierParty>
      <cac:Party>
        ${xmlTagWithAttrs("cbc:EndpointID", endpointId, { schemeID: endpointScheme })}
        ${invoice.seller_company_id ? `
        <cac:PartyIdentification>
          <cbc:ID>${escapeXml(invoice.seller_company_id)}</cbc:ID>
        </cac:PartyIdentification>` : ""}
        <cac:PartyName>
          <cbc:Name>${escapeXml(supplierName)}</cbc:Name>
        </cac:PartyName>
        ${buildPartyAddress(
          invoice.company_address_line1_snapshot,
          invoice.company_address_line2_snapshot,
          invoice.company_city_snapshot,
          invoice.company_postal_code_snapshot,
          invoice.company_country_snapshot
        )}
        ${invoice.company_vat_number_snapshot ? `
        <cac:PartyTaxScheme>
          <cbc:CompanyID>${escapeXml(invoice.company_vat_number_snapshot)}</cbc:CompanyID>
          <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
        </cac:PartyTaxScheme>` : ""}
        <cac:PartyLegalEntity>
          <cbc:RegistrationName>${escapeXml(supplierName)}</cbc:RegistrationName>
          ${xmlTag("cbc:CompanyID", invoice.seller_company_id || "")}
        </cac:PartyLegalEntity>
        <cac:Contact>
          ${xmlTag("cbc:Telephone", invoice.company_phone_snapshot || "")}
          ${xmlTag("cbc:ElectronicMail", invoice.company_email_snapshot || "")}
        </cac:Contact>
      </cac:Party>
    </cac:AccountingSupplierParty>
  `;
}

function buildCustomerParty(invoice: PeppolInvoice): string {
  const endpointId = requireField(invoice.buyer_endpoint_id, "buyer_endpoint_id");
  const endpointScheme = requireField(invoice.buyer_endpoint_scheme, "buyer_endpoint_scheme");
  const customerName = getCustomerPartyName(invoice);

  return `
    <cac:AccountingCustomerParty>
      <cac:Party>
        ${xmlTagWithAttrs("cbc:EndpointID", endpointId, { schemeID: endpointScheme })}
        ${invoice.buyer_company_id ? `
        <cac:PartyIdentification>
          <cbc:ID>${escapeXml(invoice.buyer_company_id)}</cbc:ID>
        </cac:PartyIdentification>` : ""}
        <cac:PartyName>
          <cbc:Name>${escapeXml(customerName)}</cbc:Name>
        </cac:PartyName>
        ${buildPartyAddress(
          invoice.customer_billing_address_line1_snapshot,
          invoice.customer_billing_address_line2_snapshot,
          invoice.customer_billing_city_snapshot,
          invoice.customer_billing_postal_code_snapshot,
          invoice.customer_billing_country_snapshot
        )}
        ${invoice.buyer_company_id ? `
        <cac:PartyTaxScheme>
          <cbc:CompanyID>${escapeXml(invoice.buyer_company_id)}</cbc:CompanyID>
          <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
        </cac:PartyTaxScheme>` : ""}
        <cac:PartyLegalEntity>
          <cbc:RegistrationName>${escapeXml(customerName)}</cbc:RegistrationName>
          ${xmlTag("cbc:CompanyID", invoice.buyer_company_id || "")}
        </cac:PartyLegalEntity>
        <cac:Contact>
          ${xmlTag("cbc:Telephone", invoice.customer_phone_snapshot || "")}
          ${xmlTag("cbc:ElectronicMail", invoice.customer_email_snapshot || "")}
        </cac:Contact>
      </cac:Party>
    </cac:AccountingCustomerParty>
  `;
}

/**
 * BT-13 / BG-3 — Delivery address (jobsite).
 * Optional: only emitted when at least city or postal code is present.
 */
function buildDelivery(invoice: PeppolInvoice): string {
  const hasJobsite =
    invoice.customer_jobsite_address_line1_snapshot?.trim() ||
    invoice.customer_jobsite_city_snapshot?.trim() ||
    invoice.customer_jobsite_postal_code_snapshot?.trim();

  if (!hasJobsite) return "";

  return `
    <cac:Delivery>
      <cac:DeliveryLocation>
        ${buildPartyAddress(
          invoice.customer_jobsite_address_line1_snapshot,
          invoice.customer_jobsite_address_line2_snapshot,
          invoice.customer_jobsite_city_snapshot,
          invoice.customer_jobsite_postal_code_snapshot,
          invoice.customer_jobsite_country_snapshot
        )}
      </cac:DeliveryLocation>
    </cac:Delivery>
  `;
}

function buildPaymentMeans(invoice: PeppolInvoice): string {
  const paymentMeansCode = requireField(invoice.payment_means_code, "payment_means_code");
  const iban = invoice.payment_account_iban || invoice.company_iban_snapshot || null;
  const bic = invoice.payment_account_bic || invoice.company_bic_snapshot || null;

  return `
    <cac:PaymentMeans>
      <cbc:PaymentMeansCode>${escapeXml(paymentMeansCode)}</cbc:PaymentMeansCode>
      ${xmlTag("cbc:PaymentDueDate", invoice.payment_due_date || invoice.due_date || "")}
      ${iban ? `
      <cac:PayeeFinancialAccount>
        <cbc:ID>${escapeXml(iban)}</cbc:ID>
        ${bic ? `
        <cac:FinancialInstitutionBranch>
          <cbc:ID>${escapeXml(bic)}</cbc:ID>
        </cac:FinancialInstitutionBranch>` : ""}
      </cac:PayeeFinancialAccount>` : ""}
    </cac:PaymentMeans>
  `;
}

function buildTaxTotal(invoice: PeppolInvoice, items: PeppolInvoiceItem[]): string {
  const groupedByVat = new Map<
    string,
    {
      taxableAmount: number;
      taxAmount: number;
      percent: number;
      categoryCode: string;
      exemptionReason: string | null;
    }
  >();

  for (const item of items) {
    const key = `${item.vat_category_code}|${item.tva_rate}|${item.tax_exemption_reason || ""}`;
    const current = groupedByVat.get(key) ?? {
      taxableAmount: 0,
      taxAmount: 0,
      percent: item.tva_rate,
      categoryCode: item.vat_category_code,
      exemptionReason: item.tax_exemption_reason,
    };

    current.taxableAmount += Number(item.line_subtotal_ht || 0);
    current.taxAmount += Number(item.line_total_tva || 0);

    groupedByVat.set(key, current);
  }

  const subtotals = Array.from(groupedByVat.values())
    .map(
      (group) => `
      <cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="${escapeXml(invoice.currency_code)}">${formatAmount(group.taxableAmount)}</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="${escapeXml(invoice.currency_code)}">${formatAmount(group.taxAmount)}</cbc:TaxAmount>
        <cac:TaxCategory>
          <cbc:ID>${escapeXml(group.categoryCode)}</cbc:ID>
          <cbc:Percent>${formatAmount(group.percent)}</cbc:Percent>
          ${xmlTag("cbc:TaxExemptionReason", group.exemptionReason || "")}
          <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
        </cac:TaxCategory>
      </cac:TaxSubtotal>
    `
    )
    .join("");

  return `
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="${escapeXml(invoice.currency_code)}">${formatAmount(invoice.total_tva)}</cbc:TaxAmount>
      ${subtotals}
    </cac:TaxTotal>
  `;
}

function buildLegalMonetaryTotal(invoice: PeppolInvoice): string {
  return `
    <cac:LegalMonetaryTotal>
      <cbc:LineExtensionAmount currencyID="${escapeXml(invoice.currency_code)}">${formatAmount(invoice.subtotal_ht)}</cbc:LineExtensionAmount>
      <cbc:TaxExclusiveAmount currencyID="${escapeXml(invoice.currency_code)}">${formatAmount(invoice.subtotal_ht)}</cbc:TaxExclusiveAmount>
      <cbc:TaxInclusiveAmount currencyID="${escapeXml(invoice.currency_code)}">${formatAmount(invoice.total_ttc)}</cbc:TaxInclusiveAmount>
      <cbc:AllowanceTotalAmount currencyID="${escapeXml(invoice.currency_code)}">${formatAmount(invoice.discount_amount)}</cbc:AllowanceTotalAmount>
      <cbc:PrepaidAmount currencyID="${escapeXml(invoice.currency_code)}">${formatAmount(invoice.amount_paid)}</cbc:PrepaidAmount>
      <cbc:PayableAmount currencyID="${escapeXml(invoice.currency_code)}">${formatAmount(invoice.balance_due)}</cbc:PayableAmount>
    </cac:LegalMonetaryTotal>
  `;
}

function buildInvoiceLine(
  invoice: PeppolInvoice,
  item: PeppolInvoiceItem,
  index: number
): string {
  const unitCode = item.unit_code || "C62";

  return `
    <cac:InvoiceLine>
      <cbc:ID>${index + 1}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="${escapeXml(unitCode)}">${formatQuantity(item.quantity)}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="${escapeXml(invoice.currency_code)}">${formatAmount(item.line_subtotal_ht)}</cbc:LineExtensionAmount>
      ${Number(item.discount_amount || 0) > 0 ? `
      <cac:AllowanceCharge>
        <cbc:ChargeIndicator>false</cbc:ChargeIndicator>
        <cbc:Amount currencyID="${escapeXml(invoice.currency_code)}">${formatAmount(item.discount_amount)}</cbc:Amount>
      </cac:AllowanceCharge>` : ""}
      <cac:Item>
        <cbc:Name>${escapeXml(item.label)}</cbc:Name>
        ${xmlTag("cbc:Description", item.description || "")}
        <cac:ClassifiedTaxCategory>
          <cbc:ID>${escapeXml(item.vat_category_code)}</cbc:ID>
          <cbc:Percent>${formatAmount(item.tva_rate)}</cbc:Percent>
          ${xmlTag("cbc:TaxExemptionReason", item.tax_exemption_reason || "")}
          <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
        </cac:ClassifiedTaxCategory>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="${escapeXml(invoice.currency_code)}">${formatAmount(item.unit_price_ht)}</cbc:PriceAmount>
      </cac:Price>
    </cac:InvoiceLine>
  `;
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

export function buildPeppolInvoiceXml({
  invoice,
  items,
}: BuildPeppolInvoiceInput): string {
  // Run validation before building — throws on first aggregated error list
  validatePeppolInvoiceInput({ invoice, items });

  const customizationId = requireField(invoice.peppol_customization_id, "peppol_customization_id");
  const profileId = requireField(invoice.peppol_profile_id, "peppol_profile_id");
  const invoiceNumber = requireField(invoice.invoice_number, "invoice_number");
  const issueDate = requireField(invoice.issue_date, "issue_date");
  const currencyCode = requireField(invoice.currency_code, "currency_code");

  const note = invoice.notes?.trim() || null;
  const buyerReference =
    invoice.buyer_reference?.trim() ||
    invoice.customer_reference?.trim() ||
    null;

  // UBL type code: 380 = invoice, 381 = credit note
  const invoiceTypeCode = invoice.invoice_type === "credit_note" ? "381" : "380";

  const sortedItems = [...items].sort((a, b) => a.sort_order - b.sort_order);

  // BG-3: BillingReference — mandatory for credit notes (EN 16931 rule BR-55)
  const billingReference =
    invoice.invoice_type === "credit_note" && invoice.source_invoice_number
      ? `
  <cac:BillingReference>
    <cac:InvoiceDocumentReference>
      <cbc:ID>${escapeXml(invoice.source_invoice_number)}</cbc:ID>
    </cac:InvoiceDocumentReference>
  </cac:BillingReference>`
      : "";

  const invoiceLinesXml = sortedItems
    .map((item, index) => buildInvoiceLine(invoice, item, index))
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice
  xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>${escapeXml(customizationId)}</cbc:CustomizationID>
  <cbc:ProfileID>${escapeXml(profileId)}</cbc:ProfileID>
  <cbc:ID>${escapeXml(invoiceNumber)}</cbc:ID>
  <cbc:IssueDate>${escapeXml(issueDate)}</cbc:IssueDate>
  ${xmlTag("cbc:DueDate", invoice.due_date || "")}
  <cbc:InvoiceTypeCode>${invoiceTypeCode}</cbc:InvoiceTypeCode>
  ${xmlTag("cbc:Note", note)}
  <cbc:DocumentCurrencyCode>${escapeXml(currencyCode)}</cbc:DocumentCurrencyCode>
  ${xmlTag("cbc:TaxCurrencyCode", invoice.tax_currency_code || "")}
  ${xmlTag("cbc:BuyerReference", buyerReference)}
  ${invoice.purchase_order_reference ? `
  <cac:OrderReference>
    <cbc:ID>${escapeXml(invoice.purchase_order_reference)}</cbc:ID>
  </cac:OrderReference>` : ""}
  ${billingReference}
  ${buildSupplierParty(invoice)}
  ${buildCustomerParty(invoice)}
  ${buildDelivery(invoice)}
  ${buildPaymentMeans(invoice)}
  ${buildTaxTotal(invoice, items)}
  ${buildLegalMonetaryTotal(invoice)}
  ${invoiceLinesXml}
</Invoice>`;
}
