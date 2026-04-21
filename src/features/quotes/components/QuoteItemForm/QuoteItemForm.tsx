import type { FormEvent } from "react";
import { FormField } from "../../../../components/ui/FormField/FormField";
import { TextInput } from "../../../../components/ui/TextInput/TextInput";
import { TextArea } from "../../../../components/ui/TextArea/TextArea";
import { Select } from "../../../../components/ui/Select/Select";
import { FormGrid } from "../../../../components/ui/FormGrid/FormGrid";
import { Button } from "../../../../components/ui/Button/Button";
import { ErrorMessage } from "../../../../components/ui/ErrorMessage/ErrorMessage";
import { CloseIcon } from "../../../../components/ui/Icons/AppIcons";
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
  // Champs optionnels pour le calcul m²
  dim_length: string;
  dim_height: string;
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
  const isM2 = form.unit === "m2";

  // Met à jour L ou H et recalcule automatiquement la quantité si les deux sont renseignés
  function handleDimChange(field: "dim_length" | "dim_height", value: string) {
    onChange(field, value);

    const length = field === "dim_length" ? value : form.dim_length;
    const height = field === "dim_height" ? value : form.dim_height;

    const l = parseFloat(length);
    const h = parseFloat(height);

    if (!isNaN(l) && !isNaN(h) && l > 0 && h > 0) {
      onChange("quantity", (l * h).toFixed(2));
    }
  }

  // Quand l'utilisateur édite la quantité directement, on efface L et H
  // pour éviter toute confusion (ils ne correspondent plus au m² calculé)
  function handleQuantityChange(value: string) {
    onChange("quantity", value);
    if (form.dim_length || form.dim_height) {
      onChange("dim_length", "");
      onChange("dim_height", "");
    }
  }

  return (
    <form className="quote-item-form-premium" onSubmit={onSubmit}>
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

      {/* ── Bloc quantité / dimensions ── */}
      {isM2 ? (
        <div className="quote-item-form-premium__m2-block">
          <div className="quote-item-form-premium__m2-dims">
            <FormField label="Longueur (m)">
              <TextInput
                type="number"
                step="0.01"
                min="0"
                value={form.dim_length}
                onChange={(e) => handleDimChange("dim_length", e.target.value)}
                placeholder="ex : 4.50"
              />
            </FormField>

            <div className="quote-item-form-premium__m2-sep" aria-hidden="true">×</div>

            <FormField label="Hauteur (m)">
              <TextInput
                type="number"
                step="0.01"
                min="0"
                value={form.dim_height}
                onChange={(e) => handleDimChange("dim_height", e.target.value)}
                placeholder="ex : 2.60"
              />
            </FormField>
          </div>

          {form.dim_length && form.dim_height && (
            <p className="quote-item-form-premium__m2-hint">
              = {(parseFloat(form.dim_length || "0") * parseFloat(form.dim_height || "0")).toFixed(2)} m² calculés automatiquement
            </p>
          )}

          <FormField
            label="Surface m² (modifiable)"
            hint="Remplir Longueur × Hauteur au-dessus, ou saisir directement"
          >
            <TextInput
              type="number"
              step="0.01"
              min="0"
              value={form.quantity}
              onChange={(e) => handleQuantityChange(e.target.value)}
            />
          </FormField>
        </div>
      ) : (
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
      )}

      {/* Prix + TVA séparés quand on est en mode m² (quantité a son propre bloc) */}
      {isM2 && (
        <FormGrid columns="2">
          <FormField label="Prix unitaire HT (€/m²)">
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
      )}

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

        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          aria-label="Annuler"
          title="Annuler"
        >
          <CloseIcon />
        </Button>
      </div>
    </form>
  );
}