import type { ServiceCatalogItem, ServiceCatalogPriceTier } from "./types";

export const SERVICE_CATALOG_PRICE_TIERS: Array<{
  value: ServiceCatalogPriceTier;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    value: "low",
    label: "Prix bas",
    shortLabel: "Bas",
    description: "Budget serré ou chantier simple",
  },
  {
    value: "medium",
    label: "Prix moyen",
    shortLabel: "Moyen",
    description: "Tarif habituel recommandé",
  },
  {
    value: "high",
    label: "Prix haut",
    shortLabel: "Haut",
    description: "Chantier exigeant ou client premium",
  },
];

export function getServiceCatalogPrice(
  service: ServiceCatalogItem,
  tier: ServiceCatalogPriceTier,
) {
  if (tier === "low") return Number(service.default_unit_price_low_ht || 0);
  if (tier === "high") return Number(service.default_unit_price_high_ht || 0);
  return Number(service.default_unit_price_ht || 0);
}

export function getServiceCatalogPriceTierLabel(tier: ServiceCatalogPriceTier) {
  return SERVICE_CATALOG_PRICE_TIERS.find((option) => option.value === tier)?.label
    ?? "Prix moyen";
}
