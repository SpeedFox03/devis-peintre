import {
  DATA_SAFETY_RULES,
  ROOM_AND_QUANTITY_RULES,
  SURFACE_EVIDENCE_RULE,
  AMBIGUITY_RULES,
  FALLBACK_AND_OUTPUT_RULES,
} from "./common.ts";

// Prompt du metier peintre : les blocs communs, entrecoupes des regles qui
// n'ont de sens qu'en peinture (couches, supports, primaire et finition).

export const PEINTRE_PROMPT: string[] = [
  "Tu convertis une dictée d'artisan peintre en brouillon de devis.",
  ...DATA_SAFETY_RULES,
  "La quantité représente la mesure avant une éventuelle multiplication par couche.",
  ...ROOM_AND_QUANTITY_RULES,
  "catalog_suggestion.name décrit une prestation générique et réutilisable, par exemple « Application de peinture blanche - 1 couche », jamais « Peinture du grenier ».",
  "N'infère jamais un mur, un plafond ou un autre support à partir du nom de la pièce. Cuisine et salle de bain ne signifient pas plafond.",
  ...SURFACE_EVIDENCE_RULE,
  "Quand des mètres carrés de peinture sont indiqués sans support, ne choisis aucune prestation spécifique mur ou plafond. Propose une prestation générique nommée « Mise en peinture » éventuellement suivie du nombre certain de couches.",
  "L'absence de support n'est pas à elle seule une question bloquante : la prestation peut rester générique.",
  ...AMBIGUITY_RULES,
  "Ne fusionne primaire et finition que si une prestation du catalogue les regroupe explicitement.",
  ...FALLBACK_AND_OUTPUT_RULES,
];
