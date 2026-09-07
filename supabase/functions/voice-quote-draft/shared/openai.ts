// Configuration et utilitaires OpenAI. La clé ne quitte jamais le serveur.
//
// Un profil par tâche : la transcription et l'extraction évoluent séparément.

export const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";

export const OPENAI_TRANSCRIBE_MODEL = Deno.env.get("OPENAI_TRANSCRIBE_MODEL") ||
  "gpt-transcribe";

export const OPENAI_QUOTE_MODEL = Deno.env.get("OPENAI_QUOTE_MODEL") ||
  "gpt-5.6-luna";

/** Empêche une erreur fournisseur de divulguer un secret de configuration. */
export function sanitizeOpenAIError(value: unknown, fallback: string) {
  const message = String(value ?? "").trim();
  if (!message) return fallback;
  if (/api.?key|authorization|bearer/i.test(message)) {
    return "La configuration OpenAI est invalide.";
  }
  return message.slice(0, 300);
}

export function extractOutputText(
  output: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
      refusal?: string;
    }>;
  }>,
) {
  for (const item of output) {
    for (const content of item.content ?? []) {
      if (content.type === "refusal" && content.refusal) {
        throw new Error("Le modèle a refusé d'analyser cette dictée.");
      }
      if (content.type === "output_text" && content.text) {
        return content.text;
      }
    }
  }
  return "";
}

/** Identifiant opaque et stable transmis au fournisseur, sans exposer l'utilisateur. */
export async function createSafetyIdentifier(userId: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(userId),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}
