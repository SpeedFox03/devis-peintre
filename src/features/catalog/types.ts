export type ServiceCatalogPricingBasis =
  | "finished_surface"
  | "per_coat"
  | "per_unit";

export type ServiceCatalogPriceTier = "low" | "medium" | "high";

export type ServiceCatalogMetadata = {
  aliases?: string[];
  surface_type?: string;
  included_coats?: number;
  pricing_basis?: ServiceCatalogPricingBasis;
  [key: string]: unknown;
};

export type ServiceCatalogItem = {
  id: string;
  name: string;
  category: string | null;
  default_unit: string;
  default_unit_price_low_ht: number;
  default_unit_price_ht: number;
  default_unit_price_high_ht: number;
  default_tva_rate: number;
  default_description: string | null;
  default_metadata: ServiceCatalogMetadata;
  is_active: boolean;
};

export type ServiceCatalogFormState = {
  name: string;
  category: string;
  default_unit: string;
  default_unit_price_low_ht: string;
  default_unit_price_ht: string;
  default_unit_price_high_ht: string;
  default_tva_rate: string;
  default_description: string;
  aliases: string;
  surface_type: string;
  included_coats: string;
  pricing_basis: "" | ServiceCatalogPricingBasis;
  is_active: boolean;
};
