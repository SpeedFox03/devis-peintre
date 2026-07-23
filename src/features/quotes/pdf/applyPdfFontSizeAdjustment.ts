import type { TDocumentDefinitions } from "pdfmake/interfaces";

const MINIMUM_PDF_FONT_SIZE = 6;
const DYNAMIC_CONTENT_KEYS = ["header", "footer", "background"] as const;

function adjustPdfValue(
  value: unknown,
  adjustment: number,
  visited: WeakSet<object>,
): unknown {
  if (Array.isArray(value)) {
    value.forEach((entry) => adjustPdfValue(entry, adjustment, visited));
    return value;
  }

  if (!value || typeof value !== "object" || visited.has(value)) {
    return value;
  }

  visited.add(value);
  const record = value as Record<string, unknown>;

  Object.entries(record).forEach(([key, entry]) => {
    if (key === "fontSize" && typeof entry === "number") {
      record[key] = Math.max(MINIMUM_PDF_FONT_SIZE, entry + adjustment);
      return;
    }

    adjustPdfValue(entry, adjustment, visited);
  });

  return value;
}

function wrapDynamicContent(
  definition: Record<string, unknown>,
  key: (typeof DYNAMIC_CONTENT_KEYS)[number],
  adjustment: number,
) {
  const content = definition[key];
  if (typeof content !== "function") return;

  const originalContent = content as (...args: unknown[]) => unknown;
  definition[key] = (...args: unknown[]) =>
    adjustPdfValue(originalContent(...args), adjustment, new WeakSet<object>());
}

/**
 * Réduit toutes les tailles explicites et implicites d'un document pdfmake.
 * Les contenus dynamiques (pied de page, en-tête, arrière-plan) sont également
 * traités lorsqu'ils sont générés par pdfmake.
 */
export function applyPdfFontSizeAdjustment(
  definition: TDocumentDefinitions,
  adjustment: number | null | undefined,
): TDocumentDefinitions {
  const normalizedAdjustment = adjustment === -1 || adjustment === 1
    ? adjustment
    : 0;
  if (normalizedAdjustment === 0) return definition;

  const adjustedDefinition = adjustPdfValue(
    definition,
    normalizedAdjustment,
    new WeakSet<object>(),
  ) as TDocumentDefinitions;
  const definitionRecord = adjustedDefinition as unknown as Record<string, unknown>;

  DYNAMIC_CONTENT_KEYS.forEach((key) => {
    wrapDynamicContent(definitionRecord, key, normalizedAdjustment);
  });

  return adjustedDefinition;
}
