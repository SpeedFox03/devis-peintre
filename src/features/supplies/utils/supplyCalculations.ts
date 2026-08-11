import type { QuoteItem } from "../../quotes/types";
import type {
  ServiceMaterialRequirement,
  Supplier,
  SupplierProductOffer,
  SupplyProduct,
} from "../types";

export type QuoteSupplyPlanLine = {
  product: SupplyProduct;
  offer: SupplierProductOffer | null;
  supplier: Supplier | null;
  requiredCoverage: number;
  packages: number;
  totalPriceHt: number;
  sourceLabels: string[];
  roles: string[];
  optional: boolean;
  incompatibleUnits: string[];
};

type CalculateQuoteSupplyPlanArgs = {
  items: QuoteItem[];
  requirements: ServiceMaterialRequirement[];
  products: SupplyProduct[];
  offers: SupplierProductOffer[];
  suppliers: Supplier[];
};

function normalizeUnit(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace("m²", "m2")
    .replace("m³", "m3");
}

function chooseOffer(
  productId: string,
  offers: SupplierProductOffer[],
  supplierMap: Map<string, Supplier>,
) {
  const candidates = offers
    .filter((offer) =>
      offer.product_id === productId
      && offer.is_active
      && supplierMap.get(offer.supplier_id)?.is_active,
    )
    .sort((left, right) => {
      if (left.is_preferred !== right.is_preferred) {
        return left.is_preferred ? -1 : 1;
      }
      return Number(left.unit_price_ht) - Number(right.unit_price_ht);
    });

  return candidates[0] ?? null;
}

export function calculateQuoteSupplyPlan({
  items,
  requirements,
  products,
  offers,
  suppliers,
}: CalculateQuoteSupplyPlanArgs) {
  const productMap = new Map(products.map((product) => [product.id, product]));
  const supplierMap = new Map(suppliers.map((supplier) => [supplier.id, supplier]));
  const requirementsByService = new Map<string, ServiceMaterialRequirement[]>();

  for (const requirement of requirements) {
    if (!requirement.is_active) continue;
    const current = requirementsByService.get(requirement.service_catalog_id) ?? [];
    current.push(requirement);
    requirementsByService.set(requirement.service_catalog_id, current);
  }

  const grouped = new Map<
    string,
    {
      product: SupplyProduct;
      requiredCoverage: number;
      requiredPackagesExact: number;
      sourceLabels: Set<string>;
      roles: Set<string>;
      optional: boolean;
      incompatibleUnits: Set<string>;
    }
  >();

  const mappedServiceIds = new Set<string>();

  for (const item of items) {
    if (!item.service_catalog_id) continue;
    const itemRequirements = requirementsByService.get(item.service_catalog_id) ?? [];
    for (const requirement of itemRequirements) {
      const product = productMap.get(requirement.product_id);
      if (!product || !product.is_active) continue;
      mappedServiceIds.add(item.service_catalog_id);

      const itemUnit = normalizeUnit(item.unit);
      const coverageUnit = normalizeUnit(product.coverage_unit);
      const compatible = itemUnit === coverageUnit;
      const baseQuantity = Math.max(0, Number(item.quantity) || 0);
      const coats = Math.max(0, Number(requirement.coats) || 0);
      const wasteFactor = 1 + Math.max(0, Number(requirement.waste_percent) || 0) / 100;
      const requiredCoverage = compatible ? baseQuantity * coats * wasteFactor : 0;
      const coveragePerPackage = Number(requirement.coverage_override)
        || Number(product.coverage_quantity);
      const current = grouped.get(product.id) ?? {
        product,
        requiredCoverage: 0,
        requiredPackagesExact: 0,
        sourceLabels: new Set<string>(),
        roles: new Set<string>(),
        optional: true,
        incompatibleUnits: new Set<string>(),
      };

      current.requiredCoverage += requiredCoverage;
      if (coveragePerPackage > 0) {
        current.requiredPackagesExact += requiredCoverage / coveragePerPackage;
      }
      current.sourceLabels.add(item.label);
      current.roles.add(requirement.usage_role);
      current.optional = current.optional && requirement.is_optional;
      if (!compatible) current.incompatibleUnits.add(item.unit);
      grouped.set(product.id, current);
    }
  }

  const lines: QuoteSupplyPlanLine[] = Array.from(grouped.values())
    .map((group) => {
      const packages = Math.ceil(group.requiredPackagesExact);
      const offer = chooseOffer(group.product.id, offers, supplierMap);
      const supplier = offer ? supplierMap.get(offer.supplier_id) ?? null : null;

      return {
        product: group.product,
        offer,
        supplier,
        requiredCoverage: group.requiredCoverage,
        packages,
        totalPriceHt: packages * Number(offer?.unit_price_ht ?? 0),
        sourceLabels: Array.from(group.sourceLabels),
        roles: Array.from(group.roles),
        optional: group.optional,
        incompatibleUnits: Array.from(group.incompatibleUnits),
      };
    })
    .sort((left, right) =>
      (left.product.category ?? "").localeCompare(right.product.category ?? "", "fr")
      || left.product.name.localeCompare(right.product.name, "fr"),
    );

  const catalogItems = items.filter((item) => Boolean(item.service_catalog_id));
  const unmappedItems = catalogItems.filter(
    (item) => item.service_catalog_id && !mappedServiceIds.has(item.service_catalog_id),
  );

  return {
    lines,
    unmappedItems,
    totalPackages: lines.reduce((total, line) => total + line.packages, 0),
    totalPriceHt: lines
      .filter((line) => !line.optional)
      .reduce((total, line) => total + line.totalPriceHt, 0),
  };
}
