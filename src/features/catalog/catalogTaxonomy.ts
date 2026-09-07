import { createContext, useContext } from "react";

export type CatalogCategory = {
  slug: string;
  label: string;
  sort_order: number;
};

export type Trade = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sort_order: number;
};

export type CatalogTaxonomyValue = {
  /** Catégories des métiers actifs, dans l'ordre du référentiel. */
  categories: CatalogCategory[];
  /** Tous les métiers proposés par la plateforme. */
  trades: Trade[];
  /** Métiers activés par l'entreprise. */
  activeTrades: Trade[];
  loading: boolean;
  error: string | null;
  /** Libellé lisible d'un slug, y compris pour une catégorie hors périmètre. */
  getCategoryLabel: (slug: string | null | undefined) => string;
  /** Redemande le référentiel, après activation ou retrait d'un métier. */
  refresh: () => void;
};

export const CatalogTaxonomyContext = createContext<
  CatalogTaxonomyValue | null
>(null);

export function useCatalogTaxonomy() {
  const value = useContext(CatalogTaxonomyContext);
  if (!value) {
    throw new Error(
      "useCatalogTaxonomy doit être utilisé dans CatalogTaxonomyProvider.",
    );
  }
  return value;
}
