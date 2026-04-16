import type { FormEvent } from "react";
import { SectionCard } from "../../../../components/ui/SectionCard/SectionCard";
import { Button } from "../../../../components/ui/Button/Button";
import { EmptyState } from "../../../../components/ui/EmptyState/EmptyState";
import { QuoteRoomForm } from "../QuoteRoomForm/QuoteRoomForm";
import "./QuoteRoomsSection.css";

type Room = {
  id: string;
  name: string;
};

type QuoteRoomsSectionProps = {
  rooms: Room[];
  items: { room_id: string | null }[];
  showForm: boolean;
  form: { name: string; notes: string };
  saving: boolean;
  error: string | null;
  deletingRoomId: string | null;
  onOpenForm: () => void;
  onCloseForm: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: <K extends keyof { name: string; notes: string }>(
    field: K,
    value: { name: string; notes: string }[K]
  ) => void;
  onDelete: (roomId: string) => void;
};

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
    <SectionCard
      title="Pièces / zones"
      actions={
        <Button variant="secondary" type="button" onClick={showForm ? onCloseForm : onOpenForm}>
          {showForm ? "Fermer" : "Ajouter une pièce"}
        </Button>
      }
    >
      <div className="quote-rooms-premium">
        {showForm && (
          <div className="quote-rooms-premium__form-shell">
            <QuoteRoomForm
              form={form}
              error={error}
              saving={saving}
              onSubmit={onSubmit}
              onCancel={onCloseForm}
              onChange={onChange}
            />
          </div>
        )}

        {rooms.length === 0 ? (
          <EmptyState
            title="Aucune pièce"
            description="Ajoute une première pièce pour organiser ton devis par zone de travail."
          />
        ) : (
          <div className="quote-rooms-premium__grid">
            {rooms.map((room) => {
              const itemCount = items.filter((i) => i.room_id === room.id).length;
              const hasItems = itemCount > 0;

              return (
                <article key={room.id} className="quote-rooms-premium__card">
                  <div className="quote-rooms-premium__card-top">
                    <div>
                      <p className="quote-rooms-premium__card-eyebrow">Pièce</p>
                      <h3 className="quote-rooms-premium__card-title">{room.name}</h3>
                    </div>

                    <div className="quote-rooms-premium__badge">
                      {itemCount} ligne{itemCount > 1 ? "s" : ""}
                    </div>
                  </div>

                  <p className="quote-rooms-premium__card-description">
                    {hasItems
                      ? "Cette pièce contient déjà des prestations liées au devis."
                      : "Cette pièce est prête à recevoir des lignes ou des prestations du catalogue."}
                  </p>

                  <div className="quote-rooms-premium__card-actions">
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={hasItems || deletingRoomId === room.id}
                      onClick={() => onDelete(room.id)}
                    >
                      {deletingRoomId === room.id ? "Suppression..." : "Supprimer"}
                    </Button>
                  </div>

                  {hasItems && (
                    <p className="quote-rooms-premium__hint">
                      Suppression désactivée tant que la pièce contient des lignes.
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </SectionCard>
  );
}