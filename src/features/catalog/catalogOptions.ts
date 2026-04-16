export const PAINT_CATEGORIES = [
  "preparation_support",
  "protection_chantier",
  "lessivage",
  "grattage",
  "rebouchage",
  "enduit",
  "poncage",
  "impression",
  "peinture_mur",
  "peinture_plafond",
  "boiseries",
  "portes",
  "plinthes",
  "radiateurs",
  "ferronneries",
  "facade",
  "nettoyage_fin_chantier",
  "other",
] as const;

export const PAINT_UNITS = [
  "m2",
  "ml",
  "qty",
  "h",
  "forfait",
  "litre",
  "jour",
] as const;

export type PaintCategory = (typeof PAINT_CATEGORIES)[number];
export type PaintUnit = (typeof PAINT_UNITS)[number];

export function getCategoryLabel(category: string | null | undefined) {
  switch (category) {
    case "preparation_support":
      return "Préparation support";
    case "protection_chantier":
      return "Protection chantier";
    case "lessivage":
      return "Lessivage";
    case "grattage":
      return "Grattage";
    case "rebouchage":
      return "Rebouchage";
    case "enduit":
      return "Enduit";
    case "poncage":
      return "Ponçage";
    case "impression":
      return "Impression";
    case "peinture_mur":
      return "Peinture mur";
    case "peinture_plafond":
      return "Peinture plafond";
    case "boiseries":
      return "Boiseries";
    case "portes":
      return "Portes";
    case "plinthes":
      return "Plinthes";
    case "radiateurs":
      return "Radiateurs";
    case "ferronneries":
      return "Ferronneries";
    case "facade":
      return "Façade";
    case "nettoyage_fin_chantier":
      return "Nettoyage fin de chantier";
    case "other":
      return "Autre";
    default:
      return category || "Autre";
  }
}

export function getUnitLabel(unit: string | null | undefined) {
  switch (unit) {
    case "m2":
      return "m²";
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