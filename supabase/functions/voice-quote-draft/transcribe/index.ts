import {
  OPENAI_API_KEY,
  OPENAI_TRANSCRIBE_MODEL,
  sanitizeOpenAIError,
} from "../shared/openai.ts";
import type { CatalogService } from "../shared/types.ts";

/**
 * Transcrit l'enregistrement. Le vocabulaire du catalogue est transmis au
 * modèle : c'est ce qui lui fait écrire les termes métier correctement.
 */
export async function transcribeAudio(
  audioFile: File,
  services: CatalogService[],
) {
  const formData = new FormData();
  formData.append("model", OPENAI_TRANSCRIBE_MODEL);
  formData.append("file", audioFile, audioFile.name || "dictee-devis.webm");

  const catalogTerms = services
    .flatMap((service) => [
      service.name,
      ...(Array.isArray(service.default_metadata?.aliases)
        ? service.default_metadata.aliases.map(String)
        : []),
    ])
    .map((term) => term.replace(/[<>\r\n]/g, " ").trim())
    .filter(Boolean)
    .slice(0, 100);

  formData.append(
    "prompt",
    [
      "Dictée en français ou en français belge d'un artisan peintre préparant un devis.",
      "Respecter précisément les nombres, surfaces, unités et nombres de couches.",
      `Vocabulaire du catalogue : ${catalogTerms.join(", ")}`,
    ].join("\n"),
  );

  if (OPENAI_TRANSCRIBE_MODEL === "gpt-transcribe") {
    formData.append("languages[]", "fr");
    for (const term of catalogTerms) {
      formData.append("keywords[]", term);
    }
  }

  const response = await fetch(
    "https://api.openai.com/v1/audio/transcriptions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    },
  );

  const payload = (await response.json().catch(() => null)) as
    | { text?: string; error?: { message?: string } }
    | null;

  if (!response.ok || !payload?.text) {
    throw new Error(
      sanitizeOpenAIError(
        payload?.error?.message,
        "La transcription audio a échoué.",
      ),
    );
  }

  return payload.text;
}
