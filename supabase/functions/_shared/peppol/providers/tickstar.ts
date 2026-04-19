// =============================================================================
// Tickstar Access Point — PeppolProvider stub
// Docs: https://tickstar.com/developer/
// =============================================================================
// Required env vars (when implemented):
//   TICKSTAR_API_KEY
//   TICKSTAR_SENDER_ID    your registered Peppol participant ID in Tickstar
// =============================================================================
// STATUS: Stub — implement send() and parseWebhook() once you have API access.
// =============================================================================

import type {
  PeppolProvider,
  PeppolSendRequest,
  PeppolSendResult,
  PeppolWebhookEvent,
} from "../PeppolProvider.ts";

export class TickstarProvider implements PeppolProvider {
  readonly name = "tickstar";

  private readonly apiKey: string;
  private readonly senderId: string;

  constructor(apiKey: string, senderId: string) {
    if (!apiKey) throw new Error("TickstarProvider: TICKSTAR_API_KEY is required.");
    if (!senderId) throw new Error("TickstarProvider: TICKSTAR_SENDER_ID is required.");
    this.apiKey = apiKey;
    this.senderId = senderId;
  }

  async send(_request: PeppolSendRequest): Promise<PeppolSendResult> {
    // TODO: POST https://api.tickstar.com/v1/documents
    // Headers: Authorization: Bearer <apiKey>
    // Body: base64 UBL XML + routing info
    throw new Error("TickstarProvider: send() is not yet implemented.");
  }

  parseWebhook(_rawBody: unknown, _headers: Record<string, string>): PeppolWebhookEvent {
    throw new Error("TickstarProvider: parseWebhook() is not yet implemented.");
  }

  async verifyWebhookSignature(
    _rawBody: string,
    _headers: Record<string, string>,
    _secret: string
  ): Promise<void> {
    throw new Error("TickstarProvider: verifyWebhookSignature() is not yet implemented.");
  }
}