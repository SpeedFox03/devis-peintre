import { MAX_TRANSCRIPT_LENGTH } from "./constants.ts";

// Marques diacritiques combinantes U+0300 à U+036F, produites par NFKD.
// Construite par point de code : une plage écrite en clair dans le source
// serait invisible à la lecture et réécrite par les formateurs.
const COMBINING_MARKS = new RegExp(
  `[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`,
  "g",
);

export function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

export function cleanNullableText(value: unknown, maxLength: number) {
  const cleaned = cleanText(value, maxLength);
  return cleaned || null;
}

/** Minuscules sans accents ni ponctuation, pour les comparaisons souples. */
export function normalizeSearchText(value: string) {
  return value
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .toLocaleLowerCase("fr")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Identifiant de pièce stable et unique dans le brouillon. */
export function uniqueKey(value: string, keys: Set<string>) {
  const base = value
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "room";
  let candidate = base;
  let suffix = 2;
  while (keys.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  keys.add(candidate);
  return candidate;
}

/**
 * Fusionne la dictée initiale et la précision apportée ensuite, en tronquant
 * le contexte par le milieu pour rester sous la limite de transcription.
 */
export function mergeClarification(context: string, clarification: string) {
  const marker = "Précision apportée après le premier brouillon :";
  const clarificationText = clarification.trim().slice(0, 2_000);
  const availableContextLength = Math.max(
    0,
    MAX_TRANSCRIPT_LENGTH - marker.length - clarificationText.length - 8,
  );
  const contextText = context.trim();
  let compactContext = contextText;

  if (contextText.length > availableContextLength) {
    const separator = "\n[…]\n";
    const firstPartLength = Math.floor(
      (availableContextLength - separator.length) / 2,
    );
    const lastPartLength = availableContextLength - separator.length -
      firstPartLength;
    compactContext = `${contextText.slice(0, firstPartLength)}${separator}${
      contextText.slice(-lastPartLength)
    }`;
  }

  return [compactContext, marker, clarificationText].filter(Boolean).join(
    "\n\n",
  );
}
