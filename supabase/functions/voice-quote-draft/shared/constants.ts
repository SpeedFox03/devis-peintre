// Valeurs partagées par toutes les étapes de l'assistant vocal.
//
// Les catégories ne sont plus ici : elles viennent de catalog_categories,
// filtrées par les métiers actifs de l'entreprise (voir context.ts).
// Les unités, elles, sont communes à tous les métiers.

export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
export const MAX_TRANSCRIPT_LENGTH = 8_000;
export const MAX_ROOMS = 20;
export const MAX_ITEMS = 50;

export const CATALOG_UNITS = [
  "m2",
  "m3",
  "ml",
  "qty",
  "h",
  "forfait",
  "litre",
  "jour",
] as const;

export const PRICING_BASES = [
  "finished_surface",
  "per_coat",
  "per_unit",
] as const;

export const SURFACE_TYPES = [
  "wall",
  "ceiling",
  "facade",
  "woodwork",
  "metal",
  "floor",
  "other",
] as const;

export const AMBIGUITY_CODES = [
  "coats",
  "quantity_assignment",
  "other",
] as const;

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
