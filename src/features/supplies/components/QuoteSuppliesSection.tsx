import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../../../components/ui/Card/Card";
import { EmptyState } from "../../../components/ui/EmptyState/EmptyState";
import { ErrorMessage } from "../../../components/ui/ErrorMessage/ErrorMessage";
import { LoadingBlock } from "../../../components/ui/LoadingBlock/LoadingBlock";
import { supabase } from "../../../lib/supabase";
import type { QuoteItem } from "../../quotes/types";
import type {
  ServiceMaterialRequirement,
  Supplier,
  SupplierProductOffer,
  SupplyProduct,
} from "../types";
import { calculateQuoteSupplyPlan } from "../utils/supplyCalculations";
import "./QuoteSuppliesSection.css";

type QuoteSuppliesSectionProps = {
  items: QuoteItem[];
  quoteSubtotalHt: number;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-BE", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value) || 0);
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat("fr-BE", {
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

export function QuoteSuppliesSection({
  items,
  quoteSubtotalHt,
}: QuoteSuppliesSectionProps) {
  const [requirements, setRequirements] = useState<ServiceMaterialRequirement[]>([]);
  const [products, setProducts] = useState<SupplyProduct[]>([]);
  const [offers, setOffers] = useState<SupplierProductOffer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const serviceIds = useMemo(
    () => Array.from(new Set(items.map((item) => item.service_catalog_id).filter(Boolean))) as string[],
    [items],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadSupplies() {
      setLoading(true);
      setError(null);

      if (serviceIds.length === 0) {
        if (!cancelled) {
          setRequirements([]);
          setProducts([]);
          setOffers([]);
          setSuppliers([]);
          setLoading(false);
        }
        return;
      }

      const requirementsRes = await supabase
        .from("service_material_requirements")
        .select("id, service_catalog_id, product_id, usage_role, coats, waste_percent, coverage_override, notes, is_optional, is_active, sort_order")
        .in("service_catalog_id", serviceIds)
        .eq("is_active", true)
        .order("sort_order");

      if (cancelled) return;
      if (requirementsRes.error) {
        setError(requirementsRes.error.message);
        setLoading(false);
        return;
      }

      const loadedRequirements = (requirementsRes.data ?? []) as ServiceMaterialRequirement[];
      const productIds = Array.from(new Set(loadedRequirements.map((item) => item.product_id)));
      if (productIds.length === 0) {
        setRequirements(loadedRequirements);
        setProducts([]);
        setOffers([]);
        setSuppliers([]);
        setLoading(false);
        return;
      }

      const [productsRes, offersRes] = await Promise.all([
        supabase
          .from("supply_products")
          .select("id, name, brand, category, package_quantity, package_unit, coverage_quantity, coverage_unit, notes, is_active")
          .in("id", productIds),
        supabase
          .from("supplier_product_offers")
          .select("id, product_id, supplier_id, supplier_sku, unit_price_ht, tva_rate, product_url, price_updated_at, is_preferred, is_active")
          .in("product_id", productIds)
          .eq("is_active", true),
      ]);

      if (cancelled) return;
      const dataError = productsRes.error ?? offersRes.error;
      if (dataError) {
        setError(dataError.message);
        setLoading(false);
        return;
      }

      const loadedOffers = (offersRes.data ?? []) as SupplierProductOffer[];
      const supplierIds = Array.from(new Set(loadedOffers.map((offer) => offer.supplier_id)));
      let loadedSuppliers: Supplier[] = [];
      if (supplierIds.length > 0) {
        const suppliersRes = await supabase
          .from("suppliers")
          .select("id, name, contact_name, email, phone, website, ordering_url, notes, is_active")
          .in("id", supplierIds);
        if (cancelled) return;
        if (suppliersRes.error) {
          setError(suppliersRes.error.message);
          setLoading(false);
          return;
        }
        loadedSuppliers = (suppliersRes.data ?? []) as Supplier[];
      }

      setRequirements(loadedRequirements);
      setProducts((productsRes.data ?? []) as SupplyProduct[]);
      setOffers(loadedOffers);
      setSuppliers(loadedSuppliers);
      setLoading(false);
    }

    void loadSupplies();
    return () => {
      cancelled = true;
    };
  }, [serviceIds]);

  const plan = useMemo(
    () => calculateQuoteSupplyPlan({ items, requirements, products, offers, suppliers }),
    [items, offers, products, requirements, suppliers],
  );

  if (loading) return <LoadingBlock message="Calcul des fournitures..." />;
  if (error) return <ErrorMessage message={error} />;

  if (serviceIds.length === 0) {
    return (
      <EmptyState
        title="Aucune prestation liée au catalogue"
        description="Ajoutez des prestations depuis le catalogue pour calculer automatiquement les marchandises nécessaires."
      />
    );
  }

  return (
    <section className="quote-supplies">
      <header className="quote-supplies__header">
        <div>
          <p className="quote-supplies__eyebrow">Estimation d’achat en direct</p>
          <h2>Fournitures du chantier</h2>
          <p>Les quantités sont regroupées par produit avant l’arrondi au conditionnement supérieur.</p>
        </div>
        <Link className="quote-supplies__catalog-link" to="/fournisseurs">
          Gérer le catalogue fournisseurs
        </Link>
      </header>

      <div className="quote-supplies__stats">
        <Card><span>Marchandises</span><strong>{plan.lines.length}</strong></Card>
        <Card><span>Conditionnements</span><strong>{plan.totalPackages}</strong></Card>
        <Card><span>Coût fournitures HT</span><strong>{formatCurrency(plan.totalPriceHt)}</strong></Card>
        <Card><span>Reste après fournitures</span><strong>{formatCurrency(Number(quoteSubtotalHt) - plan.totalPriceHt)}</strong></Card>
      </div>

      {plan.unmappedItems.length > 0 ? (
        <div className="quote-supplies__warning">
          <strong>{plan.unmappedItems.length} ligne(s) sans marchandise liée.</strong>
          <span>Complétez les liaisons dans le catalogue fournisseurs pour obtenir un calcul exhaustif.</span>
        </div>
      ) : null}

      {plan.lines.length === 0 ? (
        <EmptyState
          title="Aucune marchandise calculée"
          description="Les prestations du devis n’ont pas encore de produits associés."
        />
      ) : (
        <div className="quote-supplies__list">
          {plan.lines.map((line) => {
            const productOffers = offers.filter(
              (offer) =>
                offer.product_id === line.product.id
                && offer.is_active
                && suppliers.some(
                  (supplier) => supplier.id === offer.supplier_id && supplier.is_active,
                ),
            );
            return (
              <Card key={line.product.id} className="quote-supplies__line">
                <div className="quote-supplies__product">
                  <p className="quote-supplies__eyebrow">
                    {line.roles.join(" · ")}{line.optional ? " · Optionnel" : ""}
                  </p>
                  <h3>{line.product.brand ? `${line.product.brand} · ` : ""}{line.product.name}</h3>
                  <p>{line.sourceLabels.join(", ")}</p>
                </div>

                <div className="quote-supplies__metrics">
                  <div><span>Besoin calculé</span><strong>{formatQuantity(line.requiredCoverage)} {line.product.coverage_unit === "m2" ? "m²" : line.product.coverage_unit}</strong></div>
                  <div><span>À acheter</span><strong>{line.packages} × {formatQuantity(line.product.package_quantity)} {line.product.package_unit}</strong></div>
                  <div><span>Fournisseur</span><strong>{line.supplier?.name ?? "À renseigner"}</strong></div>
                  <div><span>Prix HT</span><strong>{line.offer ? `${formatCurrency(line.offer.unit_price_ht)} / conditionnement` : "Prix manquant"}</strong></div>
                </div>

                {line.incompatibleUnits.length > 0 ? (
                  <p className="quote-supplies__unit-warning">
                    Calcul impossible pour l’unité {line.incompatibleUnits.join(", ")} : le produit couvre {line.product.coverage_unit}.
                  </p>
                ) : null}

                <div className="quote-supplies__line-footer">
                  <span>{productOffers.length > 1 ? `${productOffers.length} offres fournisseur disponibles` : "Prix catalogue actuel"}</span>
                  <strong>{formatCurrency(line.totalPriceHt)} HT</strong>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <p className="quote-supplies__disclaimer">
        Estimation interne non affichée au client. Les prix et rendements restent à valider avant commande.
      </p>
    </section>
  );
}
