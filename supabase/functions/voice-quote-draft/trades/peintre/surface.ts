// Logique de support propre au métier de peintre : déduire de quoi parle la
// dictée (mur, plafond, façade, boiserie, métal, sol) et refuser une
// prestation trop précise quand le support n'est pas certain.
//
// Un autre métier aura son propre module ici : trades/<metier>/surface.ts.

import { CATALOG_UNITS, SURFACE_TYPES } from "../../shared/constants.ts";
import { cleanNullableText, normalizeSearchText } from "../../shared/text.ts";
import type {
  CatalogService,
  CatalogSuggestion,
  SurfaceType,
} from "../../shared/types.ts";

const SURFACE_KEYWORDS: Record<Exclude<SurfaceType, "other">, string[]> = {
  wall: ["mur", "murs", "paroi", "parois"],
  ceiling: ["plafond", "plafonds"],
  facade: ["facade", "facades"],
  woodwork: [
    "bois",
    "boiserie",
    "boiseries",
    "porte",
    "portes",
    "plinthe",
    "plinthes",
  ],
  metal: [
    "metal",
    "metaux",
    "ferronnerie",
    "ferronneries",
    "radiateur",
    "radiateurs",
  ],
  floor: ["sol", "sols", "plancher", "planchers"],
};

/**
 * N'accepte un support que si le modèle cite un extrait réellement présent
 * dans la dictée et contenant le mot correspondant. Sans cette preuve, on
 * préfère ne rien affirmer.
 */
export function resolveExplicitSurface(
  value: unknown,
  excerptValue: unknown,
  transcript: string,
): SurfaceType | null {
  const surfaceType = String(value ?? "") as SurfaceType;
  if (!SURFACE_TYPES.includes(surfaceType) || surfaceType === "other") {
    return null;
  }

  const excerpt = cleanNullableText(excerptValue, 200);
  if (!excerpt) return null;

  const normalizedExcerpt = normalizeSearchText(excerpt);
  const normalizedTranscript = normalizeSearchText(transcript);
  if (!normalizedTranscript.includes(normalizedExcerpt)) return null;

  return SURFACE_KEYWORDS[surfaceType].some((keyword) =>
      new RegExp(`(?:^|\\s)${keyword}(?:$|\\s)`, "i").test(normalizedExcerpt)
    )
    ? surfaceType
    : null;
}

export function getServiceSurfaceType(
  service: Pick<CatalogService, "category" | "default_metadata">,
): SurfaceType | null {
  const metadataValue = normalizeSearchText(
    String(service.default_metadata?.surface_type ?? ""),
  );

  if (SURFACE_TYPES.includes(metadataValue as SurfaceType)) {
    return metadataValue as SurfaceType;
  }
  if (/\b(mur|murs|paroi|parois)\b/.test(metadataValue)) return "wall";
  if (/\b(plafond|plafonds)\b/.test(metadataValue)) return "ceiling";
  if (/\b(facade|facades)\b/.test(metadataValue)) return "facade";
  if (
    /\b(bois|boiserie|boiseries|porte|portes|plinthe|plinthes)\b/.test(
      metadataValue,
    )
  ) {
    return "woodwork";
  }
  if (
    /\b(metal|metaux|ferronnerie|ferronneries|radiateur|radiateurs)\b/.test(
      metadataValue,
    )
  ) {
    return "metal";
  }
  if (/\b(sol|sols|plancher|planchers)\b/.test(metadataValue)) return "floor";

  return getCategorySurfaceType(service.category);
}

export function getCategorySurfaceType(
  category: string | null,
): SurfaceType | null {
  switch (category) {
    case "peinture_mur":
      return "wall";
    case "peinture_plafond":
      return "ceiling";
    case "facade":
      return "facade";
    case "boiseries":
    case "portes":
    case "plinthes":
      return "woodwork";
    case "ferronneries":
    case "radiateurs":
      return "metal";
    default:
      return null;
  }
}

/** Une prestation dont le prix dépend du support précis (mur, plafond, façade). */
export function isSurfaceSpecificPaintingService(service: CatalogService) {
  if (
    ["peinture_mur", "peinture_plafond", "facade"].includes(
      String(service.category),
    )
  ) {
    return true;
  }

  return normalizeSearchText(service.name).includes("peinture") &&
    ["wall", "ceiling", "facade"].includes(
      String(getServiceSurfaceType(service)),
    );
}

/**
 * Repli lorsque le support est incertain : une prestation volontairement
 * générique, que l'artisan précisera lui-même, plutôt qu'un mauvais choix.
 */
export function buildGenericPaintingSuggestion({
  surfaceType,
  requestedCoats,
  coatsAreAmbiguous,
  fallbackUnit,
}: {
  surfaceType: SurfaceType | null;
  requestedCoats: number | null;
  coatsAreAmbiguous: boolean;
  fallbackUnit: string;
}): CatalogSuggestion {
  const surfaceLabels: Partial<Record<SurfaceType, string>> = {
    wall: "des murs",
    ceiling: "du plafond",
    facade: "de façade",
    woodwork: "des boiseries",
    metal: "des supports métalliques",
    floor: "du sol",
  };
  const categoryBySurface: Partial<Record<SurfaceType, string>> = {
    wall: "peinture_mur",
    ceiling: "peinture_plafond",
    facade: "facade",
    woodwork: "boiseries",
    metal: "ferronneries",
  };
  const coatLabel = requestedCoats && !coatsAreAmbiguous
    ? ` - ${requestedCoats} couche${requestedCoats > 1 ? "s" : ""}`
    : "";
  const supportLabel = surfaceType ? surfaceLabels[surfaceType] : null;

  return {
    name: `Mise en peinture${
      supportLabel ? ` ${supportLabel}` : ""
    }${coatLabel}`,
    description: surfaceType ? null : "Support non précisé dans la dictée.",
    category: surfaceType ? categoryBySurface[surfaceType] ?? "other" : "other",
    unit: CATALOG_UNITS.includes(
        fallbackUnit as (typeof CATALOG_UNITS)[number],
      )
      ? fallbackUnit
      : "m2",
    pricing_basis: "finished_surface" as const,
  };
}
