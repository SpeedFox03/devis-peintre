import type { FormEvent } from "react";
import { SectionCard } from "../../../../components/ui/SectionCard/SectionCard";
import { Button } from "../../../../components/ui/Button/Button";
import { EmptyState } from "../../../../components/ui/EmptyState/EmptyState";
import { ErrorMessage } from "../../../../components/ui/ErrorMessage/ErrorMessage";
import { DataTable } from "../../../../components/ui/DataTable/DataTable";
import { FormField } from "../../../../components/ui/FormField/FormField";
import { Select } from "../../../../components/ui/Select/Select";
import { QuoteItemForm } from "../QuoteItemForm/QuoteItemForm";
import { QuoteItemsGroupedTables } from "../QuoteItemsGroupedTables/QuoteItemsGroupedTables";
import { QuoteCatalogPicker } from "../../../catalog/components/QuoteCatalogPicker";
import type { ServiceCatalogItem } from "../../../catalog/types";
import "./QuoteItemsSection.css";

type QuoteItem = {
  id: string;
  quote_id: string;
  room_id: string | null;
  item_type: string;
  category: string | null;
  label: string;
  description: string | null;
  unit: string;
  quantity: number;
  unit_price_ht: number;
  tva_rate: number;
  sort_order: number;
};

type Room = {
  id: string;
  name: string;
};

type QuoteItemFormState = {
  room_id: string;
  item_type: string;
  category: string;
  label: string;
  description: string;
  unit: string;
  quantity: string;
  unit_price_ht: string;
  tva_rate: string;
};

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
  onChange: <K extends keyof QuoteItemFormState>(
    field: K,
    value: QuoteItemFormState[K]
  ) => void;
  onEdit: (item: QuoteItem) => void;
  onDuplicate: (item: QuoteItem) => void;
  onOpenMove: (item: QuoteItem) => void;
  onCloseMove: () => void;
  onMoveRoomChange: (value: string) => void;
  onConfirmMove: () => void;
  onDelete: (itemId: string) => void;
};

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
  return (
    <>
      <SectionCard
        title="Lignes du devis"
        actions={
          <>
            <Button
              variant="secondary"
              type="button"
              onClick={showCatalogPicker ? onCloseCatalogPicker : onOpenCatalogPicker}
            >
              {showCatalogPicker ? "Fermer le catalogue" : "Ajouter depuis le catalogue"}
            </Button>

            <Button
              variant="secondary"
              type="button"
              onClick={showForm ? onCloseForm : onOpenCreateForm}
            >
              {showForm ? "Fermer" : "Ajouter une ligne"}
            </Button>
          </>
        }
      >
        {showCatalogPicker && (
          <QuoteCatalogPicker
            services={services}
            rooms={rooms}
            search={catalogSearch}
            selectedCategory={catalogCategory}
            selectedRoomId={catalogRoomId}
            addingServiceId={addingCatalogServiceId}
            onSearchChange={onCatalogSearchChange}
            onCategoryChange={onCatalogCategoryChange}
            onRoomChange={onCatalogRoomChange}
            onAdd={onAddFromCatalog}
          />
        )}

        {movingItem && (
          <div
            style={{
              marginBottom: 16,
              padding: 16,
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              background: "#f9fafb",
              display: "grid",
              gap: 12,
            }}
          >
            <div>
              <strong>Déplacer la ligne :</strong> {movingItem.label}
            </div>

            <FormField label="Nouvelle pièce">
              <Select
                value={moveRoomId}
                onChange={(e) => onMoveRoomChange(e.target.value)}
              >
                <option value="">Sans pièce</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </Select>
            </FormField>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Button
                type="button"
                onClick={onConfirmMove}
                disabled={movingItemLoading}
              >
                {movingItemLoading ? "Déplacement..." : "Confirmer le déplacement"}
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={onCloseMove}
                disabled={movingItemLoading}
              >
                Annuler
              </Button>
            </div>
          </div>
        )}

        {showForm && (
          <QuoteItemForm
            form={form}
            rooms={rooms}
            error={error}
            saving={saving}
            editing={!!editingItemId}
            onSubmit={onSubmit}
            onCancel={onCloseForm}
            onChange={onChange}
          />
        )}

        {items.length === 0 ? (
          <EmptyState
            title="Aucune ligne"
            description="Ajoute une première prestation à ce devis."
          />
        ) : (
          <QuoteItemsGroupedTables
            rooms={rooms}
            items={items}
            onEdit={onEdit}
            onDuplicate={onDuplicate}
            onOpenMove={onOpenMove}
            onDelete={onDelete}
            deletingItemId={deletingItemId}
          />
        )}
      </SectionCard>

      {error && !showForm && !showCatalogPicker && !movingItem && (
        <ErrorMessage message={error} />
      )}

      {items.length > 0 && (
        <SectionCard title="Vue rapide de toutes les lignes">
          <DataTable
            headers={
              <tr>
                <th>Pièce</th>
                <th>Libellé</th>
                <th>Unité</th>
                <th>Qté</th>
                <th>PU HT</th>
                <th style={{ textAlign: "right" }}>Total HT</th>
              </tr>
            }
          >
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.room_id ? roomMap.get(item.room_id) || "-" : "-"}</td>
                <td>{item.label}</td>
                <td>{item.unit}</td>
                <td>{Number(item.quantity).toFixed(2)}</td>
                <td>{Number(item.unit_price_ht).toFixed(2)} €</td>
                <td style={{ textAlign: "right" }}>
                  {(Number(item.quantity) * Number(item.unit_price_ht)).toFixed(2)} €
                </td>
              </tr>
            ))}
          </DataTable>
        </SectionCard>
      )}
    </>
  );
}