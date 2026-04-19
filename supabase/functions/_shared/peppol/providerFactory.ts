// =============================================================================
// Provider Factory
// Reads PEPPOL_PROVIDER env var → returns the correct PeppolProvider instance.
// =============================================================================
// Set in Supabase Dashboard → Edge Functions → Manage secrets:
//   PEPPOL_PROVIDER = storecove   (default) | tickstar
// =============================================================================

import type { PeppolProvider } from "./PeppolProvider.ts";
import { StorecoveProvider } from "./providers/storecove.ts";
import { TickstarProvider } from "./providers/tickstar.ts";

export function getProvider(): PeppolProvider {
  const providerName = (Deno.env.get("PEPPOL_PROVIDER") ?? "storecove").toLowerCase();

  switch (providerName) {
    case "storecove":
      return new StorecoveProvider(
        Deno.env.get("STORECOVE_API_KEY") ?? "",
        Deno.env.get("STORECOVE_LEGAL_ENTITY_ID") ?? ""
      );

    case "tickstar":
      return new TickstarProvider(
        Deno.env.get("TICKSTAR_API_KEY") ?? "",
        Deno.env.get("TICKSTAR_SENDER_ID") ?? ""
      );

    default:
      throw new Error(
        `Unknown PEPPOL_PROVIDER: "${providerName}". Supported values: storecove, tickstar.`
      );
  }
}