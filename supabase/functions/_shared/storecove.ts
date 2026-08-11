export type StorecovePartyType = "business" | "consumer" | "government";

export type SalesDocumentForStorecove = {
  id: string;
  document_status: string;
  document_kind: "invoice" | "credit_note";
  document_number: string | null;
  issue_date: string | null;
  due_date: string | null;
  currency_code: string;
  customer_reference: string | null;
  buyer_reference: string | null;
  purchase_order_reference: string | null;
  payment_terms: string | null;
  payment_account_iban: string | null;
  payment_account_bic: string | null;
  notes: string | null;
  seller_snapshot: Record<string, unknown>;
  buyer_snapshot: Record<string, unknown>;
  total_ttc: number;
  prepaid_amount: number;
};

export type SalesDocumentLineForStorecove = {
  line_identifier: string;
  label: string;
  description: string | null;
  quantity: number;
  unit_code: string;
  unit_price_ht: number;
  discount_amount: number;
  line_extension_amount: number;
  vat_category_code: string;
  vat_rate: number;
  tax_exemption_reason_code: string | null;
  tax_exemption_reason: string | null;
};

export type SalesTaxTotalForStorecove = {
  vat_category_code: string;
  vat_rate: number;
  taxable_amount: number;
  tax_amount: number;
  tax_exemption_reason_code: string | null;
  tax_exemption_reason: string | null;
};

export type StorecoveProfile = {
  connection_status: string;
  storecove_legal_entity_id: number | null;
};

export type CustomerEinvoicingProfile = {
  party_type: StorecovePartyType;
  endpoint_scheme: string | null;
  endpoint_identifier: string | null;
  discovery_status: string;
};

export type StorecovePreview = {
  ready: boolean;
  blockingIssues: string[];
  warnings: string[];
  payload: Record<string, unknown>;
};

type BuildInput = {
  document: SalesDocumentForStorecove;
  lines: SalesDocumentLineForStorecove[];
  taxTotals: SalesTaxTotalForStorecove[];
  companyProfile: StorecoveProfile | null;
  customerProfile: CustomerEinvoicingProfile | null;
  apiKeyConfigured: boolean;
  idempotencyGuid?: string;
};

export function buildStorecovePreview(input: BuildInput): StorecovePreview {
  const { document, lines, taxTotals, companyProfile, customerProfile } = input;
  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  const seller = document.seller_snapshot ?? {};
  const buyer = document.buyer_snapshot ?? {};
  const sellerCountry = readString(seller, "countryCode") ?? "BE";
  const buyerCountry = readString(buyer, "countryCode") ?? "BE";
  const buyerEmail = readString(buyer, "email");
  const partyType = customerProfile?.party_type ?? "business";

  if (document.document_status !== "issued") {
    blockingIssues.push("La facture doit être émise avant de pouvoir être envoyée.");
  }
  if (!document.document_number || !document.issue_date || !document.due_date) {
    blockingIssues.push("Le numéro, la date d’émission et l’échéance sont obligatoires.");
  }
  if (!lines.length) {
    blockingIssues.push("La facture ne contient aucune ligne.");
  }
  if (!input.apiKeyConfigured) {
    blockingIssues.push("La clé API Storecove n’est pas encore configurée côté serveur.");
  }
  if (!companyProfile?.storecove_legal_entity_id) {
    blockingIssues.push("L’identifiant LegalEntity Storecove du vendeur est manquant.");
  } else if (companyProfile.connection_status !== "active") {
    blockingIssues.push("La LegalEntity Storecove n’est pas encore active.");
  }

  const routing = buildRouting(customerProfile, buyerEmail, warnings, blockingIssues);
  const buyerIdentifiers = buildBuyerIdentifiers(buyer, buyerCountry);

  if (partyType !== "consumer" && buyerIdentifiers.length === 0) {
    warnings.push("Aucun numéro d’entreprise ou de TVA n’est figé pour ce client professionnel.");
  }
  if (customerProfile?.endpoint_identifier && customerProfile.discovery_status !== "available") {
    warnings.push("L’identifiant électronique du client n’a pas encore été confirmé par la découverte Storecove.");
  }

  const invoiceLines = lines.map((line) => {
    const baseAmount = money(Number(line.quantity) * Number(line.unit_price_ht));
    const allowanceCharges = Number(line.discount_amount) > 0
      ? [{
          amountExcludingTax: -money(line.discount_amount),
          baseAmountExcludingTax: baseAmount,
          reason: "Remise",
        }]
      : undefined;

    return compact({
      lineId: line.line_identifier,
      name: line.label,
      description: line.description || undefined,
      quantity: Number(line.quantity),
      quantityUnitCode: line.unit_code || "C62",
      price: {
        priceAmount: Number(line.unit_price_ht),
        baseQuantity: 1,
      },
      amountExcludingVat: money(line.line_extension_amount),
      allowanceCharges,
      tax: compact({
        country: sellerCountry,
        percentage: Number(line.vat_rate),
        category: mapTaxCategory(line.vat_category_code),
      }),
    });
  });

  const invoiceTaxTotals = taxTotals.map((total) => compact({
    country: sellerCountry,
    percentage: Number(total.vat_rate),
    category: mapTaxCategory(total.vat_category_code),
    taxableAmount: money(total.taxable_amount),
    taxAmount: money(total.tax_amount),
    taxExemptionReasonCode: total.tax_exemption_reason_code || undefined,
    taxExemptionReason: total.tax_exemption_reason || undefined,
  }));

  const paymentMeansArray = document.payment_account_iban
    ? [compact({
        code: "sepa_credit_transfer",
        account: normalizeIban(document.payment_account_iban),
        branche_code: document.payment_account_bic || undefined,
        holder: readString(seller, "name") || undefined,
        paymentId: document.document_number || undefined,
      })]
    : undefined;

  if (!paymentMeansArray) {
    warnings.push("Aucun IBAN n’est figé sur la facture.");
  }

  const references = [
    document.customer_reference
      ? { documentType: "quotation", documentId: document.customer_reference }
      : undefined,
    document.purchase_order_reference
      ? { documentType: "purchase_order", documentId: document.purchase_order_reference }
      : undefined,
  ].filter(Boolean);

  const invoice = compact({
    taxSystem: "tax_line_percentages",
    invoiceNumber: document.document_number || undefined,
    issueDate: document.issue_date || undefined,
    dueDate: document.due_date || undefined,
    documentCurrencyCode: document.currency_code || "EUR",
    x2y: mapPartyType(partyType),
    buyerReference: document.buyer_reference || undefined,
    references: references.length ? references : undefined,
    notes: document.notes ? [document.notes] : undefined,
    paymentTerms: document.payment_terms ? { note: document.payment_terms } : undefined,
    paymentMeansArray,
    accountingCustomerParty: {
      party: compact({
        companyName: readString(buyer, "name") || "Client à compléter",
        registrationName: readString(buyer, "companyName") || undefined,
        address: compact({
          street1: readNestedString(buyer, "address", "street1") || undefined,
          street2: readNestedString(buyer, "address", "street2") || undefined,
          zip: readNestedString(buyer, "address", "zip") || undefined,
          city: readNestedString(buyer, "address", "city") || undefined,
          country: buyerCountry,
        }),
        contact: compact({
          firstName: readString(buyer, "firstName") || undefined,
          lastName: readString(buyer, "lastName") || undefined,
          email: buyerEmail || undefined,
          phone: readString(buyer, "phone") || undefined,
        }),
      }),
      publicIdentifiers: buyerIdentifiers,
    },
    invoiceLines,
    taxSubtotals: invoiceTaxTotals,
    amountIncludingTax: money(document.total_ttc),
    prepaidAmount: Number(document.prepaid_amount) > 0 ? money(document.prepaid_amount) : undefined,
  });

  const payload = compact({
    legalEntityId: companyProfile?.storecove_legal_entity_id || undefined,
    idempotencyGuid: input.idempotencyGuid ?? document.id,
    routing,
    document: {
      documentType: "invoice",
      invoice,
    },
  });

  return {
    ready: blockingIssues.length === 0,
    blockingIssues: unique(blockingIssues),
    warnings: unique(warnings),
    payload,
  };
}

function buildRouting(
  profile: CustomerEinvoicingProfile | null,
  email: string | null,
  warnings: string[],
  blockingIssues: string[],
) {
  if (profile?.endpoint_scheme && profile.endpoint_identifier) {
    return {
      eIdentifiers: [{ scheme: profile.endpoint_scheme, id: normalizeIdentifier(profile.endpoint_identifier) }],
      ...(email ? { emails: [email] } : {}),
    };
  }

  if (email) {
    warnings.push("Sans identifiant Peppol confirmé, Storecove utilisera l’adresse e-mail du client.");
    return { eIdentifiers: [], emails: [email] };
  }

  blockingIssues.push("Le client n’a ni identifiant Peppol ni adresse e-mail de routage.");
  return { eIdentifiers: [] };
}

function buildBuyerIdentifiers(snapshot: Record<string, unknown>, country: string) {
  const identifiers: Array<{ scheme: string; id: string }> = [];
  const enterpriseNumber = readString(snapshot, "enterpriseNumber");
  const vatNumber = readString(snapshot, "vatNumber");

  if (enterpriseNumber) {
    identifiers.push({ scheme: country === "BE" ? "BE:EN" : `${country}:EN`, id: normalizeIdentifier(enterpriseNumber) });
  }
  if (vatNumber) {
    identifiers.push({ scheme: `${country}:VAT`, id: normalizeVat(vatNumber, country) });
  }
  return identifiers;
}

function mapPartyType(value: StorecovePartyType) {
  if (value === "consumer") return "b2c";
  if (value === "government") return "b2g";
  return "b2b";
}

function mapTaxCategory(value: string) {
  switch (value.toUpperCase()) {
    case "Z": return "zero_rated";
    case "E": return "exempt";
    case "AE": return "reverse_charge";
    case "O": return "outside_scope";
    default: return "standard";
  }
}

function readString(value: Record<string, unknown>, key: string) {
  const item = value[key];
  return typeof item === "string" && item.trim() ? item.trim() : null;
}

function readNestedString(value: Record<string, unknown>, key: string, nestedKey: string) {
  const nested = value[key];
  if (!nested || typeof nested !== "object" || Array.isArray(nested)) return null;
  return readString(nested as Record<string, unknown>, nestedKey);
}

function compact<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== ""),
  ) as T;
}

function money(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function normalizeIdentifier(value: string) {
  return value.replace(/[.\s-]/g, "").toUpperCase();
}

function normalizeVat(value: string, country: string) {
  const normalized = normalizeIdentifier(value);
  return normalized.startsWith(country) ? normalized : `${country}${normalized}`;
}

function normalizeIban(value: string) {
  return value.replace(/\s/g, "").toUpperCase();
}

function unique(values: string[]) {
  return [...new Set(values)];
}
