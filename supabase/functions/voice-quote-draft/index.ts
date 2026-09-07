// Transforme une dictée ou une description saisie en brouillon de devis validé.
//
// La clé OpenAI reste côté serveur et le modèle ne fournit jamais de prix ni
// de TVA : ils sont toujours rechargés depuis le catalogue de l'entreprise.
//
// Enchaînement : http -> context -> transcribe -> draft -> resolve.

import { authenticate, loadQuoteContext } from "./context.ts";
import { createModelDraft } from "./draft/index.ts";
import { CORS, json, parseRequest } from "./http.ts";
import { resolveDraft } from "./resolve/index.ts";
import { MAX_TRANSCRIPT_LENGTH } from "./shared/constants.ts";
import { createSafetyIdentifier, OPENAI_API_KEY } from "./shared/openai.ts";
import { mergeClarification } from "./shared/text.ts";
import { transcribeAudio } from "./transcribe/index.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  if (request.method !== "POST") {
    return json({ error: "Méthode non autorisée." }, 405);
  }

  if (!OPENAI_API_KEY) {
    return json(
      {
        error: "La clé OpenAI n'est pas configurée dans les secrets Supabase.",
      },
      503,
    );
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization) {
    return json({ error: "Session manquante." }, 401);
  }

  // La session est vérifiée avant la lecture du corps : une session expirée
  // doit répondre 401 même si la requête est par ailleurs malformée.
  const session = await authenticate(authorization);
  if (!session.ok) return session.response;

  const parsed = await parseRequest(request);
  if (!parsed.ok) return parsed.response;
  const { quoteId, contextTranscript, audioFile } = parsed.value;

  const context = await loadQuoteContext(
    session.value,
    quoteId,
    parsed.value.trade,
  );
  if (!context.ok) return context.response;
  const { rooms, services, categories, activeTrades, trade } = context.value;

  try {
    let transcript = parsed.value.transcript;

    if (audioFile) {
      transcript = await transcribeAudio(audioFile, services);
    }
    if (contextTranscript) {
      transcript = mergeClarification(contextTranscript, transcript);
    }

    transcript = transcript.trim().slice(0, MAX_TRANSCRIPT_LENGTH);
    if (transcript.length < 3) {
      return json(
        { error: "Aucune parole exploitable n'a été détectée." },
        422,
      );
    }

    const modelDraft = await createModelDraft({
      transcript,
      rooms,
      services,
      categories,
      trade,
      safetyIdentifier: await createSafetyIdentifier(session.value.userId),
    });

    const draft = resolveDraft({
      quoteId,
      transcript,
      modelDraft,
      rooms,
      services,
      categories,
      trade,
    });

    return json({ ...draft, trade, available_trades: activeTrades });
  } catch (error) {
    console.error("voice-quote-draft", error);
    return json(
      {
        error: error instanceof Error
          ? error.message
          : "L'assistant n'a pas pu préparer le brouillon.",
      },
      502,
    );
  }
});
