import type {
  AMBIGUITY_CODES,
  SURFACE_TYPES,
} from "./constants.ts";

export type SurfaceType = (typeof SURFACE_TYPES)[number];
export type AmbiguityCode = (typeof AMBIGUITY_CODES)[number];

export type CatalogService = {
  id: string;
  name: string;
  category: string | null;
  default_unit: string;
  default_unit_price_ht: number;
  default_tva_rate: number;
  default_description: string | null;
  default_metadata: Record<string, unknown> | null;
  is_active: boolean;
};

export type ExistingRoom = {
  id: string;
  name: string;
  notes: string | null;
};

export type ResolvedDraftRoom = {
  key: string;
  action: "create" | "reuse";
  existing_room_id: string | null;
  name: string;
  notes: string | null;
};

export type ResolvedDraftIssue = {
  message: string;
  blocking: boolean;
  code?:
    | "missing_catalog_service"
    | "missing_quantity"
    | "clarification_required"
    | "other";
  item_key?: string | null;
};

export type ModelDraft = {
  summary?: unknown;
  rooms?: unknown;
  items?: unknown;
  questions?: unknown;
};

export type CatalogSuggestion = {
  name: string;
  description: string | null;
  category: string;
  unit: string;
  pricing_basis: "finished_surface" | "per_coat" | "per_unit";
};

/** Métier dont les règles de dictée s'appliquent. */
export type TradeSlug =
  | "peintre"
  | "plafonneur"
  | "carreleur"
  | "solier"
  | "facadier";

export const TRADE_SLUGS: readonly TradeSlug[] = [
  "peintre",
  "plafonneur",
  "carreleur",
  "solier",
  "facadier",
];

export function isTradeSlug(value: unknown): value is TradeSlug {
  return TRADE_SLUGS.includes(value as TradeSlug);
}
