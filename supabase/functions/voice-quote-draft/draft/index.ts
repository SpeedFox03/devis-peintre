import { getModelCatalogMetadata } from "../resolve/catalog-suggestion.ts";
import {
  extractOutputText,
  OPENAI_API_KEY,
  OPENAI_QUOTE_MODEL,
  sanitizeOpenAIError,
} from "../shared/openai.ts";
import { cleanNullableText, cleanText } from "../shared/text.ts";
import type {
  CatalogService,
  ExistingRoom,
  ModelDraft,
  TradeSlug,
} from "../shared/types.ts";
import { getSystemPrompt } from "./prompt.ts";
import { createDraftSchema } from "./schema.ts";

/**
 * Demande au modèle un brouillon structuré. Le catalogue transmis ne contient
 * ni prix ni TVA : ils sont rechargés côté serveur au moment d'appliquer.
 */
export async function createModelDraft({
  transcript,
  rooms,
  services,
  categories,
  safetyIdentifier,
  trade = null,
}: {
  transcript: string;
  rooms: ExistingRoom[];
  services: CatalogService[];
  categories: string[];
  safetyIdentifier: string;
  trade?: TradeSlug | null;
}) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_QUOTE_MODEL,
      reasoning: { effort: "low" },
      store: false,
      max_output_tokens: 4_000,
      safety_identifier: safetyIdentifier,
      instructions: getSystemPrompt(trade).join("\n"),
      input: JSON.stringify({
        transcript,
        existing_rooms: rooms.map((room) => ({
          id: room.id,
          name: cleanText(room.name, 120),
          notes: cleanNullableText(room.notes, 300),
        })),
        catalog: services.map((service) => ({
          id: service.id,
          name: cleanText(service.name, 120),
          category: cleanNullableText(service.category, 80),
          unit: cleanText(service.default_unit, 40),
          description: cleanNullableText(service.default_description, 500),
          metadata: getModelCatalogMetadata(
            service.default_metadata,
            service.category,
          ),
        })),
      }),
      text: {
        format: {
          type: "json_schema",
          name: "quote_voice_draft",
          strict: true,
          schema: createDraftSchema(rooms, services, categories),
        },
      },
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | {
      output?: Array<{
        type?: string;
        content?: Array<{
          type?: string;
          text?: string;
          refusal?: string;
        }>;
      }>;
      error?: { message?: string };
    }
    | null;

  if (!response.ok || !payload) {
    throw new Error(
      sanitizeOpenAIError(
        payload?.error?.message,
        "L'analyse de la dictée a échoué.",
      ),
    );
  }

  const outputText = extractOutputText(payload.output ?? []);
  if (!outputText) {
    throw new Error("Le modèle n'a pas retourné de brouillon exploitable.");
  }

  try {
    return JSON.parse(outputText) as ModelDraft;
  } catch {
    throw new Error("Le brouillon retourné par le modèle est invalide.");
  }
}
