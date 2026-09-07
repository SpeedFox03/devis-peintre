import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { json } from "./http.ts";
import type {
  CatalogService,
  ExistingRoom,
  TradeSlug,
} from "./shared/types.ts";
import { isTradeSlug } from "./shared/types.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function createUserClient(authorization: string) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
  });
}

// Sur `createClient` directement, ReturnType instancierait les génériques avec
// leurs défauts (`never`) et casserait tous les appels en aval.
type UserClient = ReturnType<typeof createUserClient>;

export type Session = {
  userClient: UserClient;
  userId: string;
};

export type QuoteContext = {
  rooms: ExistingRoom[];
  services: CatalogService[];
  /** Slugs de catégories autorisés, issus des métiers actifs de l'entreprise. */
  categories: string[];
  /** Métiers actifs, dans l'ordre du référentiel. */
  activeTrades: TradeSlug[];
  /** Métier retenu pour cette dictée, null si l'entreprise en cumule plusieurs. */
  trade: TradeSlug | null;
};

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; response: Response };

/**
 * Le client est créé avec le JWT de l'utilisateur : les politiques RLS
 * s'appliquent, aucune requête n'utilise la clé de service.
 */
export async function authenticate(
  authorization: string,
): Promise<Result<Session>> {
  const userClient = createUserClient(authorization);

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    return {
      ok: false,
      response: json({ error: "Session invalide ou expirée." }, 401),
    };
  }

  return { ok: true, value: { userClient, userId: user.id } };
}

/**
 * Valide l'accès au devis et son état, charge les pièces et le catalogue
 * actif, puis réserve un appel dans le quota horaire.
 */
export async function loadQuoteContext(
  { userClient, userId }: Session,
  quoteId: string,
  requestedTrade: TradeSlug | null,
): Promise<Result<QuoteContext>> {
  const { data: quote, error: quoteError } = await userClient
    .from("quotes")
    .select("id, company_id, owner_user_id, status")
    .eq("id", quoteId)
    .eq("owner_user_id", userId)
    .single();

  if (quoteError || !quote) {
    return {
      ok: false,
      response: json({ error: "Devis introuvable ou accès refusé." }, 403),
    };
  }

  if (!["draft", "sent"].includes(String(quote.status))) {
    return {
      ok: false,
      response: json(
        { error: "Ce devis ne peut plus recevoir de nouvelles lignes." },
        422,
      ),
    };
  }

  // Métiers actifs de l'entreprise. Un artisan en pratique souvent plusieurs.
  //
  // Un devis anterieur au cloisonnement par entreprise peut ne pas avoir de
  // company_id : on saute la requete plutot que d'envoyer un filtre `eq.null`,
  // que PostgREST n'interprete pas comme une comparaison a NULL.
  const companyId = typeof quote.company_id === "string"
    ? quote.company_id
    : null;

  const { data: tradeRows, error: tradesError } = companyId
    ? await userClient
      .from("company_trades")
      .select("trade_id, trades(slug, sort_order)")
      .eq("company_id", companyId)
    : { data: [], error: null };

  if (tradesError) {
    return {
      ok: false,
      response: json({ error: "Impossible de charger vos métiers." }, 500),
    };
  }

  const tradeEntries = (tradeRows ?? [])
    .map((row) => {
      const trade = row.trades as
        | { slug?: unknown; sort_order?: unknown }
        | null;
      return {
        id: String(row.trade_id),
        slug: trade?.slug,
        sortOrder: Number(trade?.sort_order ?? 0),
      };
    })
    .filter((entry): entry is { id: string; slug: TradeSlug; sortOrder: number } =>
      isTradeSlug(entry.slug)
    )
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const activeTrades = tradeEntries.map((entry) => entry.slug);

  if (requestedTrade && !activeTrades.includes(requestedTrade)) {
    return {
      ok: false,
      response: json(
        {
          error:
            "Ce métier n'est pas activé pour votre entreprise. Activez-le dans les paramètres.",
        },
        422,
      ),
    };
  }

  // Sans sélection explicite, on ne restreint que si un seul métier est actif.
  const trade = requestedTrade ??
    (activeTrades.length === 1 ? activeTrades[0] : null);

  const scopedTradeIds = trade
    ? tradeEntries.filter((entry) => entry.slug === trade).map((e) => e.id)
    : tradeEntries.map((entry) => entry.id);

  let servicesQuery = userClient
    .from("service_catalog")
    .select(
      "id, name, category, default_unit, default_unit_price_ht, default_tva_rate, default_description, default_metadata, is_active",
    )
    .eq("owner_user_id", userId)
    .eq("is_active", true);

  // Restreindre le catalogue réduit le coût du prompt et les confusions entre
  // prestations proches de deux métiers. Les prestations sans métier restent
  // toujours proposées : ce sont celles que l'artisan a créées lui-même.
  if (trade && scopedTradeIds.length > 0) {
    servicesQuery = servicesQuery.or(
      `trade_id.in.(${scopedTradeIds.join(",")}),trade_id.is.null`,
    );
  }

  const [roomsResult, servicesResult, categoriesResult] = await Promise.all([
    userClient
      .from("quote_rooms")
      .select("id, name, notes")
      .eq("quote_id", quoteId)
      .order("sort_order", { ascending: true }),
    servicesQuery
      .order("category", { ascending: true })
      .order("name", { ascending: true }),
    scopedTradeIds.length > 0
      ? userClient
        .from("trade_categories")
        .select("catalog_categories(slug, sort_order)")
        .in("trade_id", scopedTradeIds)
      : userClient
        .from("catalog_categories")
        .select("slug, sort_order")
        .eq("is_active", true),
  ]);

  if (roomsResult.error || servicesResult.error || categoriesResult.error) {
    return {
      ok: false,
      response: json(
        { error: "Impossible de charger le devis et son catalogue." },
        500,
      ),
    };
  }

  const rooms = (roomsResult.data ?? []) as ExistingRoom[];
  const services = (servicesResult.data ?? []) as CatalogService[];

  const categorySeen = new Map<string, number>();
  for (const row of categoriesResult.data ?? []) {
    const source = (row as Record<string, unknown>).catalog_categories ?? row;
    const category = source as { slug?: unknown; sort_order?: unknown } | null;
    const slug = typeof category?.slug === "string" ? category.slug : null;
    if (slug && !categorySeen.has(slug)) {
      categorySeen.set(slug, Number(category?.sort_order ?? 0));
    }
  }

  const categories = [...categorySeen.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([slug]) => slug);

  if (categories.length === 0) {
    return {
      ok: false,
      response: json(
        {
          error:
            "Aucune catégorie de prestation n'est disponible. Activez un métier dans les paramètres.",
        },
        422,
      ),
    };
  }

  if (services.length === 0) {
    return {
      ok: false,
      response: json(
        {
          error:
            "Le catalogue ne contient aucune prestation active. Ajoutez une prestation avant d'utiliser l'assistant.",
        },
        422,
      ),
    };
  }

  const { error: rateLimitError } = await userClient.rpc(
    "reserve_quote_voice_request",
    { p_quote_id: quoteId },
  );

  if (rateLimitError) {
    const message = String(rateLimitError.message ?? "");
    if (message.includes("Limite atteinte")) {
      return { ok: false, response: json({ error: message }, 429) };
    }

    console.error("voice-quote-draft rate limit", rateLimitError);
    return {
      ok: false,
      response: json(
        { error: "Impossible de démarrer l'analyse pour le moment." },
        503,
      ),
    };
  }

  return {
    ok: true,
    value: { rooms, services, categories, activeTrades, trade },
  };
}
