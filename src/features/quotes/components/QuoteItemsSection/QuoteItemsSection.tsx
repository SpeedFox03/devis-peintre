import { Fragment, useState, type FormEvent } from "react";
import { Button } from "../../../../components/ui/Button/Button";
import { Card } from "../../../../components/ui/Card/Card";
import { DataTable } from "../../../../components/ui/DataTable/DataTable";
import { EmptyState } from "../../../../components/ui/EmptyState/EmptyState";
import { ErrorMessage } from "../../../../components/ui/ErrorMessage/ErrorMessage";
import { FormField } from "../../../../components/ui/FormField/FormField";
import { Select } from "../../../../components/ui/Select/Select";
import { TextInput } from "../../../../components/ui/TextInput/TextInput";
import { QuoteItemForm } from "../QuoteItemForm/QuoteItemForm";
import { getUnitLabel } from "../../../catalog/catalogOptions";
import type { ServiceCatalogItem } from "../../../catalog/types";
import type { QuoteItem, QuoteItemFormState, Room } from "../../types";
import { calculateItemsTotal } from "../../utils/quoteTotals";
import "./QuoteItemsSection.css";
import {
  PlusIcon,
  CloseIcon,
  PencilIcon,
  CopyIcon,
  ArrowsLeftRightIcon,
  TrashIcon,
} from "../../../../components/ui/Icons/AppIcons";

type QuoteItemsSectionProps = {
  services: ServiceCatalogItem[];
  showCatalogPicker: boolean;
  catalogSearch: string;
  catalogCategory: string;
  catalogRoomId: string;
  addingCatalogServiceId: string | null;
  items: QuoteItem[];
  rooms: Room[];
  roomMap: Map<string, string>;
  showForm: boolean;
  form: QuoteItemFormState;
  saving: boolean;
  editingItemId: string | null;
  deletingItemId: string | null;
  error: string | null;
  movingItem: QuoteItem | null;
  moveRoomId: string;
  movingItemLoading: boolean;
  onOpenCreateForm: () => void;
  onCloseForm: () => void;
  onOpenCatalogPicker: () => void;
  onCloseCatalogPicker: () => void;
  onCatalogSearchChange: (value: string) => void;
  onCatalogCategoryChange: (value: string) => void;
  onCatalogRoomChange: (value: string) => void;
  onAddFromCatalog: (service: ServiceCatalogItem, quantity?: number) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: <K extends keyof QuoteItemFormState>(field: K, value: QuoteItemFormState[K]) => void;
  onEdit: (item: QuoteItem) => void;
  onDuplicate: (item: QuoteItem) => void;
  onOpenMove: (item: QuoteItem) => void;
  onCloseMove: () => void;
  onMoveRoomChange: (value: string) => void;
  onConfirmMove: () => void;
  onDelete: (itemId: string) => void;
};

// État local par carte catalogue pour L × H
type CatalogDims = {
  length: string;
  height: string;
  quantity: string; // surface saisie directement
};

function formatCurrency(value: number | string) {
  return `${Number(value || 0).toFixed(2)} €`;
}

function formatQuantity(value: number) {
  const parsed = Number(value || 0);
  return Number.isInteger(parsed) ? String(parsed) : parsed.toFixed(2);
}

function getCategories(services: ServiceCatalogItem[]) {
  return Array.from(new Set(services.map((service) => service.category).filter(Boolean))).sort(
    (a, b) => String(a).localeCompare(String(b), "fr")
  ) as string[];
}

// ── Mini-widget dimensions pour les cartes catalogue ──────────────────────────
function CatalogDimsWidget({
  dims,
  onChange,
}: {
  dims: CatalogDims;
  onChange: (next: CatalogDims) => void;
}) {
  function handleDim(field: "length" | "height", value: string) {
    const next = { ...dims, [field]: value };
    const l = parseFloat(field === "length" ? value : dims.length);
    const h = parseFloat(field === "height" ? value : dims.height);
    if (!isNaN(l) && !isNaN(h) && l > 0 && h > 0) {
      next.quantity = (l * h).toFixed(2);
    }
    onChange(next);
  }

  function handleQuantity(value: string) {
    // Saisie directe → efface L/H pour éviter la confusion
    onChange({ length: "", height: "", quantity: value });
  }

  const computed =
    dims.length && dims.height
      ? (parseFloat(dims.length || "0") * parseFloat(dims.height || "0")).toFixed(2)
      : null;

  return (
    <div className="quote-items-premium__catalog-dims">
      <div className="quote-items-premium__catalog-dims-row">
        <TextInput
          type="number"
          step="0.01"
          min="0"
          value={dims.length}
          onChange={(e) => handleDim("length", e.target.value)}
          placeholder="L (m)"
          aria-label="Longueur"
        />
        <span className="quote-items-premium__catalog-dims-sep">×</span>
        <TextInput
          type="number"
          step="0.01"
          min="0"
          value={dims.height}
          onChange={(e) => handleDim("height", e.target.value)}
          placeholder="H (m)"
          aria-label="Hauteur"
        />
      </div>

      {computed && (
        <p className="quote-items-premium__catalog-dims-hint">= {computed} m²</p>
      )}

      <div className="quote-items-premium__catalog-dims-qty">
        <TextInput
          type="number"
          step="0.01"
          min="0"
          value={dims.quantity}
          onChange={(e) => handleQuantity(e.target.value)}
          placeholder="m²"
          aria-label="Surface m²"
        />
      </div>
    </div>
  );
}

function CatalogQuantityWidget({
  unit,
  quantity,
  onChange,
}: {
  unit: string;
  quantity: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="quote-items-premium__catalog-quantity">
      <span className="quote-items-premium__catalog-quantity-label">
        Quantité ({getUnitLabel(unit)})
      </span>
      <TextInput
        type="number"
        step="0.01"
        min="0"
        value={quantity}
        onChange={(event) => onChange(event.target.value)}
        placeholder="1"
        aria-label={`Quantité en ${getUnitLabel(unit)}`}
      />
    </div>
  );
}

export function QuoteItemsSection({
  services,
  showCatalogPicker,
  catalogSearch,
  catalogCategory,
  catalogRoomId,
  addingCatalogServiceId,
  items,
  rooms,
  roomMap,
  showForm,
  form,
  saving,
  editingItemId,
  deletingItemId,
  error,
  movingItem,
  moveRoomId,
  movingItemLoading,
  onOpenCreateForm,
  onCloseForm,
  onOpenCatalogPicker,
  onCloseCatalogPicker,
  onCatalogSearchChange,
  onCatalogCategoryChange,
  onCatalogRoomChange,
  onAddFromCatalog,
  onSubmit,
  onChange,
  onEdit,
  onDuplicate,
  onOpenMove,
  onCloseMove,
  onMoveRoomChange,
  onConfirmMove,
  onDelete,
}: QuoteItemsSectionProps) {
  const categories = getCategories(services);

  // État L×H par service du catalogue (clé = service.id)
  const [catalogDims, setCatalogDims] = useState<Record<string, CatalogDims>>({});

  function getDims(service: ServiceCatalogItem): CatalogDims {
    return catalogDims[service.id] ?? {
      length: "",
      height: "",
      quantity: service.default_unit === "m2" ? "" : "1",
    };
  }

  function setDims(serviceId: string, next: CatalogDims) {
    setCatalogDims((prev) => ({ ...prev, [serviceId]: next }));
  }

  function handleAddFromCatalog(service: ServiceCatalogItem) {
    const quantityValue = getDims(service).quantity.trim();
    const parsedQuantity = quantityValue ? Number(quantityValue) : undefined;
    onAddFromCatalog(
      service,
      Number.isFinite(parsedQuantity) ? parsedQuantity : undefined
    );
  }

  const filteredServices = services.filter((service) => {
    const normalizedSearch = catalogSearch.trim().toLowerCase();
    const matchesSearch =
      !normalizedSearch ||
      service.name.toLowerCase().includes(normalizedSearch) ||
      (service.default_description ?? "").toLowerCase().includes(normalizedSearch);

    const matchesCategory =
      catalogCategory === "all" || !catalogCategory || service.category === catalogCategory;

    return matchesSearch && matchesCategory;
  });

  const roomTotals = [
    ...rooms
      .map((room) => {
        const roomItems = items.filter((item) => item.room_id === room.id);
        return {
          id: room.id,
          name: room.name,
          itemCount: roomItems.length,
          total: calculateItemsTotal(roomItems),
        };
      })
      .filter((room) => room.itemCount > 0),
    ...(items.some((item) => !item.room_id)
      ? [{
          id: "unassigned",
          name: "Sans pièce",
          itemCount: items.filter((item) => !item.room_id).length,
          total: calculateItemsTotal(items.filter((item) => !item.room_id)),
        }]
      : []),
  ];

  function renderItemEditor() {
    return (
      <div className="quote-items-premium__inline-editor">
        <QuoteItemForm
          form={form}
          rooms={rooms}
          error={error}
          saving={saving}
          editing
          onSubmit={onSubmit}
          onCancel={onCloseForm}
          onChange={onChange}
        />
      </div>
    );
  }

  function renderMoveEditor() {
    if (!movingItem) return null;

    return (
      <div className="quote-items-premium__inline-editor">
        <div className="quote-items-premium__move-content">
          <p className="quote-items-premium__move-label">
            Déplacer <strong>{movingItem.label}</strong>
          </p>

          <FormField label="Nouvelle pièce">
            <Select value={moveRoomId} onChange={(event) => onMoveRoomChange(event.target.value)}>
              <option value="">Sans pièce</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </Select>
          </FormField>

          {error ? <ErrorMessage message={error} /> : null}

          <div className="quote-items-premium__move-actions">
            <Button type="button" disabled={movingItemLoading} onClick={onConfirmMove}>
              {movingItemLoading ? "Déplacement..." : "Confirmer"}
            </Button>
            <Button type="button" variant="secondary" onClick={onCloseMove}>
              Annuler
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="quote-items-premium">
      <Card className="quote-items-premium__shell">
        <div className="quote-items-premium__header">
          <div>
            <h2 className="quote-items-premium__title">Lignes</h2>
          </div>

          <div className="quote-items-premium__header-actions">
            {!showForm ? (
              <Button type="button" onClick={onOpenCreateForm}>
                <PlusIcon />
                Ajouter
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                onClick={onCloseForm}
              >
                <CloseIcon />
                Fermer
              </Button>
            )}

            {!showCatalogPicker ? (
              <Button type="button" variant="secondary" onClick={onOpenCatalogPicker}>
                Catalogue
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                iconOnly
                onClick={onCloseCatalogPicker}
                aria-label="Fermer le catalogue"
                title="Fermer le catalogue"
              >
                <CloseIcon />
              </Button>
            )}
          </div>
        </div>

        {showCatalogPicker ? (
          <div className="quote-items-premium__catalog-box">
            <div className="quote-items-premium__subheader">
              <div>
                <h3 className="quote-items-premium__sub-title">Catalogue</h3>
              </div>
            </div>

            <div className="quote-items-premium__filters">
              <FormField label="Recherche">
                <TextInput
                  value={catalogSearch}
                  onChange={(event) => onCatalogSearchChange(event.target.value)}
                  placeholder="Peinture, plafond, préparation..."
                />
              </FormField>

              <FormField label="Catégorie">
                <Select
                  value={catalogCategory}
                  onChange={(event) => onCatalogCategoryChange(event.target.value)}
                >
                  <option value="all">Toutes les catégories</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Pièce de destination">
                <Select
                  value={catalogRoomId}
                  onChange={(event) => onCatalogRoomChange(event.target.value)}
                >
                  <option value="">Sans pièce</option>
                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>

            {filteredServices.length === 0 ? (
              <EmptyState
                title="Aucune prestation trouvée"
                description=""
              />
            ) : (
              <div className="quote-items-premium__catalog-grid">
                {filteredServices.map((service) => {
                  const isM2 = service.default_unit === "m2";
                  const dims = getDims(service);

                  return (
                    <article key={service.id} className="quote-items-premium__catalog-card">
                      <div className="quote-items-premium__catalog-card-top">
                        <div className="quote-items-premium__catalog-card-main">
                          <h3 className="quote-items-premium__catalog-title">{service.name}</h3>
                        </div>

                        <span className="quote-items-premium__catalog-badge">
                          {formatCurrency(service.default_unit_price_ht)}
                          {isM2 ? " /m²" : ""}
                        </span>
                      </div>

                      <p className="quote-items-premium__catalog-text">
                        {service.default_description?.trim()
                          ? service.default_description
                          : ""}
                      </p>

                      {isM2 ? (
                        <CatalogDimsWidget
                          dims={dims}
                          onChange={(next) => setDims(service.id, next)}
                        />
                      ) : (
                        <CatalogQuantityWidget
                          unit={service.default_unit}
                          quantity={dims.quantity}
                          onChange={(quantity) => setDims(service.id, { ...dims, quantity })}
                        />
                      )}

                      <div className="quote-items-premium__catalog-actions">
                        <Button
                          type="button"
                          size="sm"
                          disabled={addingCatalogServiceId === service.id}
                          onClick={() => handleAddFromCatalog(service)}
                        >
                          {addingCatalogServiceId === service.id ? "Ajout..." : "Ajouter"}
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}

        {showForm && !editingItemId ? (
          <div className="quote-items-premium__form-box">
            <QuoteItemForm
              form={form}
              rooms={rooms}
              error={error}
              saving={saving}
              editing={Boolean(editingItemId)}
              onSubmit={onSubmit}
              onCancel={onCloseForm}
              onChange={onChange}
            />
          </div>
        ) : null}

        {!showForm && !showCatalogPicker && !movingItem && error ? (
          <ErrorMessage message={error} />
        ) : null}

        {items.length === 0 ? (
          <EmptyState
            title="Aucune ligne dans le devis"
            description=""
            actionLabel="Ajouter une ligne"
            onAction={onOpenCreateForm}
          />
        ) : (
          <>
            {/* ── Vue tableau (desktop/tablette) ── */}
            <div className="quote-items-premium__table-wrap">
              <DataTable
                headers={
                  <tr>
                    <th>Désignation</th>
                    <th>Pièce</th>
                    <th>Qté</th>
                    <th>Unité</th>
                    <th>PU HT</th>
                    <th>TVA</th>
                    <th>Total HT</th>
                    <th>Actions</th>
                  </tr>
                }
              >
                {items.map((item) => {
                  const totalHt = Number(item.quantity || 0) * Number(item.unit_price_ht || 0);
                  return (
                    <Fragment key={item.id}>
                      <tr className={editingItemId === item.id || movingItem?.id === item.id ? "quote-items-premium__table-row--expanded" : undefined}>
                        <td>
                          <div className="quote-items-premium__cell-main">
                            <strong>{item.label}</strong>
                            {item.description?.trim() ? (
                              <p className="quote-items-premium__cell-subtext">{item.description}</p>
                            ) : null}
                          </div>
                        </td>
                        <td>{item.room_id ? roomMap.get(item.room_id) || "—" : "—"}</td>
                        <td>{formatQuantity(item.quantity)}</td>
                        <td>{item.unit || "—"}</td>
                        <td>{formatCurrency(item.unit_price_ht)}</td>
                        <td>{Number(item.tva_rate || 0).toFixed(2)} %</td>
                        <td>{formatCurrency(totalHt)}</td>
                        <td>
                          <div className="quote-items-premium__table-actions">
                            <Button type="button" size="sm" variant="secondary" iconOnly onClick={() => onEdit(item)} aria-label="Modifier" title="Modifier"><PencilIcon /></Button>
                            <Button type="button" size="sm" variant="secondary" iconOnly onClick={() => onDuplicate(item)} aria-label="Dupliquer" title="Dupliquer"><CopyIcon /></Button>
                            <Button type="button" size="sm" variant="secondary" iconOnly onClick={() => onOpenMove(item)} aria-label="Déplacer" title="Déplacer"><ArrowsLeftRightIcon /></Button>
                            <Button type="button" size="sm" variant="danger" iconOnly disabled={deletingItemId === item.id} onClick={() => onDelete(item.id)} aria-label="Supprimer" title="Supprimer"><TrashIcon /></Button>
                          </div>
                        </td>
                      </tr>
                      {showForm && editingItemId === item.id ? (
                        <tr className="quote-items-premium__inline-row">
                          <td colSpan={8}>{renderItemEditor()}</td>
                        </tr>
                      ) : null}
                      {movingItem?.id === item.id ? (
                        <tr className="quote-items-premium__inline-row">
                          <td colSpan={8}>{renderMoveEditor()}</td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </DataTable>
            </div>

            {/* ── Vue cartes (mobile uniquement, via CSS display:none/grid) ── */}
            <div className="quote-items-premium__card-list">
              {items.map((item) => {
                const totalHt = Number(item.quantity || 0) * Number(item.unit_price_ht || 0);
                const roomName = item.room_id ? roomMap.get(item.room_id) : null;
                return (
                  <article
                    key={item.id}
                    className={`quote-items-premium__item-card ${
                      editingItemId === item.id || movingItem?.id === item.id
                        ? "quote-items-premium__item-card--expanded"
                        : ""
                    }`}
                  >
                    <div className="quote-items-premium__item-card-header">
                      <div>
                        <p className="quote-items-premium__item-card-title">{item.label}</p>
                        {item.description?.trim() ? (
                          <p className="quote-items-premium__item-card-desc">{item.description}</p>
                        ) : null}
                      </div>
                      <span className="quote-items-premium__item-card-total">{formatCurrency(totalHt)}</span>
                    </div>

                    <div className="quote-items-premium__item-card-meta">
                      {roomName ? <span className="quote-items-premium__item-card-chip">📍 {roomName}</span> : null}
                      <span className="quote-items-premium__item-card-chip">{formatQuantity(item.quantity)} {item.unit || ""}</span>
                      <span className="quote-items-premium__item-card-chip">{formatCurrency(item.unit_price_ht)} / u</span>
                      <span className="quote-items-premium__item-card-chip">TVA {Number(item.tva_rate || 0).toFixed(0)} %</span>
                    </div>

                    <div className="quote-items-premium__item-card-actions">
                      <Button type="button" size="sm" variant="secondary" iconOnly onClick={() => onEdit(item)} aria-label="Modifier" title="Modifier"><PencilIcon /></Button>
                      <Button type="button" size="sm" variant="secondary" iconOnly onClick={() => onDuplicate(item)} aria-label="Dupliquer" title="Dupliquer"><CopyIcon /></Button>
                      <Button type="button" size="sm" variant="secondary" iconOnly onClick={() => onOpenMove(item)} aria-label="Déplacer" title="Déplacer"><ArrowsLeftRightIcon /></Button>
                      <Button type="button" size="sm" variant="danger" iconOnly disabled={deletingItemId === item.id} onClick={() => onDelete(item.id)} aria-label="Supprimer" title="Supprimer"><TrashIcon /></Button>
                    </div>

                    {showForm && editingItemId === item.id ? renderItemEditor() : null}
                    {movingItem?.id === item.id ? renderMoveEditor() : null}
                  </article>
                );
              })}
            </div>

            <div className="quote-items-premium__room-totals">
              <div className="quote-items-premium__room-totals-heading">
                <span>Total par pièce</span>
                <small>HTVA</small>
              </div>
              <div className="quote-items-premium__room-totals-list">
                {roomTotals.map((room) => (
                  <div key={room.id} className="quote-items-premium__room-total">
                    <span>
                      {room.name}
                      <small>
                        {room.itemCount} {room.itemCount > 1 ? "lignes" : "ligne"}
                      </small>
                    </span>
                    <strong>{formatCurrency(room.total)}</strong>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </Card>
    </section>
  );
}
