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
        <Button variant="secondary" onClick={showForm ? onCloseForm : onOpenForm}>
          {showForm ? "Fermer" : "Ajouter une pièce"}
        </Button>
      }
    >
      {showForm && (
        <QuoteRoomForm
          form={form}
          error={error}
          saving={saving}
          onSubmit={onSubmit}
          onCancel={onCloseForm}
          onChange={onChange}
        />
      )}

      {rooms.length === 0 ? (
        <EmptyState
          title="Aucune pièce"
          description="Ajoute une première pièce pour organiser le devis."
        />
      ) : (
        <div className="quote-rooms-section__list">
          {rooms.map((room) => {
            const hasItems = items.some((i) => i.room_id === room.id);

            return (
              <div key={room.id} className="quote-rooms-section__chip">
                <span>{room.name}</span>

                <Button
                  size="sm"
                  variant="danger"
                  disabled={hasItems || deletingRoomId === room.id}
                  onClick={() => onDelete(room.id)}
                >
                  {deletingRoomId === room.id ? "..." : "Suppr."}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}