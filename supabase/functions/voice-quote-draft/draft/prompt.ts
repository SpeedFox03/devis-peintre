import type { TradeSlug } from "../shared/types.ts";
import { CARRELEUR_PROMPT } from "./prompts/carreleur.ts";
import { FACADIER_PROMPT } from "./prompts/facadier.ts";
import { PEINTRE_PROMPT } from "./prompts/peintre.ts";
import { PLAFONNEUR_PROMPT } from "./prompts/plafonneur.ts";
import { SOLIER_PROMPT } from "./prompts/solier.ts";

/**
 * Choisit les règles d'extraction selon le métier dicté.
 *
 * Pour ajouter un métier : créer prompts/<metier>.ts qui compose les blocs de
 * prompts/common.ts dans son propre ordre, puis ajouter un `case` ici.
 *
 * Le repli sur le peintre couvre deux cas : un métier inconnu, et une
 * entreprise qui pratique plusieurs métiers sans en avoir sélectionné un
 * avant de dicter.
 */
export function getSystemPrompt(trade: TradeSlug | null): string[] {
  switch (trade) {
    case "plafonneur":
      return PLAFONNEUR_PROMPT;

    case "carreleur":
      return CARRELEUR_PROMPT;

    case "solier":
      return SOLIER_PROMPT;

    case "facadier":
      return FACADIER_PROMPT;

    case "peintre":
    default:
      return PEINTRE_PROMPT;
  }
}
