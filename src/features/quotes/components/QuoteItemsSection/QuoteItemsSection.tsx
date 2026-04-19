import type { FormEvent } from "react";
import { Button } from "../../../../components/ui/Button/Button";
import { Card } from "../../../../components/ui/Card/Card";
import { DataTable } from "../../../../components/ui/DataTable/DataTable";
import { EmptyState } from "../../../../components/ui/EmptyState/EmptyState";
import { ErrorMessage } from "../../../../components/ui/ErrorMessage/ErrorMessage";
import { FormField } from "../../../../components/ui/FormField/FormField";
import { Select } from "../../../../components/ui/Select/Select";
import { TextInput } from "../../../../components/ui/TextInput/TextInput";
import { QuoteItemForm } from "../QuoteItemForm/QuoteItemForm";
import type { ServiceCatalogItem } from "../../../catalog/types";
import type { QuoteItem, QuoteItemFormState, Room } from "../../types";
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
  onAddFromCatalog: (service: ServiceCatalogItem) => void;
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

  return (
    <section className="quote-items-premium">
      <Card className="quote-items-premium__shell">
        <div className="quote-items-premium__header">
          <div>
            <h2 className="quote-items-premium__title">Lignes</h2>
          </div>

          <div className="quote-items-premium__header-actions">
            {!showForm ? (
              <Button type="button" onClick={onOpenCreateForm} aria-label="Ajouter une ligne" title="Ajouter une ligne">
                <PlusIcon />
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                onClick={onCloseForm}
                aria-label="Fermer la saisie"
                title="Fermer la saisie" 
              >
                <CloseIcon />
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
                {filteredServices.map((service) => (
                  <article key={service.id} className="quote-items-premium__catalog-card">
                    <div className="quote-items-premium__catalog-card-top">
                      <div className="quote-items-premium__catalog-card-main">
                        <h3 className="quote-items-premium__catalog-title">{service.name}</h3>
                      </div>

                      <span className="quote-items-premium__catalog-badge">
                        {formatCurrency(service.default_unit_price_ht)}
                      </span>
                    </div>

                    <p className="quote-items-premium__catalog-text">
                      {service.default_description?.trim()
                        ? service.default_description
                        : ""}
                    </p>

                    <div className="quote-items-premium__catalog-actions">
                      <Button
                        type="button"
                        size="sm"
                        disabled={addingCatalogServiceId === service.id}
                        onClick={() => onAddFromCatalog(service)}
                      >
                        {addingCatalogServiceId === service.id ? "Ajout..." : "Ajouter"}
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {showForm ? (
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

        {movingItem ? (
          <div className="quote-items-premium__move-box">
            <div className="quote-items-premium__subheader">
              <div>
                <h3 className="quote-items-premium__sub-title">Déplacer la ligne</h3>
              </div>
            </div>

            <div className="quote-items-premium__move-content">
              <p className="quote-items-premium__move-label">
                <strong>{movingItem.label}</strong>
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

              <div className="quote-items-premium__move-actions">
                <Button type="button" disabled={movingItemLoading} onClick={onConfirmMove}>
                  {movingItemLoading ? "Déplacement..." : "Confirmer"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onCloseMove}
                  aria-label="Annuler"
                  title="Annuler"
                >
                  <CloseIcon />
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {!showForm && !showCatalogPicker && error ? <ErrorMessage message={error} /> : null}

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
                    <tr key={item.id}>
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
                          <Button type="button" size="sm" variant="secondary" onClick={() => onEdit(item)} aria-label="Modifier" title="Modifier"><PencilIcon /></Button>
                          <Button type="button" size="sm" variant="secondary" onClick={() => onDuplicate(item)} aria-label="Dupliquer" title="Dupliquer"><CopyIcon /></Button>
                          <Button type="button" size="sm" variant="secondary" onClick={() => onOpenMove(item)} aria-label="Déplacer" title="Déplacer"><ArrowsLeftRightIcon /></Button>
                          <Button type="button" size="sm" variant="danger" disabled={deletingItemId === item.id} onClick={() => onDelete(item.id)} aria-label="Supprimer" title="Supprimer"><TrashIcon /></Button>
                        </div>
                      </td>
                    </tr>
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
                  <article key={item.id} className="quote-items-premium__item-card">
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
                      <Button type="button" size="sm" variant="secondary" onClick={() => onEdit(item)} aria-label="Modifier" title="Modifier"><PencilIcon /></Button>
                      <Button type="button" size="sm" variant="secondary" onClick={() => onDuplicate(item)} aria-label="Dupliquer" title="Dupliquer"><CopyIcon /></Button>
                      <Button type="button" size="sm" variant="secondary" onClick={() => onOpenMove(item)} aria-label="Déplacer" title="Déplacer"><ArrowsLeftRightIcon /></Button>
                      <Button type="button" size="sm" variant="danger" disabled={deletingItemId === item.id} onClick={() => onDelete(item.id)} aria-label="Supprimer" title="Supprimer"><TrashIcon /></Button>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </Card>
    </section>
  );
}