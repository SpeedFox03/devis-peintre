import { AMBIGUITY_CODES } from "../shared/constants.ts";
import type { AmbiguityCode } from "../shared/types.ts";

export function resolveAmbiguities(value: unknown): AmbiguityCode[] {
  if (!Array.isArray(value)) return [];

  return [
    ...new Set(
      value.filter((code): code is AmbiguityCode =>
        AMBIGUITY_CODES.includes(code as AmbiguityCode)
      ),
    ),
  ];
}

/** Question de repli quand le modèle signale une ambiguïté sans en formuler une. */
export function getDefaultClarificationQuestion(
  ambiguities: AmbiguityCode[],
  roomName: string | null,
) {
  const location = roomName ? ` pour « ${roomName} »` : "";
  if (ambiguities.includes("quantity_assignment")) {
    return `À quelle pièce ou prestation faut-il attribuer la quantité${location} ?`;
  }
  if (ambiguities.includes("coats")) {
    return `Combien de couches faut-il compter au total${location} ?`;
  }
  return `Quelle précision faut-il apporter à cette prestation${location} ?`;
}
