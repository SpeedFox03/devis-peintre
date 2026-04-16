import type { FormEvent } from "react";
import { FormField } from "../../../../components/ui/FormField/FormField";
import { TextInput } from "../../../../components/ui/TextInput/TextInput";
import { TextArea } from "../../../../components/ui/TextArea/TextArea";
import { Select } from "../../../../components/ui/Select/Select";
import { FormGrid } from "../../../../components/ui/FormGrid/FormGrid";
import { Button } from "../../../../components/ui/Button/Button";
import { ErrorMessage } from "../../../../components/ui/ErrorMessage/ErrorMessage";
import "./QuoteItemForm.css";

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

type QuoteItemFormProps = {
  form: QuoteItemFormState;
  rooms: Room[];
  error: string | null;
  saving: boolean;
  editing: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  onChange: <K extends keyof QuoteItemFormState>(
    field: K,
    value: QuoteItemFormState[K]
  ) => void;
};

export function QuoteItemForm({
  form,
  rooms,
  error,
  saving,
  editing,
  onSubmit,
  onCancel,
  onChange,
}: QuoteItemFormProps) {
  return (
    <form className="quote-item-form-premium" onSubmit={onSubmit}>
      <div className="quote-item-form-premium__intro">
        <p className="quote-item-form-premium__eyebrow">
          {editing ? "Modification" : "Nouvelle ligne"}
        </p>
        <h3 className="quote-item-form-premium__title">
          {editing ? "Modifier la prestation" : "Ajouter une prestation au devis"}
        </h3>
        <p className="quote-item-form-premium__description">
          Complète les informations de la ligne, puis ajuste la quantité, le prix et la TVA.
        </p>
      </div>

      <FormGrid columns="2">
        <FormField label="Pièce / zone">
          <Select
            value={form.room_id}
            onChange={(e) => onChange("room_id", e.target.value)}
          >
            <option value="">Aucune pièce</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Type">
          <Select
            value={form.item_type}
            onChange={(e) => onChange("item_type", e.target.value)}
          >
            <option value="service">Service</option>
            <option value="labor">Main d'œuvre</option>
            <option value="material">Matériau</option>
            <option value="custom">Personnalisé</option>
          </Select>
        </FormField>
      </FormGrid>

      <FormGrid columns="2">
        <FormField label="Catégorie">
          <Select
            value={form.category}
            onChange={(e) => onChange("category", e.target.value)}
          >
            <option value="painting">Peinture</option>
            <option value="preparation">Préparation</option>
            <option value="protection">Protection</option>
            <option value="repair">Réparation</option>
            <option value="other">Autre</option>
          </Select>
        </FormField>

        <FormField label="Unité">
          <Select
            value={form.unit}
            onChange={(e) => onChange("unit", e.target.value)}
          >
            <option value="m2">m²</option>
            <option value="h">heure</option>
            <option value="forfait">forfait</option>
            <option value="ml">mètre linéaire</option>
            <option value="qty">quantité</option>
          </Select>
        </FormField>
      </FormGrid>

      <FormField label="Libellé">
        <TextInput
          value={form.label}
          onChange={(e) => onChange("label", e.target.value)}
          placeholder="Peinture murs 2 couches"
        />
      </FormField>

      <FormField label="Description">
        <TextArea
          rows={3}
          value={form.description}
          onChange={(e) => onChange("description", e.target.value)}
        />
      </FormField>

      <FormGrid columns="3">
        <FormField label="Quantité">
          <TextInput
            type="number"
            step="0.01"
            value={form.quantity}
            onChange={(e) => onChange("quantity", e.target.value)}
          />
        </FormField>

        <FormField label="Prix unitaire HT">
          <TextInput
            type="number"
            step="0.01"
            value={form.unit_price_ht}
            onChange={(e) => onChange("unit_price_ht", e.target.value)}
          />
        </FormField>

        <FormField label="TVA (%)">
          <TextInput
            type="number"
            step="0.01"
            value={form.tva_rate}
            onChange={(e) => onChange("tva_rate", e.target.value)}
          />
        </FormField>
      </FormGrid>

      {error && <ErrorMessage message={error} />}

      <div className="quote-item-form-premium__actions">
        <Button type="submit" disabled={saving}>
          {saving
            ? editing
              ? "Modification..."
              : "Ajout..."
            : editing
            ? "Enregistrer la modification"
            : "Ajouter la ligne"}
        </Button>

        <Button type="button" variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
      </div>
    </form>
  );
}