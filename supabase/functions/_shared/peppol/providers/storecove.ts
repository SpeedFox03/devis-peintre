// =============================================================================
// Storecove Access Point — PeppolProvider implementation
// Docs: https://www.storecove.com/docs/
// =============================================================================
// Required env vars:
//   STORECOVE_API_KEY            your Storecove API key
//   STORECOVE_LEGAL_ENTITY_ID    your legal entity ID in Storecove
// =============================================================================

import type {
  PeppolProvider,
  PeppolSendRequest,
  PeppolSendResult,
  PeppolWebhookEvent,
} from "../PeppolProvider.ts";

const STORECOVE_API_BASE = "https://api.storecove.com/api/v2";

const DEFAULT_DOCUMENT_TYPE =
  "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice" +
  "##urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0::2.1";

export class StorecoveProvider implements PeppolProvider {
  readonly name = "storecove";

  private readonly apiKey: string;
  private readonly legalEntityId: string;

  constructor(apiKey: string, legalEntityId: string) {
    if (!apiKey) throw new Error("StorecoveProvider: STORECOVE_API_KEY is required.");
    if (!legalEntityId) throw new Error("StorecoveProvider: STORECOVE_LEGAL_ENTITY_ID is required.");
    this.apiKey = apiKey;
    this.legalEntityId = legalEntityId;
  }

  async send(request: PeppolSendRequest): Promise<PeppolSendResult> {
    // Storecove expects UBL XML base64-encoded inside a document_submission payload
    const base64Xml = btoa(unescape(encodeURIComponent(request.xml)));

    const body = {
      legalEntityId: this.legalEntityId,
      idempotencyGuid: request.invoiceId, // prevents duplicate sends on retry
      routing: {
        eIdentifiers: [
          {
            scheme: request.receiverEndpointScheme,
            id: request.receiverEndpointId,
          },
        ],
      },
      document: {
        documentType: request.documentTypeId ?? DEFAULT_DOCUMENT_TYPE,
        rawDocumentData: {
          document: base64Xml,
          encoding: "base64",
          mimeType: "application/xml",
          attachmentDescription: request.fileName,
        },
      },
    };

    const response = await fetch(`${STORECOVE_API_BASE}/document_submissions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    const rawResponse = await response.json().catch(() => null);

    if (!response.ok) {
      const detail =
        (rawResponse as { message?: string })?.message ??
        JSON.stringify(rawResponse) ??
        response.statusText;
      throw new Error(`Storecove send failed (${response.status}): ${detail}`);
    }

    const providerMessageId =
      (rawResponse as { guid?: string; id?: string })?.guid ??
      (rawResponse as { guid?: string; id?: string })?.id ??
      crypto.randomUUID();

    return { providerMessageId, rawResponse };
  }

  parseWebhook(rawBody: unknown, _headers: Record<string, string>): PeppolWebhookEvent {
    const payload = rawBody as Record<string, unknown>;

    const providerMessageId =
      (payload.document_submission_guid as string) ??
      (payload.guid as string) ??
      "";

    if (!providerMessageId) {
      throw new Error("Storecove webhook: missing document_submission_guid.");
    }

    const status = (payload.status as string | undefined)?.toLowerCase();
    const errors = (payload.errors as Array<{ description?: string }> | undefined) ?? [];
    const errorMessage =
      errors.map((e) => e.description).filter(Boolean).join("; ") || undefined;

    let eventType: PeppolWebhookEvent["eventType"];
    switch (status) {
      case "ok":
      case "success":
        eventType = "delivered";
        break;
      case "failed":
      case "rejected":
        eventType = errors.length > 0 ? "rejected" : "error";
        break;
      default:
        eventType = "error";
    }

    return { eventType, providerMessageId, errorMessage, rawPayload: rawBody };
  }

  /**
   * Verifies the Storecove HMAC-SHA256 webhook signature.
   * Storecove signs webhooks with HMAC-SHA256 in X-Storecove-Signature.
   * https://www.storecove.com/docs/#_webhooks
   *
   * This method is async and MUST be awaited — the Web Crypto API is async.
   * Throws if the signature header is missing or does not match.
   */
  async verifyWebhookSignature(
    rawBody: string,
    headers: Record<string, string>,
    secret: string
  ): Promise<void> {
    const signature =
      headers["x-storecove-signature"] ?? headers["X-Storecove-Signature"];

    if (!signature) {
      throw new Error("Storecove webhook: missing X-Storecove-Signature header.");
    }

    const encoder = new TextEncoder();

    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));

    const expected = Array.from(new Uint8Array(mac))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (signature !== expected) {
      throw new Error("Storecove webhook: invalid signature.");
    }
  }
}