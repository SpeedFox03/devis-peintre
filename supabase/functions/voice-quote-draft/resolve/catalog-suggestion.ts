import { CATALOG_UNITS, PRICING_BASES } from "../shared/constants.ts";
import { toOptionalPositiveInteger } from "../shared/numbers.ts";
import { cleanNullableText, cleanText } from "../shared/text.ts";
import type { CatalogSuggestion } from "../shared/types.ts";
import { getServiceSurfaceType } from "../trades/peintre/surface.ts";

/**
 * Ramène la proposition du modèle dans les valeurs autorisées. Les catégories
 * acceptées dépendent des métiers actifs de l'entreprise.
 */
export function resolveCatalogSuggestion(
  value: unknown,
  index: number,
  allowedCategories: string[],
): CatalogSuggestion {
  const source = value && typeof value === "object"
    ? value as Record<string, unknown>
    : {};
  const category = String(source.category ?? "");
  const unit = String(source.unit ?? "");
  const pricingBasis = String(source.pricing_basis ?? "");

  return {
    name: cleanText(source.name, 120) || `Prestation ${index + 1}`,
    description: cleanNullableText(source.description, 500),
    category: allowedCategories.includes(category) ? category : "other",
    unit: CATALOG_UNITS.includes(unit as (typeof CATALOG_UNITS)[number])
      ? unit
      : "m2",
    pricing_basis: PRICING_BASES.includes(
        pricingBasis as (typeof PRICING_BASES)[number],
      )
      ? pricingBasis
      : "finished_surface",
  } as CatalogSuggestion;
}

/**
 * Retire le nom de la pièce du libellé : une prestation de catalogue doit
 * rester réutilisable ailleurs que dans la pièce dictée.
 */
export function removeRoomQualifier(label: string, roomName: string | null) {
  if (!roomName) return label;

  const escapedRoomName = roomName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const preposition = "(?:du|de la|de l['’]|des|dans le|dans la|dans l['’])";
  const withoutRoom = label.replace(
    new RegExp(
      `\\s+${preposition}\\s+${escapedRoomName}(?=\\s|$|[-,])`,
      "giu",
    ),
    " ",
  );

  return withoutRoom.replace(/\s{2,}/g, " ").trim() || label;
}

/** N'ajoute la mention des couches que si elle n'est pas déjà dans le libellé. */
export function buildDescription(
  service: { name: string; default_description: string | null },
  requestedCoats: number | null,
) {
  const base = service.default_description?.trim() ?? "";
  if (!requestedCoats) return base || null;

  const combined = `${service.name} ${base}`.toLocaleLowerCase("fr");
  const mentionsCoats = new RegExp(
    `\\b${requestedCoats}\\s*couche`,
    "i",
  ).test(combined);
  const coatNote = mentionsCoats
    ? ""
    : `${requestedCoats} couche${requestedCoats > 1 ? "s" : ""} prévue${
      requestedCoats > 1 ? "s" : ""
    }.`;

  return [base, coatNote].filter(Boolean).join(" ") || null;
}

/** Vue réduite du catalogue envoyée au modèle : jamais de prix ni de TVA. */
export function getModelCatalogMetadata(
  metadata: Record<string, unknown> | null,
  category: string | null,
) {
  const aliases = Array.isArray(metadata?.aliases)
    ? metadata.aliases
      .map((alias) => cleanText(alias, 80))
      .filter(Boolean)
      .slice(0, 20)
    : [];
  const includedCoats = toOptionalPositiveInteger(metadata?.included_coats);
  const pricingBasis = String(metadata?.pricing_basis ?? "");

  return {
    aliases,
    surface_type: getServiceSurfaceType({
      category,
      default_metadata: metadata,
    }),
    included_coats: includedCoats,
    pricing_basis: [
        "finished_surface",
        "per_coat",
        "per_unit",
      ].includes(pricingBasis)
      ? pricingBasis
      : null,
  };
}
