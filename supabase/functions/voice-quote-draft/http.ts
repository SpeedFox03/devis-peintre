import { MAX_AUDIO_BYTES, UUID_PATTERN } from "./shared/constants.ts";
import type { TradeSlug } from "./shared/types.ts";
import { isTradeSlug } from "./shared/types.ts";

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export type ParsedRequest = {
  quoteId: string;
  transcript: string;
  contextTranscript: string;
  audioFile: File | null;
  /** Métier choisi avant la dictée. Restreint le catalogue et les règles. */
  trade: TradeSlug | null;
};

export type ParseResult =
  | { ok: true; value: ParsedRequest }
  | { ok: false; response: Response };

/**
 * Accepte deux formes : multipart avec un fichier audio, ou JSON avec une
 * transcription déjà saisie. Valide tout ce qui ne dépend pas de la base.
 */
export async function parseRequest(request: Request): Promise<ParseResult> {
  let quoteId = "";
  let transcript = "";
  let contextTranscript = "";
  let audioFile: File | null = null;
  let rawTrade: unknown = null;

  try {
    const contentType = request.headers.get("Content-Type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      quoteId = String(formData.get("quoteId") ?? "").trim();
      contextTranscript = String(
        formData.get("contextTranscript") ?? "",
      ).trim();
      rawTrade = formData.get("trade");
      const audio = formData.get("audio");
      if (audio instanceof File) audioFile = audio;
    } else {
      const body = await request.json();
      quoteId = String(body?.quoteId ?? "").trim();
      transcript = String(body?.transcript ?? "").trim();
      contextTranscript = String(body?.contextTranscript ?? "").trim();
      rawTrade = body?.trade;
    }
  } catch {
    return {
      ok: false,
      response: json({ error: "Corps de requête invalide." }, 400),
    };
  }

  if (!UUID_PATTERN.test(quoteId)) {
    return { ok: false, response: json({ error: "Devis invalide." }, 400) };
  }

  if (!audioFile && transcript.length < 3) {
    return {
      ok: false,
      response: json(
        { error: "Décrivez les travaux ou enregistrez une dictée." },
        400,
      ),
    };
  }

  if (audioFile && (audioFile.size === 0 || audioFile.size > MAX_AUDIO_BYTES)) {
    return {
      ok: false,
      response: json(
        { error: "L'enregistrement doit faire moins de 10 Mo." },
        400,
      ),
    };
  }

  const normalizedTrade = typeof rawTrade === "string"
    ? rawTrade.trim().toLowerCase()
    : "";

  // Un métier inconnu est ignoré plutôt que rejeté : la dictée reste
  // exploitable, elle porte simplement sur tous les métiers actifs.
  const trade = isTradeSlug(normalizedTrade) ? normalizedTrade : null;

  return {
    ok: true,
    value: { quoteId, transcript, contextTranscript, audioFile, trade },
  };
}
