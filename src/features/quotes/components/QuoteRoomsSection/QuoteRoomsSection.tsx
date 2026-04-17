import type { FormEvent } from "react";
import { Button } from "../../../../components/ui/Button/Button";
import { Card } from "../../../../components/ui/Card/Card";
import { EmptyState } from "../../../../components/ui/EmptyState/EmptyState";
import { ErrorMessage } from "../../../../components/ui/ErrorMessage/ErrorMessage";
import { QuoteRoomForm } from "../QuoteRoomForm/QuoteRoomForm";
import type { QuoteItem, Room, RoomFormState } from "../../types";
import "./QuoteRoomsSection.css";

type QuoteRoomsSectionProps = {
  rooms: Room[];
  items: QuoteItem[];
  showForm: boolean;
  form: RoomFormState;
  saving: boolean;
  error: string | null;
  deletingRoomId: string | null;
  onOpenForm: () => void;
  onCloseForm: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: <K extends keyof RoomFormState>(field: K, value: RoomFormState[K]) => void;
  onDelete: (roomId: string) => void;
};

function getRoomItemsCount(roomId: string, items: QuoteItem[]) {
  return items.filter((item) => item.room_id === roomId).length;
}

export function QuoteRoomsSection({
  rooms,
  items,
  showForm,
  form,
  saving,
  error,
  deletingRoomId,
  onOpenForm,
  onCloseForm,
  onSubmit,
  onChange,
  onDelete,
}: QuoteRoomsSectionProps) {
  return (
    <section className="quote-rooms-premium">
      <Card className="quote-rooms-premium__shell">
        <div className="quote-rooms-premium__header">
          <div>
            <h2 className="quote-rooms-premium__title">Pièces</h2>
          </div>

          <div className="quote-rooms-premium__header-actions">
            {!showForm ? (
              <Button type="button" onClick={onOpenForm}>
                Ajouter une pièce
              </Button>
            ) : (
              <Button type="button" variant="secondary" onClick={onCloseForm}>
                Fermer
              </Button>
            )}
          </div>
        </div>

        {showForm ? (
          <div className="quote-rooms-premium__form-box">
            <QuoteRoomForm
              form={form}
              error={error}
              saving={saving}
              onSubmit={onSubmit}
              onCancel={onCloseForm}
              onChange={onChange}
            />
          </div>
        ) : null}

        {!showForm && error ? <ErrorMessage message={error} /> : null}

        {rooms.length === 0 ? (
          <EmptyState
            title="Aucune pièce ajoutée"
            description=""
            actionLabel="Ajouter une pièce"
            onAction={onOpenForm}
          />
        ) : (
          <div className="quote-rooms-premium__grid">
            {rooms.map((room) => {
              const count = getRoomItemsCount(room.id, items);

              return (
                <article key={room.id} className="quote-rooms-premium__card">
                  <div className="quote-rooms-premium__card-top">
                    <div className="quote-rooms-premium__card-main">
                      <h3 className="quote-rooms-premium__card-title">{room.name}</h3>
                    </div>

                    <span className="quote-rooms-premium__badge">
                      {count} ligne{count > 1 ? "s" : ""}
                    </span>
                  </div>

                  <div className="quote-rooms-premium__card-actions">
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      disabled={deletingRoomId === room.id}
                      onClick={() => onDelete(room.id)}
                    >
                      {deletingRoomId === room.id ? "Suppression..." : "Supprimer"}
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Card>
    </section>
  );
}