import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "../../../lib/supabase";
import { LoadingBlock } from "../../../components/ui/LoadingBlock/LoadingBlock";
import { EmptyState } from "../../../components/ui/EmptyState/EmptyState";
import { ErrorMessage } from "../../../components/ui/ErrorMessage/ErrorMessage";
import { Button } from "../../../components/ui/Button/Button";
import { Card } from "../../../components/ui/Card/Card";
import { DataTable } from "../../../components/ui/DataTable/DataTable";
import { FormField } from "../../../components/ui/FormField/FormField";
import { FormGrid } from "../../../components/ui/FormGrid/FormGrid";
import { Select } from "../../../components/ui/Select/Select";
import { TextArea } from "../../../components/ui/TextArea/TextArea";
import { TextInput } from "../../../components/ui/TextInput/TextInput";
import {
  PAINT_CATEGORIES,
  PAINT_UNITS,
  getCategoryLabel,
  getUnitLabel,
} from "../catalogOptions";
import "./ServiceCatalogPage.css";

type ServiceCatalogItem = {
  id: string;
  name: string;
  category: string | null;
  default_unit: string;
  default_unit_price_ht: number;
  default_tva_rate: number;
  default_description: string | null;
  is_active: boolean;
  created_at: string;
};

type ServiceCatalogFormState = {
  name: string;
  category: string;
  default_unit: string;
  default_unit_price_ht: string;
  default_tva_rate: string;
  default_description: string;
};

const initialForm: ServiceCatalogFormState = {
  name: "",
  category: "painting",
  default_unit: "m2",
  default_unit_price_ht: "0",
  default_tva_rate: "21",
  default_description: "",
};

function formatCurrency(value: number) {
  return `${Number(value || 0).toFixed(2)} €`;
}

export function ServiceCatalogPage() {
  const [services, setServices] = useState<ServiceCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingServiceId, setUpdatingServiceId] = useState<string | null>(null);
  const [deletingServiceId, setDeletingServiceId] = useState<string | null>(null);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<ServiceCatalogFormState>(initialForm);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  async function loadServices() {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("service_catalog")
      .select(
        "id, name, category, default_unit, default_unit_price_ht, default_tva_rate, default_description, is_active, created_at"
      )
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setServices((data ?? []) as ServiceCatalogItem[]);
    setLoading(false);
  }

  useEffect(() => {
    void loadServices();
  }, []);

  const filteredServices = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return services.filter((service) => {
      const matchesSearch =
        !normalizedSearch ||
        service.name.toLowerCase().includes(normalizedSearch) ||
        (service.default_description ?? "").toLowerCase().includes(normalizedSearch);

      const matchesCategory =
        categoryFilter === "all" || service.category === categoryFilter;

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && service.is_active) ||
        (statusFilter === "inactive" && !service.is_active);

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [services, search, categoryFilter, statusFilter]);

  function updateField<K extends keyof ServiceCatalogFormState>(
    field: K,
    value: ServiceCatalogFormState[K]
  ) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function resetForm() {
    setForm(initialForm);
    setEditingServiceId(null);
    setError(null);
  }

  function openCreateForm() {
    resetForm();
    setShowForm(true);
  }

  function closeCreateForm() {
    setShowForm(false);
    resetForm();
  }

  function openEditForm(service: ServiceCatalogItem) {
    setForm({
      name: service.name,
      category: service.category ?? "other",
      default_unit: service.default_unit,
      default_unit_price_ht: String(service.default_unit_price_ht),
      default_tva_rate: String(service.default_tva_rate),
      default_description: service.default_description ?? "",
    });
    setEditingServiceId(service.id);
    setShowForm(true);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setError("Utilisateur non connecté.");
      setSaving(false);
      return;
    }

    const payload = {
      owner_user_id: user.id,
      name: form.name.trim(),
      category: form.category || null,
      default_unit: form.default_unit,
      default_unit_price_ht: Number(form.default_unit_price_ht || 0),
      default_tva_rate: Number(form.default_tva_rate || 21),
      default_description: form.default_description.trim() || null,
      default_metadata: {},
    };

    if (!payload.name) {
      setError("Le nom de la prestation est obligatoire.");
      setSaving(false);
      return;
    }

    if (editingServiceId) {
      const { error } = await supabase
        .from("service_catalog")
        .update(payload)
        .eq("id", editingServiceId);

      if (error) {
        setError(error.message);
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase.from("service_catalog").insert({
        ...payload,
        is_active: true,
      });

      if (error) {
        setError(error.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setShowForm(false);
    resetForm();
    await loadServices();
  }

  async function handleToggleActive(service: ServiceCatalogItem) {
    setUpdatingServiceId(service.id);
    setError(null);

    const { error } = await supabase
      .from("service_catalog")
      .update({ is_active: !service.is_active })
      .eq("id", service.id);

    if (error) {
      setError(error.message);
      setUpdatingServiceId(null);
      return;
    }

    setUpdatingServiceId(null);
    await loadServices();
  }

  async function handleDelete(serviceId: string) {
    const confirmed = window.confirm("Supprimer cette prestation du catalogue ?");
    if (!confirmed) return;

    setDeletingServiceId(serviceId);
    setError(null);

    const { error } = await supabase
      .from("service_catalog")
      .delete()
      .eq("id", serviceId);

    if (error) {
      setError(error.message);
      setDeletingServiceId(null);
      return;
    }

    setDeletingServiceId(null);
    await loadServices();
  }

  const totalServices = services.length;
  const activeServices = services.filter((service) => service.is_active).length;
  const inactiveServices = services.filter((service) => !service.is_active).length;
  const averagePrice =
    services.length > 0
      ? services.reduce(
          (sum, service) => sum + Number(service.default_unit_price_ht || 0),
          0
        ) / services.length
      : 0;

  if (loading) {
    return <LoadingBlock message="Chargement du catalogue..." />;
  }

  return (
    <section className="catalog-premium-page">
      <header className="catalog-premium-page__hero">
        <div className="catalog-premium-page__hero-main">
          <p className="catalog-premium-page__eyebrow">Bibliothèque métier</p>
          <h1 className="catalog-premium-page__title">Catalogue de prestations</h1>
          <p className="catalog-premium-page__description">
            Structure tes prestations récurrentes pour accélérer la création des devis
            et uniformiser tes intitulés, unités et prix par défaut.
          </p>
        </div>

        <div className="catalog-premium-page__hero-actions">
          <Button
            variant="primary"
            onClick={showForm ? closeCreateForm : openCreateForm}
          >
            {showForm ? "Fermer le formulaire" : "Nouvelle prestation"}
          </Button>
        </div>
      </header>

      <div className="catalog-premium-page__stats">
        <Card>
          <p className="catalog-premium-page__stat-label">Total prestations</p>
          <p className="catalog-premium-page__stat-value">{totalServices}</p>
        </Card>

        <Card>
          <p className="catalog-premium-page__stat-label">Actives</p>
          <p className="catalog-premium-page__stat-value">{activeServices}</p>
        </Card>

        <Card>
          <p className="catalog-premium-page__stat-label">Inactives</p>
          <p className="catalog-premium-page__stat-value">{inactiveServices}</p>
        </Card>

        <Card>
          <p className="catalog-premium-page__stat-label">Prix moyen HT</p>
          <p className="catalog-premium-page__stat-value">
            {formatCurrency(averagePrice)}
          </p>
        </Card>
      </div>

      {showForm && (
        <Card>
          <div className="catalog-premium-page__form-intro">
            <div>
              <p className="catalog-premium-page__section-eyebrow">
                {editingServiceId ? "Modification" : "Création"}
              </p>
              <h2 className="catalog-premium-page__section-title">
                {editingServiceId
                  ? "Modifier la prestation"
                  : "Créer une prestation type"}
              </h2>
              <p className="catalog-premium-page__section-description">
                Enregistre une prestation métier standard pour la réutiliser ensuite
                dans tes devis en un clic.
              </p>
            </div>
          </div>

          <form className="catalog-premium-page__form" onSubmit={handleSubmit}>
            <FormGrid columns="2">
              <FormField label="Nom">
                <TextInput
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder="Peinture murs acrylique 2 couches"
                />
              </FormField>

              <FormField label="Catégorie">
                <Select
                  value={form.category}
                  onChange={(e) => updateField("category", e.target.value)}
                >
                  {PAINT_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {getCategoryLabel(category)}
                    </option>
                  ))}
                </Select>
              </FormField>
            </FormGrid>

            <FormGrid columns="3">
              <FormField label="Unité">
                <Select
                  value={form.default_unit}
                  onChange={(e) => updateField("default_unit", e.target.value)}
                >
                  {PAINT_UNITS.map((unit) => (
                    <option key={unit} value={unit}>
                      {getUnitLabel(unit)}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Prix unitaire HT">
                <TextInput
                  type="number"
                  step="0.01"
                  value={form.default_unit_price_ht}
                  onChange={(e) =>
                    updateField("default_unit_price_ht", e.target.value)
                  }
                />
              </FormField>

              <FormField label="TVA (%)">
                <TextInput
                  type="number"
                  step="0.01"
                  value={form.default_tva_rate}
                  onChange={(e) => updateField("default_tva_rate", e.target.value)}
                />
              </FormField>
            </FormGrid>

            <FormField label="Description">
              <TextArea
                rows={4}
                value={form.default_description}
                onChange={(e) =>
                  updateField("default_description", e.target.value)
                }
              />
            </FormField>

            {error && <ErrorMessage message={error} />}

            <div className="catalog-premium-page__form-actions">
              <Button type="submit" disabled={saving}>
                {saving
                  ? "Enregistrement..."
                  : editingServiceId
                  ? "Enregistrer la modification"
                  : "Créer la prestation"}
              </Button>

              <Button type="button" variant="secondary" onClick={closeCreateForm}>
                Annuler
              </Button>
            </div>
          </form>
        </Card>
      )}

      {!showForm && (
        <Card>
          <div className="catalog-premium-page__filters">
            <div className="catalog-premium-page__filters-intro">
              <p className="catalog-premium-page__section-eyebrow">Liste</p>
              <h2 className="catalog-premium-page__section-title">
                Prestations enregistrées
              </h2>
            </div>

            <div className="catalog-premium-page__filters-grid">
              <FormField label="Recherche">
                <TextInput
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nom ou description..."
                />
              </FormField>

              <FormField label="Catégorie">
                <Select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="all">Toutes</option>
                  {PAINT_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {getCategoryLabel(category)}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Statut">
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">Tous</option>
                  <option value="active">Actives</option>
                  <option value="inactive">Inactives</option>
                </Select>
              </FormField>
            </div>
          </div>
        </Card>
      )}

      {error && !showForm && <ErrorMessage message={error} />}

      {!showForm && filteredServices.length === 0 ? (
        <EmptyState
          title={services.length === 0 ? "Aucune prestation" : "Aucun résultat"}
          description={
            services.length === 0
              ? "Crée ta première prestation type pour alimenter ton catalogue métier."
              : "Aucune prestation ne correspond aux filtres actuellement sélectionnés."
          }
        />
      ) : null}

      {!showForm && filteredServices.length > 0 && (
        <>
          {/* ── Tableau desktop ── */}
          <div className="catalog-premium-page__table-shell">
            <DataTable
              headers={
                <tr>
                  <th>Nom</th>
                  <th>Catégorie</th>
                  <th>Unité</th>
                  <th>Prix HT</th>
                  <th>TVA</th>
                  <th>Statut</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              }
            >
              {filteredServices.map((service) => (
                <tr key={service.id}>
                  <td>
                    <div className="catalog-premium-page__service-cell">
                      <strong>{service.name}</strong>
                      {service.default_description && (
                        <div className="catalog-premium-page__service-description">
                          {service.default_description}
                        </div>
                      )}
                    </div>
                  </td>
                  <td>{getCategoryLabel(service.category)}</td>
                  <td>{getUnitLabel(service.default_unit)}</td>
                  <td>{formatCurrency(service.default_unit_price_ht)}</td>
                  <td>{Number(service.default_tva_rate).toFixed(2)} %</td>
                  <td>
                    <span
                      className={`catalog-premium-page__status-badge ${
                        service.is_active
                          ? "catalog-premium-page__status-badge--active"
                          : "catalog-premium-page__status-badge--inactive"
                      }`}
                    >
                      {service.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div className="catalog-premium-page__row-actions">
                      <Button type="button" variant="secondary" onClick={() => openEditForm(service)}>
                        Modifier
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => handleToggleActive(service)}
                        disabled={updatingServiceId === service.id}
                      >
                        {updatingServiceId === service.id ? "Mise à jour..." : service.is_active ? "Désactiver" : "Activer"}
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        onClick={() => handleDelete(service.id)}
                        disabled={deletingServiceId === service.id}
                      >
                        {deletingServiceId === service.id ? "Suppression..." : "Supprimer"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </DataTable>
          </div>

          {/* ── Vue cartes mobile ── */}
          <div className="catalog-premium-page__card-list">
            {filteredServices.map((service) => (
              <article key={service.id} className="catalog-premium-page__service-card">
                <div className="catalog-premium-page__service-card-header">
                  <div className="catalog-premium-page__service-card-main">
                    <p className="catalog-premium-page__service-card-name">{service.name}</p>
                    {service.default_description && (
                      <p className="catalog-premium-page__service-card-desc">
                        {service.default_description}
                      </p>
                    )}
                  </div>
                  <span className="catalog-premium-page__service-card-price">
                    {formatCurrency(service.default_unit_price_ht)}
                  </span>
                </div>

                <div className="catalog-premium-page__service-card-meta">
                  <span className="catalog-premium-page__service-card-chip">
                    {getCategoryLabel(service.category)}
                  </span>
                  <span className="catalog-premium-page__service-card-chip">
                    {getUnitLabel(service.default_unit)}
                  </span>
                  <span className="catalog-premium-page__service-card-chip">
                    TVA {Number(service.default_tva_rate).toFixed(0)} %
                  </span>
                  <span
                    className={`catalog-premium-page__status-badge ${
                      service.is_active
                        ? "catalog-premium-page__status-badge--active"
                        : "catalog-premium-page__status-badge--inactive"
                    }`}
                  >
                    {service.is_active ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="catalog-premium-page__service-card-actions">
                  <Button type="button" variant="secondary" onClick={() => openEditForm(service)}>
                    Modifier
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => handleToggleActive(service)}
                    disabled={updatingServiceId === service.id}
                  >
                    {updatingServiceId === service.id ? "Mise à jour..." : service.is_active ? "Désactiver" : "Activer"}
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => handleDelete(service.id)}
                    disabled={deletingServiceId === service.id}
                  >
                    {deletingServiceId === service.id ? "Suppression..." : "Supprimer"}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}