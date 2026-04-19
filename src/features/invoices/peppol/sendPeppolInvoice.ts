import { supabase } from "../../../lib/supabase";

export type SendPeppolResult = {
  success: true;
  providerMessageId: string;
};

/**
 * Sends the invoice to the Peppol network via the send-peppol-invoice Edge Function.
 * Updates peppol_status in the DB — call loadInvoicePage() after this resolves.
 */
export async function sendPeppolInvoice(invoiceId: string): Promise<SendPeppolResult> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session) {
    throw new Error("Session expirée. Veuillez vous reconnecter.");
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-peppol-invoice`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ invoiceId }),
    }
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      (data as { error?: string })?.error ??
      `Erreur serveur (${response.status})`;
    throw new Error(message);
  }

  return data as SendPeppolResult;
}