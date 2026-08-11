import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "../../../components/ui/Button/Button";
import { Card } from "../../../components/ui/Card/Card";
import { EmptyState } from "../../../components/ui/EmptyState/EmptyState";
import { ErrorMessage } from "../../../components/ui/ErrorMessage/ErrorMessage";
import { FormField } from "../../../components/ui/FormField/FormField";
import { FormGrid } from "../../../components/ui/FormGrid/FormGrid";
import {
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from "../../../components/ui/Icons/AppIcons";
import { LoadingBlock } from "../../../components/ui/LoadingBlock/LoadingBlock";
import { Select } from "../../../components/ui/Select/Select";
import { TextArea } from "../../../components/ui/TextArea/TextArea";
import { TextInput } from "../../../components/ui/TextInput/TextInput";
import { supabase } from "../../../lib/supabase";
import type {
  ProductFormState,
  RequirementFormState,
  ServiceCatalogSummary,
  ServiceMaterialRequirement,
  Supplier,
  SupplierFormState,
  SupplierProductOffer,
  SupplyProduct,
} from "../types";
import "./SupplyCatalogPage.css";

type SupplySection = "products" | "suppliers" | "requirements";

const initialSupplierForm: SupplierFormState = {
  name: "",
  contact_name: "",
  email: "",
  phone: "",
  website: "",
  ordering_url: "",
  notes: "",
};

const initialProductForm: ProductFormState = {
  name: "",
  brand: "",
  category: "Peinture",
  package_quantity: "10",
  package_unit: "L",
  coverage_quantity: "100",
  coverage_unit: "m2",
  notes: "",
  supplier_id: "",
  supplier_sku: "",
  unit_price_ht: "0",
  tva_rate: "21",
  product_url: "",
};

const initialRequirementForm: RequirementFormState = {
  service_catalog_id: "",
  product_id: "",
  usage_role: "Peinture de finition",
  coats: "2",
  waste_percent: "10",
  coverage_override: "",
  notes: "",
  is_optional: false,
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-BE", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value) || 0);
}

function nullable(value: string) {
  return value.trim() || null;
}

export function SupplyCatalogPage() {
  const [activeSection, setActiveSection] = useState<SupplySection>("products");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<SupplyProduct[]>([]);
  const [offers, setOffers] = useState<SupplierProductOffer[]>([]);
  const [requirements, setRequirements] = useState<ServiceMaterialRequirement[]>([]);
  const [services, setServices] = useState<ServiceCatalogSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [showRequirementForm, setShowRequirementForm] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [supplierForm, setSupplierForm] = useState(initialSupplierForm);
  const [productForm, setProductForm] = useState(initialProductForm);
  const [requirementForm, setRequirementForm] = useState(initialRequirementForm);

  async function loadCatalog(showLoader = true) {
    if (showLoader) setLoading(true);
    setError(null);

    const [suppliersRes, productsRes, offersRes, requirementsRes, servicesRes] =
      await Promise.all([
        supabase
          .from("suppliers")
          .select("id, name, contact_name, email, phone, website, ordering_url, notes, is_active")
          .order("name"),
        supabase
          .from("supply_products")
          .select("id, name, brand, category, package_quantity, package_unit, coverage_quantity, coverage_unit, notes, is_active")
          .order("name"),
        supabase
          .from("supplier_product_offers")
          .select("id, product_id, supplier_id, supplier_sku, unit_price_ht, tva_rate, product_url, price_updated_at, is_preferred, is_active")
          .order("unit_price_ht"),
        supabase
          .from("service_material_requirements")
          .select("id, service_catalog_id, product_id, usage_role, coats, waste_percent, coverage_override, notes, is_optional, is_active, sort_order")
          .order("sort_order"),
        supabase
          .from("service_catalog")
          .select("id, name, category, default_unit, is_active")
          .order("name"),
      ]);

    const firstError = [suppliersRes, productsRes, offersRes, requirementsRes, servicesRes]
      .find((result) => result.error)?.error;

    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return false;
    }

    setSuppliers((suppliersRes.data ?? []) as Supplier[]);
    setProducts((productsRes.data ?? []) as SupplyProduct[]);
    setOffers((offersRes.data ?? []) as SupplierProductOffer[]);
    setRequirements((requirementsRes.data ?? []) as ServiceMaterialRequirement[]);
    setServices((servicesRes.data ?? []) as ServiceCatalogSummary[]);
    setLoading(false);
    return true;
  }

  useEffect(() => {
    void Promise.resolve().then(() => loadCatalog());
  }, []);

  const supplierMap = useMemo(
    () => new Map(suppliers.map((supplier) => [supplier.id, supplier])),
    [suppliers],
  );
  const productMap = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );
  const serviceMap = useMemo(
    () => new Map(services.map((service) => [service.id, service])),
    [services],
  );

  const filteredProducts = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase("fr");
    if (!normalized) return products;
    return products.filter((product) =>
      [product.name, product.brand, product.category]
        .filter(Boolean)
        .some((value) => value?.toLocaleLowerCase("fr").includes(normalized)),
    );
  }, [products, search]);

  function getOfferForProduct(productId: string) {
    return offers
      .filter((offer) =>
        offer.product_id === productId
        && offer.is_active
        && supplierMap.get(offer.supplier_id)?.is_active,
      )
      .sort((left, right) => {
        if (left.is_preferred !== right.is_preferred) return left.is_preferred ? -1 : 1;
        return Number(left.unit_price_ht) - Number(right.unit_price_ht);
      })[0] ?? null;
  }

  function clearMessages() {
    setError(null);
    setSuccess(null);
  }

  function openSupplierCreate() {
    clearMessages();
    setEditingSupplierId(null);
    setSupplierForm(initialSupplierForm);
    setShowSupplierForm(true);
  }

  function openSupplierEdit(supplier: Supplier) {
    clearMessages();
    setEditingSupplierId(supplier.id);
    setSupplierForm({
      name: supplier.name,
      contact_name: supplier.contact_name ?? "",
      email: supplier.email ?? "",
      phone: supplier.phone ?? "",
      website: supplier.website ?? "",
      ordering_url: supplier.ordering_url ?? "",
      notes: supplier.notes ?? "",
    });
    setShowSupplierForm(true);
  }

  async function handleSupplierSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supplierForm.name.trim()) {
      setError("Le nom du fournisseur est obligatoire.");
      return;
    }

    setSaving(true);
    clearMessages();
    const payload = {
      name: supplierForm.name.trim(),
      contact_name: nullable(supplierForm.contact_name),
      email: nullable(supplierForm.email),
      phone: nullable(supplierForm.phone),
      website: nullable(supplierForm.website),
      ordering_url: nullable(supplierForm.ordering_url),
      notes: nullable(supplierForm.notes),
    };

    const result = editingSupplierId
      ? await supabase.from("suppliers").update(payload).eq("id", editingSupplierId)
      : await supabase.from("suppliers").insert(payload);

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    setShowSupplierForm(false);
    setEditingSupplierId(null);
    setSupplierForm(initialSupplierForm);
    await loadCatalog(false);
    setSuccess(editingSupplierId ? "Fournisseur mis à jour." : "Fournisseur ajouté.");
    setSaving(false);
  }

  function openProductCreate() {
    clearMessages();
    setEditingProductId(null);
    setProductForm({
      ...initialProductForm,
      supplier_id: suppliers.find((supplier) => supplier.is_active)?.id ?? "",
    });
    setShowProductForm(true);
  }

  function openProductEdit(product: SupplyProduct) {
    clearMessages();
    const offer = getOfferForProduct(product.id);
    setEditingProductId(product.id);
    setProductForm({
      name: product.name,
      brand: product.brand ?? "",
      category: product.category ?? "",
      package_quantity: String(product.package_quantity),
      package_unit: product.package_unit,
      coverage_quantity: String(product.coverage_quantity),
      coverage_unit: product.coverage_unit,
      notes: product.notes ?? "",
      supplier_id: offer?.supplier_id ?? suppliers[0]?.id ?? "",
      supplier_sku: offer?.supplier_sku ?? "",
      unit_price_ht: String(offer?.unit_price_ht ?? 0),
      tva_rate: String(offer?.tva_rate ?? 21),
      product_url: offer?.product_url ?? "",
    });
    setShowProductForm(true);
  }

  async function handleProductSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const coverage = Number(productForm.coverage_quantity);
    const packageQuantity = Number(productForm.package_quantity);
    if (!productForm.name.trim() || !productForm.supplier_id) {
      setError("Le produit et son fournisseur sont obligatoires.");
      return;
    }
    if (!(coverage > 0) || !(packageQuantity > 0)) {
      setError("Le conditionnement et le rendement doivent être supérieurs à zéro.");
      return;
    }

    setSaving(true);
    clearMessages();
    const productPayload = {
      name: productForm.name.trim(),
      brand: nullable(productForm.brand),
      category: nullable(productForm.category),
      package_quantity: packageQuantity,
      package_unit: productForm.package_unit.trim() || "pot",
      coverage_quantity: coverage,
      coverage_unit: productForm.coverage_unit.trim() || "m2",
      notes: nullable(productForm.notes),
    };

    let productId = editingProductId;
    if (productId) {
      const { error: productError } = await supabase
        .from("supply_products")
        .update(productPayload)
        .eq("id", productId);
      if (productError) {
        setError(productError.message);
        setSaving(false);
        return;
      }
    } else {
      const { data, error: productError } = await supabase
        .from("supply_products")
        .insert(productPayload)
        .select("id")
        .single();
      if (productError || !data) {
        setError(productError?.message ?? "Le produit n’a pas pu être créé.");
        setSaving(false);
        return;
      }
      productId = data.id;
    }

    const { error: preferenceError } = await supabase
      .from("supplier_product_offers")
      .update({ is_preferred: false })
      .eq("product_id", productId)
      .neq("supplier_id", productForm.supplier_id);

    if (preferenceError) {
      setError(`Produit enregistré, mais l’offre préférée n’a pas pu être mise à jour : ${preferenceError.message}`);
      setSaving(false);
      await loadCatalog(false);
      return;
    }

    const { error: offerError } = await supabase
      .from("supplier_product_offers")
      .upsert(
        {
          product_id: productId,
          supplier_id: productForm.supplier_id,
          supplier_sku: nullable(productForm.supplier_sku),
          unit_price_ht: Number(productForm.unit_price_ht) || 0,
          tva_rate: Number(productForm.tva_rate) || 0,
          product_url: nullable(productForm.product_url),
          price_updated_at: new Date().toISOString().slice(0, 10),
          is_preferred: true,
          is_active: true,
        },
        { onConflict: "product_id,supplier_id" },
      );

    if (offerError) {
      setError(`Produit enregistré, mais son prix n’a pas pu l’être : ${offerError.message}`);
      setSaving(false);
      await loadCatalog(false);
      return;
    }

    setShowProductForm(false);
    setEditingProductId(null);
    setProductForm(initialProductForm);
    await loadCatalog(false);
    setSuccess(editingProductId ? "Produit mis à jour." : "Produit et prix fournisseur ajoutés.");
    setSaving(false);
  }

  async function toggleSupplier(supplier: Supplier) {
    clearMessages();
    const { error: updateError } = await supabase
      .from("suppliers")
      .update({ is_active: !supplier.is_active })
      .eq("id", supplier.id);
    if (updateError) setError(updateError.message);
    else await loadCatalog(false);
  }

  async function toggleProduct(product: SupplyProduct) {
    clearMessages();
    const { error: updateError } = await supabase
      .from("supply_products")
      .update({ is_active: !product.is_active })
      .eq("id", product.id);
    if (updateError) setError(updateError.message);
    else await loadCatalog(false);
  }

  async function handleRequirementSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requirementForm.service_catalog_id || !requirementForm.product_id) {
      setError("Choisissez une prestation et un produit.");
      return;
    }

    setSaving(true);
    clearMessages();
    const { error: insertError } = await supabase
      .from("service_material_requirements")
      .insert({
        service_catalog_id: requirementForm.service_catalog_id,
        product_id: requirementForm.product_id,
        usage_role: requirementForm.usage_role.trim() || "Fourniture",
        coats: Number(requirementForm.coats) || 1,
        waste_percent: Number(requirementForm.waste_percent) || 0,
        coverage_override: requirementForm.coverage_override
          ? Number(requirementForm.coverage_override)
          : null,
        notes: nullable(requirementForm.notes),
        is_optional: requirementForm.is_optional,
        sort_order: requirements.length,
      });

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    setShowRequirementForm(false);
    setRequirementForm(initialRequirementForm);
    await loadCatalog(false);
    setSuccess("Marchandise liée à la prestation.");
    setSaving(false);
  }

  async function removeRequirement(requirement: ServiceMaterialRequirement) {
    const service = serviceMap.get(requirement.service_catalog_id)?.name ?? "cette prestation";
    if (!window.confirm(`Retirer cette marchandise de « ${service} » ?`)) return;
    clearMessages();
    const { error: deleteError } = await supabase
      .from("service_material_requirements")
      .delete()
      .eq("id", requirement.id);
    if (deleteError) setError(deleteError.message);
    else await loadCatalog(false);
  }

  if (loading) return <LoadingBlock message="Chargement du catalogue fournisseurs..." />;

  return (
    <section className="supply-catalog-page">
      <header className="supply-catalog-page__hero">
        <div>
          <p className="supply-catalog-page__eyebrow">Préparation de chantier</p>
          <h1>Fournisseurs et marchandises</h1>
          <p className="supply-catalog-page__description">
            Centralisez vos prix d’achat et reliez les produits aux prestations de votre catalogue.
          </p>
        </div>
      </header>

      <div className="supply-catalog-page__stats">
        <Card><span>Fournisseurs actifs</span><strong>{suppliers.filter((item) => item.is_active).length}</strong></Card>
        <Card><span>Produits actifs</span><strong>{products.filter((item) => item.is_active).length}</strong></Card>
        <Card><span>Liaisons prestations</span><strong>{requirements.filter((item) => item.is_active).length}</strong></Card>
      </div>

      <nav className="supply-catalog-page__tabs" aria-label="Catalogue fournisseurs">
        <Button variant={activeSection === "products" ? "primary" : "secondary"} onClick={() => setActiveSection("products")}>Produits et prix</Button>
        <Button variant={activeSection === "suppliers" ? "primary" : "secondary"} onClick={() => setActiveSection("suppliers")}>Fournisseurs</Button>
        <Button variant={activeSection === "requirements" ? "primary" : "secondary"} onClick={() => setActiveSection("requirements")}>Liaisons aux prestations</Button>
      </nav>

      {success ? <p className="supply-catalog-page__success" role="status">{success}</p> : null}
      {error ? <ErrorMessage message={error} /> : null}

      {activeSection === "suppliers" ? (
        <div className="supply-catalog-page__stack">
          <div className="supply-catalog-page__section-heading">
            <div><h2>Fournisseurs</h2><p>Contacts et accès à leurs espaces de commande.</p></div>
            <Button onClick={showSupplierForm ? () => setShowSupplierForm(false) : openSupplierCreate}>{showSupplierForm ? "Fermer" : <><PlusIcon /> Nouveau fournisseur</>}</Button>
          </div>

          {showSupplierForm ? (
            <Card>
              <form className="supply-catalog-page__form" onSubmit={handleSupplierSubmit}>
                <FormGrid columns="2">
                  <FormField label="Nom"><TextInput value={supplierForm.name} onChange={(event) => setSupplierForm({ ...supplierForm, name: event.target.value })} /></FormField>
                  <FormField label="Personne de contact"><TextInput value={supplierForm.contact_name} onChange={(event) => setSupplierForm({ ...supplierForm, contact_name: event.target.value })} /></FormField>
                  <FormField label="E-mail"><TextInput type="email" value={supplierForm.email} onChange={(event) => setSupplierForm({ ...supplierForm, email: event.target.value })} /></FormField>
                  <FormField label="Téléphone"><TextInput value={supplierForm.phone} onChange={(event) => setSupplierForm({ ...supplierForm, phone: event.target.value })} /></FormField>
                  <FormField label="Site web"><TextInput type="url" value={supplierForm.website} onChange={(event) => setSupplierForm({ ...supplierForm, website: event.target.value })} /></FormField>
                  <FormField label="Lien de commande"><TextInput type="url" value={supplierForm.ordering_url} onChange={(event) => setSupplierForm({ ...supplierForm, ordering_url: event.target.value })} /></FormField>
                </FormGrid>
                <FormField label="Notes"><TextArea rows={3} value={supplierForm.notes} onChange={(event) => setSupplierForm({ ...supplierForm, notes: event.target.value })} /></FormField>
                <div className="supply-catalog-page__form-actions"><Button type="submit" disabled={saving}>{saving ? "Enregistrement..." : editingSupplierId ? "Enregistrer" : "Ajouter"}</Button><Button type="button" variant="secondary" onClick={() => setShowSupplierForm(false)}>Annuler</Button></div>
              </form>
            </Card>
          ) : null}

          {suppliers.length === 0 ? <EmptyState title="Aucun fournisseur" description="Ajoutez le premier fournisseur avant d’enregistrer ses produits." actionLabel="Ajouter un fournisseur" onAction={openSupplierCreate} /> : (
            <div className="supply-catalog-page__card-grid">
              {suppliers.map((supplier) => (
                <Card key={supplier.id} className="supply-catalog-page__entity-card">
                  <div className="supply-catalog-page__entity-header"><div><h3>{supplier.name}</h3><p>{supplier.contact_name || supplier.email || "Aucun contact renseigné"}</p></div><span className={supplier.is_active ? "is-active" : "is-inactive"}>{supplier.is_active ? "Actif" : "Inactif"}</span></div>
                  <div className="supply-catalog-page__entity-details">{supplier.phone ? <span>{supplier.phone}</span> : null}{supplier.website ? <a href={supplier.website} target="_blank" rel="noreferrer">Voir le site</a> : null}</div>
                  <div className="supply-catalog-page__entity-actions"><Button size="sm" variant="secondary" onClick={() => openSupplierEdit(supplier)}><PencilIcon /> Modifier</Button><Button size="sm" variant="secondary" onClick={() => toggleSupplier(supplier)}>{supplier.is_active ? "Désactiver" : "Activer"}</Button></div>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {activeSection === "products" ? (
        <div className="supply-catalog-page__stack">
          <div className="supply-catalog-page__section-heading">
            <div><h2>Produits et tarifs</h2><p>Le rendement correspond à la surface couverte par un conditionnement.</p></div>
            <Button onClick={showProductForm ? () => setShowProductForm(false) : openProductCreate} disabled={suppliers.length === 0}>{showProductForm ? "Fermer" : <><PlusIcon /> Nouveau produit</>}</Button>
          </div>

          {showProductForm ? (
            <Card>
              <form className="supply-catalog-page__form" onSubmit={handleProductSubmit}>
                <FormGrid columns="3">
                  <FormField label="Produit"><TextInput value={productForm.name} onChange={(event) => setProductForm({ ...productForm, name: event.target.value })} placeholder="Peinture mur acrylique mate" /></FormField>
                  <FormField label="Marque"><TextInput value={productForm.brand} onChange={(event) => setProductForm({ ...productForm, brand: event.target.value })} /></FormField>
                  <FormField label="Catégorie"><TextInput value={productForm.category} onChange={(event) => setProductForm({ ...productForm, category: event.target.value })} /></FormField>
                </FormGrid>
                <FormGrid columns="4">
                  <FormField label="Contenance"><TextInput type="number" min="0.001" step="0.001" value={productForm.package_quantity} onChange={(event) => setProductForm({ ...productForm, package_quantity: event.target.value })} /></FormField>
                  <FormField label="Unité du conditionnement"><TextInput value={productForm.package_unit} onChange={(event) => setProductForm({ ...productForm, package_unit: event.target.value })} placeholder="L, kg, rouleau..." /></FormField>
                  <FormField label="Rendement par conditionnement"><TextInput type="number" min="0.001" step="0.001" value={productForm.coverage_quantity} onChange={(event) => setProductForm({ ...productForm, coverage_quantity: event.target.value })} /></FormField>
                  <FormField label="Unité couverte"><Select value={productForm.coverage_unit} onChange={(event) => setProductForm({ ...productForm, coverage_unit: event.target.value })}><option value="m2">m²</option><option value="m">mètre</option><option value="unite">unité</option></Select></FormField>
                </FormGrid>
                <FormGrid columns="3">
                  <FormField label="Fournisseur"><Select value={productForm.supplier_id} onChange={(event) => setProductForm({ ...productForm, supplier_id: event.target.value })}><option value="">Sélectionner</option>{suppliers.filter((supplier) => supplier.is_active).map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</Select></FormField>
                  <FormField label="Référence fournisseur"><TextInput value={productForm.supplier_sku} onChange={(event) => setProductForm({ ...productForm, supplier_sku: event.target.value })} /></FormField>
                  <FormField label="Prix du conditionnement HT"><TextInput type="number" min="0" step="0.01" value={productForm.unit_price_ht} onChange={(event) => setProductForm({ ...productForm, unit_price_ht: event.target.value })} /></FormField>
                  <FormField label="TVA (%)"><TextInput type="number" min="0" max="100" step="0.01" value={productForm.tva_rate} onChange={(event) => setProductForm({ ...productForm, tva_rate: event.target.value })} /></FormField>
                  <FormField label="Lien du produit"><TextInput type="url" value={productForm.product_url} onChange={(event) => setProductForm({ ...productForm, product_url: event.target.value })} /></FormField>
                </FormGrid>
                <FormField label="Notes / teinte / finition"><TextArea rows={3} value={productForm.notes} onChange={(event) => setProductForm({ ...productForm, notes: event.target.value })} /></FormField>
                <div className="supply-catalog-page__form-actions"><Button type="submit" disabled={saving}>{saving ? "Enregistrement..." : editingProductId ? "Enregistrer" : "Ajouter le produit"}</Button><Button type="button" variant="secondary" onClick={() => setShowProductForm(false)}>Annuler</Button></div>
              </form>
            </Card>
          ) : null}

          {products.length > 0 ? <FormField label="Rechercher"><TextInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Produit, marque ou catégorie..." /></FormField> : null}
          {suppliers.length === 0 ? <EmptyState title="Commencez par un fournisseur" description="Un prix produit doit être rattaché à un fournisseur." actionLabel="Créer un fournisseur" onAction={() => { setActiveSection("suppliers"); openSupplierCreate(); }} /> : filteredProducts.length === 0 ? <EmptyState title={products.length === 0 ? "Aucun produit" : "Aucun résultat"} description={products.length === 0 ? "Ajoutez un premier produit avec son rendement et son prix d’achat." : "Aucun produit ne correspond à cette recherche."} actionLabel={products.length === 0 ? "Ajouter un produit" : undefined} onAction={products.length === 0 ? openProductCreate : undefined} /> : (
            <div className="supply-catalog-page__card-grid supply-catalog-page__card-grid--products">
              {filteredProducts.map((product) => {
                const offer = getOfferForProduct(product.id);
                const supplier = offer ? supplierMap.get(offer.supplier_id) : null;
                return <Card key={product.id} className="supply-catalog-page__entity-card"><div className="supply-catalog-page__entity-header"><div><p className="supply-catalog-page__overline">{product.brand || product.category || "Marchandise"}</p><h3>{product.name}</h3><p>{product.package_quantity} {product.package_unit} · couvre {product.coverage_quantity} {product.coverage_unit === "m2" ? "m²" : product.coverage_unit}</p></div><strong className="supply-catalog-page__price">{formatCurrency(Number(offer?.unit_price_ht ?? 0))}</strong></div><div className="supply-catalog-page__entity-details"><span>{supplier?.name ?? "Aucun fournisseur actif"}</span>{offer?.supplier_sku ? <span>Réf. {offer.supplier_sku}</span> : null}<span className={product.is_active ? "is-active" : "is-inactive"}>{product.is_active ? "Actif" : "Inactif"}</span></div><div className="supply-catalog-page__entity-actions"><Button size="sm" variant="secondary" onClick={() => openProductEdit(product)}><PencilIcon /> Modifier</Button><Button size="sm" variant="secondary" onClick={() => toggleProduct(product)}>{product.is_active ? "Désactiver" : "Activer"}</Button></div></Card>;
              })}
            </div>
          )}
        </div>
      ) : null}

      {activeSection === "requirements" ? (
        <div className="supply-catalog-page__stack">
          <div className="supply-catalog-page__section-heading">
            <div><h2>Marchandises par prestation</h2><p>Indiquez les couches et la perte prévues pour chaque produit consommé.</p></div>
            <Button onClick={() => { clearMessages(); setShowRequirementForm((current) => !current); setRequirementForm({ ...initialRequirementForm, service_catalog_id: services.find((service) => service.is_active)?.id ?? "", product_id: products.find((product) => product.is_active)?.id ?? "" }); }} disabled={services.length === 0 || products.length === 0}>{showRequirementForm ? "Fermer" : <><PlusIcon /> Nouvelle liaison</>}</Button>
          </div>

          {showRequirementForm ? <Card><form className="supply-catalog-page__form" onSubmit={handleRequirementSubmit}><FormGrid columns="2"><FormField label="Prestation"><Select value={requirementForm.service_catalog_id} onChange={(event) => setRequirementForm({ ...requirementForm, service_catalog_id: event.target.value })}><option value="">Sélectionner</option>{services.filter((service) => service.is_active).map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</Select></FormField><FormField label="Produit"><Select value={requirementForm.product_id} onChange={(event) => setRequirementForm({ ...requirementForm, product_id: event.target.value })}><option value="">Sélectionner</option>{products.filter((product) => product.is_active).map((product) => <option key={product.id} value={product.id}>{product.brand ? `${product.brand} · ` : ""}{product.name}</option>)}</Select></FormField></FormGrid><FormGrid columns="3"><FormField label="Rôle"><TextInput value={requirementForm.usage_role} onChange={(event) => setRequirementForm({ ...requirementForm, usage_role: event.target.value })} placeholder="Primaire, finition..." /></FormField><FormField label="Nombre de couches"><TextInput type="number" min="0.01" step="0.01" value={requirementForm.coats} onChange={(event) => setRequirementForm({ ...requirementForm, coats: event.target.value })} /></FormField><FormField label="Perte prévue (%)"><TextInput type="number" min="0" max="100" step="0.1" value={requirementForm.waste_percent} onChange={(event) => setRequirementForm({ ...requirementForm, waste_percent: event.target.value })} /></FormField></FormGrid><FormGrid columns="2"><FormField label="Rendement particulier (facultatif)"><TextInput type="number" min="0.001" step="0.001" value={requirementForm.coverage_override} onChange={(event) => setRequirementForm({ ...requirementForm, coverage_override: event.target.value })} placeholder="Sinon rendement du produit" /></FormField><FormField label="Notes"><TextInput value={requirementForm.notes} onChange={(event) => setRequirementForm({ ...requirementForm, notes: event.target.value })} /></FormField></FormGrid><label className="supply-catalog-page__checkbox"><input type="checkbox" checked={requirementForm.is_optional} onChange={(event) => setRequirementForm({ ...requirementForm, is_optional: event.target.checked })} /> Fourniture optionnelle</label><div className="supply-catalog-page__form-actions"><Button type="submit" disabled={saving}>{saving ? "Enregistrement..." : "Créer la liaison"}</Button><Button type="button" variant="secondary" onClick={() => setShowRequirementForm(false)}>Annuler</Button></div></form></Card> : null}

          {requirements.length === 0 ? <EmptyState title="Aucune liaison" description="Reliez un produit à une prestation pour alimenter automatiquement l’onglet Fournitures des devis." actionLabel={products.length > 0 ? "Créer une liaison" : undefined} onAction={products.length > 0 ? () => setShowRequirementForm(true) : undefined} /> : (
            <div className="supply-catalog-page__requirements">
              {requirements.map((requirement) => {
                const service = serviceMap.get(requirement.service_catalog_id);
                const product = productMap.get(requirement.product_id);
                return <Card key={requirement.id} className="supply-catalog-page__requirement"><div><p className="supply-catalog-page__overline">{requirement.usage_role}{requirement.is_optional ? " · Optionnel" : ""}</p><h3>{service?.name ?? "Prestation supprimée"}</h3><p>{product?.brand ? `${product.brand} · ` : ""}{product?.name ?? "Produit indisponible"}</p></div><div className="supply-catalog-page__requirement-values"><span>{Number(requirement.coats)} couche(s)</span><span>{Number(requirement.waste_percent)} % de perte</span></div><Button iconOnly size="sm" variant="danger" onClick={() => removeRequirement(requirement)} aria-label="Retirer la liaison"><TrashIcon /></Button></Card>;
              })}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
