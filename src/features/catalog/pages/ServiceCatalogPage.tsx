import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "../../../lib/supabase";
import { PageHeader } from "../../../components/ui/PageHeader/PageHeader";
import { LoadingBlock } from "../../../components/ui/LoadingBlock/LoadingBlock";
import { ErrorMessage } from "../../../components/ui/ErrorMessage/ErrorMessage";
import { EmptyState } from "../../../components/ui/EmptyState/EmptyState";
import { SectionCard } from "../../../components/ui/SectionCard/SectionCard";
import { Button } from "../../../components/ui/Button/Button";
import { DataTable } from "../../../components/ui/DataTable/DataTable";
import { FormField } from "../../../components/ui/FormField/FormField";
import { FormGrid } from "../../../components/ui/FormGrid/FormGrid";
import { TextInput } from "../../../components/ui/TextInput/TextInput";
import { TextArea } from "../../../components/ui/TextArea/TextArea";
import { Select } from "../../../components/ui/Select/Select";
import {
  PAINT_CATEGORIES,
  PAINT_UNITS,
  getCategoryLabel,
  getUnitLabel,
} from "../catalogOptions";
import type { ServiceCatalogItem } from "../types";
import "./ServiceCatalogPage.css";

type ServiceCatalogFormState = {
  name: string;
  category: string;
  default_unit: string;
  default_unit_price_ht: string;
  default_tva_rate: string;
  default_description: string;
  is_active: boolean;
};

function createInitialForm(): ServiceCatalogFormState {
  return {
    name: "",
    category: "peinture_mur",
    default_unit: "m2",
    default_unit_price_ht: "0",
    default_tva_rate: "21",
    default_description: "",
    is_active: true,
  };
}

function mapServiceToForm(service: ServiceCatalogItem): ServiceCatalogFormState {
  return {
    name: service.name,
    category: service.category ?? "other",
    default_unit: service.default_unit,
    default_unit_price_ht: String(service.default_unit_price_ht),
    default_tva_rate: String(service.default_tva_rate),
    default_description: service.default_description ?? "",
    is_active: service.is_active,
  };
}

export function ServiceCatalogPage() {
  const [services, setServices] = useState<ServiceCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [form, setForm] = useState<ServiceCatalogFormState>(createInitialForm());

  useEffect(() => {
    void reloadServices();
  }, []);

  async function reloadServices() {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from("service_catalog")
      .select(
        "id, name, category, default_unit, default_unit_price_ht, default_tva_rate, default_description, default_metadata, is_active"
      )
      .order("category", { ascending: true })
      .order("name", { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    setServices((data ?? []) as ServiceCatalogItem[]);
    setLoading(false);
  }

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

  function openCreateForm() {
    setForm(createInitialForm());
    setEditingId(null);
    setShowForm(true);
    setError(null);
  }

  function openEditForm(service: ServiceCatalogItem) {
    setForm(mapServiceToForm(service));
    setEditingId(service.id);
    setShowForm(true);
    setError(null);
  }

  function closeForm() {
    setForm(createInitialForm());
    setEditingId(null);
    setShowForm(false);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.name.trim()) {
      setError("Le nom de la prestation est obligatoire.");
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      name: form.name.trim(),
      category: form.category || null,
      default_unit: form.default_unit,
      default_unit_price_ht: Number(form.default_unit_price_ht || 0),
      default_tva_rate: Number(form.default_tva_rate || 0),
      default_description: form.default_description.trim() || null,
      is_active: form.is_active,
    };

    if (editingId) {
      const { error: updateError } = await supabase
        .from("service_catalog")
        .update(payload)
        .eq("id", editingId);

      if (updateError) {
        setError(updateError.message);
        setSaving(false);
        return;
      }
    } else {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        setError("Utilisateur non connecté.");
        setSaving(false);
        return;
      }

      const { error: insertError } = await supabase.from("service_catalog").insert({
        ...payload,
        owner_user_id: user.id,
        default_metadata: {},
      });

      if (insertError) {
        setError(insertError.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    closeForm();
    await reloadServices();
  }

  async function handleDelete(serviceId: string) {
    const confirmed = window.confirm("Supprimer cette prestation du catalogue ?");
    if (!confirmed) return;

    setDeletingId(serviceId);
    setError(null);

    const { error: deleteError } = await supabase
      .from("service_catalog")
      .delete()
      .eq("id", serviceId);

    if (deleteError) {
      setError(deleteError.message);
      setDeletingId(null);
      return;
    }

    setDeletingId(null);
    await reloadServices();
  }

  async function handleToggleActive(service: ServiceCatalogItem) {
    setError(null);

    const { error: updateError } = await supabase
      .from("service_catalog")
      .update({ is_active: !service.is_active })
      .eq("id", service.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    await reloadServices();
  }

  if (loading) {
    return <LoadingBlock message="Chargement du catalogue..." />;
  }

  return (
    <section className="service-catalog-page">
      <PageHeader
        title="Catalogue de prestations"
        description="Crée des prestations types réutilisables dans les devis."
        actions={
          <Button type="button" onClick={showForm ? closeForm : openCreateForm}>
            {showForm ? "Fermer" : "Nouvelle prestation"}
          </Button>
        }
      />

      <SectionCard title="Filtres">
        <div className="service-catalog-page__toolbar">
          <FormField label="Recherche">
            <TextInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Mur, plafond, enduit..."
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
      </SectionCard>

      {showForm && (
        <SectionCard
          title={editingId ? "Modifier la prestation" : "Créer une prestation type"}
        >
          <form className="service-catalog-page__form" onSubmit={handleSubmit}>
            <FormGrid columns="2">
              <FormField label="Nom">
                <TextInput
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder="Peinture murs acrylique mat 2 couches"
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

            <FormField label="Description par défaut">
              <TextArea
                rows={4}
                value={form.default_description}
                onChange={(e) => updateField("default_description", e.target.value)}
              />
            </FormField>

            <FormGrid columns="2">
              <FormField label="Unité par défaut">
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

              <FormField label="Prix unitaire HT par défaut">
                <TextInput
                  type="number"
                  step="0.01"
                  value={form.default_unit_price_ht}
                  onChange={(e) =>
                    updateField("default_unit_price_ht", e.target.value)
                  }
                />
              </FormField>

              <FormField label="TVA par défaut (%)">
                <TextInput
                  type="number"
                  step="0.01"
                  value={form.default_tva_rate}
                  onChange={(e) => updateField("default_tva_rate", e.target.value)}
                />
              </FormField>
            </FormGrid>

            <FormField label="Disponibilité">
              <Select
                value={form.is_active ? "active" : "inactive"}
                onChange={(e) => updateField("is_active", e.target.value === "active")}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </FormField>

            {error && <ErrorMessage message={error} />}

            <div style={{ display: "flex", gap: 12 }}>
              <Button type="submit" disabled={saving}>
                {saving
                  ? editingId
                    ? "Enregistrement..."
                    : "Création..."
                  : editingId
                  ? "Enregistrer"
                  : "Créer la prestation"}
              </Button>

              <Button type="button" variant="secondary" onClick={closeForm}>
                Annuler
              </Button>
            </div>
          </form>
        </SectionCard>
      )}

      {error && !showForm && <ErrorMessage message={error} />}

      {filteredServices.length === 0 ? (
        <EmptyState
          title="Aucune prestation"
          description="Ajoute une première prestation type pour accélérer tes devis."
        />
      ) : (
        <SectionCard title={`Prestations (${filteredServices.length})`}>
          <DataTable
            headers={
              <tr>
                <th>Nom</th>
                <th>Catégorie</th>
                <th>Unité</th>
                <th>Prix HT</th>
                <th>TVA</th>
                <th>Statut</th>
                <th />
              </tr>
            }
          >
            {filteredServices.map((service) => (
              <tr key={service.id}>
                <td>
                  <div>{service.name}</div>
                  {service.default_description && (
                    <div className="service-catalog-page__muted">
                      {service.default_description}
                    </div>
                  )}
                </td>
                <td>{getCategoryLabel(service.category)}</td>
                <td>{getUnitLabel(service.default_unit)}</td>
                <td>{Number(service.default_unit_price_ht).toFixed(2)} €</td>
                <td>{Number(service.default_tva_rate).toFixed(2)} %</td>
                <td>
                  <span
                    className={`service-catalog-page__status ${
                      service.is_active ? "" : "service-catalog-page__status--inactive"
                    }`.trim()}
                  >
                    {service.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td>
                  <div className="service-catalog-page__row-actions">
                    <Button size="sm" onClick={() => openEditForm(service)}>
                      Modifier
                    </Button>

                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleToggleActive(service)}
                    >
                      {service.is_active ? "Désactiver" : "Activer"}
                    </Button>

                    <Button
                      size="sm"
                      variant="danger"
                      disabled={deletingId === service.id}
                      onClick={() => handleDelete(service.id)}
                    >
                      {deletingId === service.id ? "Suppression..." : "Supprimer"}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        </SectionCard>
      )}
    </section>
  );
}