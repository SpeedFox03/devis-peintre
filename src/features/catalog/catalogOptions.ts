// Les catégories vivent désormais en base (catalog_categories), filtrées par
// les métiers actifs de l'entreprise. Voir CatalogTaxonomyContext.
//
// Les unités restent ici : elles sont communes à tous les métiers.

export const PAINT_UNITS = [
  "m2",
  "m3",
  "ml",
  "qty",
  "h",
  "forfait",
  "litre",
  "jour",
] as const;

export type PaintUnit = (typeof PAINT_UNITS)[number];

/**
 * Dernier recours quand un slug de categorie n'existe pas en base : une
 * ancienne valeur, ou une categorie desactivee depuis. Vaut mieux qu'un
 * identifiant technique affiche tel quel.
 */
export function formatCategorySlug(slug: string) {
  const readable = slug.replace(/_/g, " ").trim();
  return readable
    ? readable.charAt(0).toUpperCase() + readable.slice(1)
    : "Autre";
}

export function getUnitLabel(unit: string | null | undefined) {
  switch (unit) {
    case "m2":
      return "m²";
    case "m3":
      return "m³";
    case "ml":
      return "mètre linéaire";
    case "qty":
      return "quantité";
    case "h":
      return "heure";
    case "forfait":
      return "forfait";
    case "litre":
      return "litre";
    case "jour":
      return "jour";
    default:
      return unit || "-";
  }
}