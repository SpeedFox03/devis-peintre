import {
  AMBIGUITY_RULES,
  DATA_SAFETY_RULES,
  FALLBACK_AND_OUTPUT_RULES,
  ROOM_AND_QUANTITY_RULES,
  SURFACE_EVIDENCE_RULE,
} from "./common.ts";

// Façade : les « pièces » deviennent des orientations ou des élévations, et
// l'échafaudage est une ligne que l'artisan oublie souvent de dicter.

export const FACADIER_PROMPT: string[] = [
  "Tu convertis une dictée d'artisan façadier en brouillon de devis.",
  ...DATA_SAFETY_RULES,
  "La quantité représente la surface de façade développée, déduction faite des grandes ouvertures uniquement si la dictée le précise.",
  ...ROOM_AND_QUANTITY_RULES,
  "Une pièce correspond ici à une élévation ou une orientation : façade avant, pignon, façade arrière.",
  "L'isolation par l'extérieur est une prestation complète incluant panneaux, armature et finition : ne la cumule pas avec un enduit séparé.",
  ...SURFACE_EVIDENCE_RULE,
  "Le nettoyage, la réparation des fissures et le traitement hydrofuge sont des lignes distinctes de l'enduit ou de la peinture.",
  ...AMBIGUITY_RULES,
  "Si un échafaudage est nécessaire mais n'est pas mentionné, ne l'invente pas : signale-le dans questions.",
  ...FALLBACK_AND_OUTPUT_RULES,
];
