export type Supplier = {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  ordering_url: string | null;
  notes: string | null;
  is_active: boolean;
};

export type SupplyProduct = {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  package_quantity: number;
  package_unit: string;
  coverage_quantity: number;
  coverage_unit: string;
  notes: string | null;
  is_active: boolean;
};

export type SupplierProductOffer = {
  id: string;
  product_id: string;
  supplier_id: string;
  supplier_sku: string | null;
  unit_price_ht: number;
  tva_rate: number;
  product_url: string | null;
  price_updated_at: string;
  is_preferred: boolean;
  is_active: boolean;
};

export type ServiceMaterialRequirement = {
  id: string;
  service_catalog_id: string;
  product_id: string;
  usage_role: string;
  coats: number;
  waste_percent: number;
  coverage_override: number | null;
  notes: string | null;
  is_optional: boolean;
  is_active: boolean;
  sort_order: number;
};

export type ServiceCatalogSummary = {
  id: string;
  name: string;
  category: string | null;
  default_unit: string;
  is_active: boolean;
};

export type SupplierFormState = {
  name: string;
  contact_name: string;
  email: string;
  phone: string;
  website: string;
  ordering_url: string;
  notes: string;
};

export type ProductFormState = {
  name: string;
  brand: string;
  category: string;
  package_quantity: string;
  package_unit: string;
  coverage_quantity: string;
  coverage_unit: string;
  notes: string;
  supplier_id: string;
  supplier_sku: string;
  unit_price_ht: string;
  tva_rate: string;
  product_url: string;
};

export type RequirementFormState = {
  service_catalog_id: string;
  product_id: string;
  usage_role: string;
  coats: string;
  waste_percent: string;
  coverage_override: string;
  notes: string;
  is_optional: boolean;
};

