import { Button } from "../../../../components/ui/Button/Button";
import { DataTable } from "../../../../components/ui/DataTable/DataTable";
import "./QuoteItemsGroupedTables.css";

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

type QuoteItemsGroupedTablesProps = {
  rooms: Room[];
  items: QuoteItem[];
  onEdit: (item: QuoteItem) => void;
  onDuplicate: (item: QuoteItem) => void;
  onOpenMove: (item: QuoteItem) => void;
  onDelete: (itemId: string) => void;
  deletingItemId: string | null;
};

function renderRows(
  items: QuoteItem[],
  onEdit: (item: QuoteItem) => void,
  onDuplicate: (item: QuoteItem) => void,
  onOpenMove: (item: QuoteItem) => void,
  onDelete: (itemId: string) => void,
  deletingItemId: string | null
) {
  return items.map((item) => (
    <tr key={item.id}>
      <td>
        <div className="quote-items-grouped-premium__label-cell">
          <strong className="quote-items-grouped-premium__label">{item.label}</strong>
          {item.description && (
            <div className="quote-items-grouped-premium__description">
              {item.description}
            </div>
          )}
        </div>
      </td>
      <td>{item.unit}</td>
      <td>{Number(item.quantity).toFixed(2)}</td>
      <td>{Number(item.unit_price_ht).toFixed(2)} €</td>
      <td>{Number(item.tva_rate).toFixed(2)} %</td>
      <td style={{ textAlign: "right" }}>
        {(Number(item.quantity) * Number(item.unit_price_ht)).toFixed(2)} €
      </td>
      <td>
        <div className="quote-items-grouped-premium__actions">
          <Button size="sm" onClick={() => onEdit(item)}>
            Modifier
          </Button>

          <Button size="sm" variant="secondary" onClick={() => onDuplicate(item)}>
            Dupliquer
          </Button>

          <Button size="sm" variant="secondary" onClick={() => onOpenMove(item)}>
            Déplacer
          </Button>

          <Button
            size="sm"
            variant="danger"
            disabled={deletingItemId === item.id}
            onClick={() => onDelete(item.id)}
          >
            {deletingItemId === item.id ? "Suppression..." : "Supprimer"}
          </Button>
        </div>
      </td>
    </tr>
  ));
}

export function QuoteItemsGroupedTables({
  rooms,
  items,
  onEdit,
  onDuplicate,
  onOpenMove,
  onDelete,
  deletingItemId,
}: QuoteItemsGroupedTablesProps) {
  const unassignedItems = items.filter((item) => !item.room_id);
  const roomSections = rooms.map((room) => ({
    room,
    items: items.filter((item) => item.room_id === room.id),
  }));

  return (
    <div className="quote-items-grouped-premium">
      {roomSections.map(({ room, items: roomItems }) =>
        roomItems.length > 0 ? (
          <section key={room.id} className="quote-items-grouped-premium__section">
            <div className="quote-items-grouped-premium__section-header">
              <h3 className="quote-items-grouped-premium__section-title">
                {room.name}
              </h3>

              <div className="quote-items-grouped-premium__count">
                {roomItems.length} ligne{roomItems.length > 1 ? "s" : ""}
              </div>
            </div>

            <DataTable
              headers={
                <tr>
                  <th>Libellé</th>
                  <th>Unité</th>
                  <th>Qté</th>
                  <th>PU HT</th>
                  <th>TVA</th>
                  <th style={{ textAlign: "right" }}>Total HT</th>
                  <th />
                </tr>
              }
            >
              {renderRows(
                roomItems,
                onEdit,
                onDuplicate,
                onOpenMove,
                onDelete,
                deletingItemId
              )}
            </DataTable>
          </section>
        ) : null
      )}

      {unassignedItems.length > 0 && (
        <section className="quote-items-grouped-premium__section">
          <div className="quote-items-grouped-premium__section-header">
            <h3 className="quote-items-grouped-premium__section-title">Sans pièce</h3>

            <div className="quote-items-grouped-premium__count">
              {unassignedItems.length} ligne{unassignedItems.length > 1 ? "s" : ""}
            </div>
          </div>

          <DataTable
            headers={
              <tr>
                <th>Libellé</th>
                <th>Unité</th>
                <th>Qté</th>
                <th>PU HT</th>
                <th>TVA</th>
                <th style={{ textAlign: "right" }}>Total HT</th>
                <th />
              </tr>
            }
          >
            {renderRows(
              unassignedItems,
              onEdit,
              onDuplicate,
              onOpenMove,
              onDelete,
              deletingItemId
            )}
          </DataTable>
        </section>
      )}
    </div>
  );
}