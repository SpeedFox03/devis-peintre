import type { FormEvent } from "react";
import { FormGrid } from "../../../../components/ui/FormGrid/FormGrid";
import { FormField } from "../../../../components/ui/FormField/FormField";
import { TextInput } from "../../../../components/ui/TextInput/TextInput";
import { Button } from "../../../../components/ui/Button/Button";
import { ErrorMessage } from "../../../../components/ui/ErrorMessage/ErrorMessage";
import "./QuoteRoomForm.css";

type RoomFormState = {
  name: string;
  notes: string;
};

type QuoteRoomFormProps = {
  form: RoomFormState;
  error: string | null;
  saving: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  onChange: <K extends keyof RoomFormState>(
    field: K,
    value: RoomFormState[K]
  ) => void;
};

export function QuoteRoomForm({
  form,
  error,
  saving,
  onSubmit,
  onCancel,
  onChange,
}: QuoteRoomFormProps) {
  return (
    <form className="quote-room-form-premium" onSubmit={onSubmit}>
      <div className="quote-room-form-premium__intro">
        <p className="quote-room-form-premium__eyebrow">Nouvelle pièce</p>
        <h3 className="quote-room-form-premium__title">Créer une zone de travail</h3>
        <p className="quote-room-form-premium__description">
          Ajoute une pièce pour structurer le devis et mieux répartir les prestations.
        </p>
      </div>

      <FormGrid columns="2">
        <FormField label="Nom de la pièce">
          <TextInput
            value={form.name}
            onChange={(e) => onChange("name", e.target.value)}
            placeholder="Salon"
          />
        </FormField>

        <FormField label="Notes">
          <TextInput
            value={form.notes}
            onChange={(e) => onChange("notes", e.target.value)}
            placeholder="Pièce principale"
          />
        </FormField>
      </FormGrid>

      {error && <ErrorMessage message={error} />}

      <div className="quote-room-form-premium__actions">
        <Button type="submit" disabled={saving}>
          {saving ? "Ajout..." : "Créer la pièce"}
        </Button>

        <Button type="button" variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
      </div>
    </form>
  );
}