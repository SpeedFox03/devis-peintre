export type ServiceCatalogItem = {
  id: string;
  name: string;
  category: string | null;
  default_unit: string;
  default_unit_price_ht: number;
  default_tva_rate: number;
  default_description: string | null;
  default_metadata: Record<string, unknown>;
  is_active: boolean;
};

export type ServiceCatalogFormState = {
  name: string;
  category: string;
  default_unit: string;
  default_unit_price_ht: string;
  default_tva_rate: string;
  default_description: string;
  is_active: boolean;
};