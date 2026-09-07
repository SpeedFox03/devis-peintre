import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/hooks/useAuth";
import { formatCategorySlug } from "./catalogOptions";
import { CatalogTaxonomyContext } from "./catalogTaxonomy";
import type {
  CatalogCategory,
  CatalogTaxonomyValue,
  Trade,
} from "./catalogTaxonomy";

/**
 * Charge une fois le référentiel métiers et catégories, remplaçant la liste
 * qui était codée en dur dans catalogOptions.
 */
export function CatalogTaxonomyProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [allCategories, setAllCategories] = useState<CatalogCategory[]>([]);
  const [scopedSlugs, setScopedSlugs] = useState<string[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [activeTradeIds, setActiveTradeIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [reloadToken, setReloadToken] = useState(0);
  const refresh = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;

    async function load() {
      const [categoriesResult, tradesResult, companyTradesResult] =
        await Promise.all([
          supabase
            .from("catalog_categories")
            .select("slug, label, sort_order")
            .eq("is_active", true)
            .order("sort_order", { ascending: true }),
          supabase
            .from("trades")
            .select("id, slug, name, description, sort_order")
            .eq("is_active", true)
            .order("sort_order", { ascending: true }),
          supabase.from("company_trades").select("trade_id"),
        ]);

      if (cancelled) return;

      if (
        categoriesResult.error || tradesResult.error ||
        companyTradesResult.error
      ) {
        setError("Impossible de charger les métiers et catégories.");
        setLoading(false);
        return;
      }

      const tradeIds = (companyTradesResult.data ?? []).map((row) =>
        String(row.trade_id)
      );

      // Les catégories du périmètre dépendent des métiers actifs. Requête
      // séparée : une jointure imbriquée passerait mal les politiques RLS.
      let slugs: string[] = [];
      if (tradeIds.length > 0) {
        const { data, error: mappingError } = await supabase
          .from("trade_categories")
          .select("catalog_categories(slug)")
          .in("trade_id", tradeIds);

        if (cancelled) return;

        if (mappingError) {
          setError("Impossible de charger les catégories de vos métiers.");
          setLoading(false);
          return;
        }

        slugs = [
          ...new Set(
            (data ?? [])
              .map((row) =>
                (row as { catalog_categories?: { slug?: string } | null })
                  .catalog_categories?.slug
              )
              .filter((slug): slug is string => Boolean(slug)),
          ),
        ];
      }

      setError(null);
      setAllCategories((categoriesResult.data ?? []) as CatalogCategory[]);
      setTrades((tradesResult.data ?? []) as Trade[]);
      setActiveTradeIds(tradeIds);
      setScopedSlugs(slugs);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, reloadToken]);

  const labelBySlug = useMemo(
    () =>
      new Map(allCategories.map((category) => [category.slug, category.label])),
    [allCategories],
  );

  const getCategoryLabel = useCallback(
    (slug: string | null | undefined) => {
      if (!slug) return "Autre";
      return labelBySlug.get(slug) ?? formatCategorySlug(slug);
    },
    [labelBySlug],
  );

  const value = useMemo<CatalogTaxonomyValue>(() => {
    // Sans métier actif, on retombe sur le référentiel complet plutôt que sur
    // une liste vide : l'écran reste utilisable.
    const categories = scopedSlugs.length > 0
      ? allCategories.filter((category) => scopedSlugs.includes(category.slug))
      : allCategories;

    return {
      categories,
      trades,
      activeTrades: trades.filter((trade) => activeTradeIds.includes(trade.id)),
      loading: isAuthenticated ? loading : false,
      error,
      getCategoryLabel,
      refresh,
    };
  }, [
    activeTradeIds,
    allCategories,
    error,
    getCategoryLabel,
    isAuthenticated,
    refresh,
    loading,
    scopedSlugs,
    trades,
  ]);

  return (
    <CatalogTaxonomyContext.Provider value={value}>
      {children}
    </CatalogTaxonomyContext.Provider>
  );
}
