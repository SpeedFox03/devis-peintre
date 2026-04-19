// =============================================================================
// Peppol Provider — abstract interface + shared types
// =============================================================================
// To add a new Access Point provider:
//   1. Create a file in providers/myprovider.ts
//   2. Implement the PeppolProvider interface
//   3. Register it in providerFactory.ts
// =============================================================================

export type PeppolSendRequest = {
  /** Raw UBL 2.1 XML string */
  xml: string;
  /** Filename used as document identifier, e.g. "F2024-001.xml" */
  fileName: string;
  /** Receiver Peppol endpoint ID, e.g. "0208:1234567890" */
  receiverEndpointId: string;
  /** Receiver Peppol scheme, e.g. "0208" (BE KBO) or "0088" (GLN) */
  receiverEndpointScheme: string;
  /** Sender endpoint ID */
  senderEndpointId: string;
  /** Sender scheme */
  senderEndpointScheme: string;
  /** UBL document type identifier (optional — provider uses default if omitted) */
  documentTypeId?: string;
  /** Internal reference for tracing (invoice UUID) */
  invoiceId: string;
};

export type PeppolSendResult = {
  /** Provider-assigned message/transmission ID */
  providerMessageId: string;
  /** Raw response payload for auditing */
  rawResponse: unknown;
};

export type PeppolWebhookEvent = {
  /** Maps to invoice_peppol_events.event_type */
  eventType: "submitted" | "accepted" | "delivered" | "rejected" | "error";
  /** Provider message ID — correlates with the send result */
  providerMessageId: string;
  /** Human-readable error detail when eventType is "rejected" or "error" */
  errorMessage?: string;
  /** Full raw payload for audit storage */
  rawPayload: unknown;
};

export interface PeppolProvider {
  readonly name: string;

  /**
   * Sends a UBL invoice to the Peppol network.
   * Throws a descriptive Error on failure.
   */
  send(request: PeppolSendRequest): Promise<PeppolSendResult>;

  /**
   * Parses an inbound webhook body into a normalised PeppolWebhookEvent.
   * Throws if the payload is unrecognised or invalid.
   */
  parseWebhook(rawBody: unknown, headers: Record<string, string>): PeppolWebhookEvent;

  /**
   * Verifies the webhook HMAC signature for this provider.
   * Throws if verification fails.
   * MUST be awaited — signature check is async (Web Crypto API).
   */
  verifyWebhookSignature(
    rawBody: string,
    headers: Record<string, string>,
    secret: string
  ): Promise<void>;
}