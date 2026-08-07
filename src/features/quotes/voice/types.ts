export type QuoteVoiceConfidence = "high" | "medium" | "low";
export type QuoteVoiceSurfaceType =
  | "wall"
  | "ceiling"
  | "facade"
  | "woodwork"
  | "metal"
  | "floor"
  | "other";
export type QuoteVoiceAmbiguity =
  | "coats"
  | "quantity_assignment"
  | "other";

export type QuoteVoiceDraftRoom = {
  key: string;
  action: "create" | "reuse";
  existing_room_id: string | null;
  name: string;
  notes: string | null;
};

export type QuoteVoiceCatalogSuggestion = {
  name: string;
  description: string | null;
  category: string;
  unit: string;
  pricing_basis: "finished_surface" | "per_coat" | "per_unit";
};

export type QuoteVoiceDraftItem = {
  key: string;
  room_key: string | null;
  service_catalog_id: string | null;
  label: string;
  description: string | null;
  unit: string | null;
  quantity: number | null;
  unit_price_ht: number | null;
  tva_rate: number | null;
  requested_coats: number | null;
  surface_type: QuoteVoiceSurfaceType | null;
  surface_explicit: boolean;
  ambiguities: QuoteVoiceAmbiguity[];
  clarification_question: string | null;
  confidence: QuoteVoiceConfidence;
  source_excerpt: string;
  applicable: boolean;
  total_ht: number | null;
  catalog_suggestion: QuoteVoiceCatalogSuggestion;
};

export type QuoteVoiceDraftIssue = {
  message: string;
  blocking: boolean;
  code?:
    | "missing_catalog_service"
    | "missing_quantity"
    | "clarification_required"
    | "other";
  item_key?: string | null;
};

export type QuoteVoiceDraft = {
  draft_id: string;
  quote_id: string;
  transcript: string;
  summary: string;
  rooms: QuoteVoiceDraftRoom[];
  items: QuoteVoiceDraftItem[];
  issues: QuoteVoiceDraftIssue[];
  can_apply: boolean;
};

export type ApplyQuoteVoiceDraftResult = {
  draft_id: string;
  room_ids: string[];
  item_ids: string[];
  already_applied: boolean;
};
