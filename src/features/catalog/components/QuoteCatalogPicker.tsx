import { useMemo } from "react";
import { DataTable } from "../../../components/ui/DataTable/DataTable";
import { FormField } from "../../../components/ui/FormField/FormField";
import { Select } from "../../../components/ui/Select/Select";
import { TextInput } from "../../../components/ui/TextInput/TextInput";
import { Button } from "../../../components/ui/Button/Button";
import {
  PAINT_CATEGORIES,
  getCategoryLabel,
  getUnitLabel,
} from "../catalogOptions";
import type { ServiceCatalogItem } from "../types";
import "./QuoteCatalogPicker.css";

type Room = {
  id: string;
  name: string;
};

type QuoteCatalogPickerProps = {
  services: ServiceCatalogItem[];
  rooms: Room[];
  search: string;
  selectedCategory: string;
  selectedRoomId: string;
  addingServiceId: string | null;
  onSearchChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onRoomChange: (value: string) => void;
  onAdd: (service: ServiceCatalogItem) => void;
};

export function QuoteCatalogPicker({
  services,
  rooms,
  search,
  selectedCategory,
  selectedRoomId,
  addingServiceId,
  onSearchChange,
  onCategoryChange,
  onRoomChange,
  onAdd,
}: QuoteCatalogPickerProps) {
  const filteredServices = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return services.filter((service) => {
      const matchesSearch =
        !normalizedSearch ||
        service.name.toLowerCase().includes(normalizedSearch) ||
        (service.default_description ?? "").toLowerCase().includes(normalizedSearch);

      const matchesCategory =
        selectedCategory === "all" || service.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [search, selectedCategory, services]);

  return (
    <div className="quote-catalog-picker-premium">
      <div className="quote-catalog-picker-premium__intro">
        <div>
          <p className="quote-catalog-picker-premium__eyebrow">Catalogue</p>
          <h3 className="quote-catalog-picker-premium__title">
            Insérer une prestation type
          </h3>
          <p className="quote-catalog-picker-premium__description">
            Recherche une prestation récurrente, choisis une pièce cible puis ajoute-la
            en un clic au devis.
          </p>
        </div>
      </div>

      <div className="quote-catalog-picker-premium__toolbar">
        <FormField label="Recherche">
          <TextInput
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Mur, plafond, préparation..."
          />
        </FormField>

        <FormField label="Catégorie">
          <Select
            value={selectedCategory}
            onChange={(e) => onCategoryChange(e.target.value)}
          >
            <option value="all">Toutes</option>
            {PAINT_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {getCategoryLabel(category)}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Pièce d'insertion">
          <Select
            value={selectedRoomId}
            onChange={(e) => onRoomChange(e.target.value)}
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
        <div className="quote-catalog-picker-premium__empty">
          Aucune prestation ne correspond aux filtres sélectionnés.
        </div>
      ) : (
        <DataTable
          headers={
            <tr>
              <th>Prestation</th>
              <th>Catégorie</th>
              <th>Unité</th>
              <th>Prix HT</th>
              <th>TVA</th>
              <th />
            </tr>
          }
        >
          {filteredServices.map((service) => (
            <tr key={service.id}>
              <td>
                <div className="quote-catalog-picker-premium__service-cell">
                  <strong>{service.name}</strong>
                  {service.default_description && (
                    <div className="quote-catalog-picker-premium__service-description">
                      {service.default_description}
                    </div>
                  )}
                </div>
              </td>
              <td>{getCategoryLabel(service.category)}</td>
              <td>{getUnitLabel(service.default_unit)}</td>
              <td>{Number(service.default_unit_price_ht).toFixed(2)} €</td>
              <td>{Number(service.default_tva_rate).toFixed(2)} %</td>
              <td>
                <Button
                  size="sm"
                  disabled={addingServiceId === service.id}
                  onClick={() => onAdd(service)}
                >
                  {addingServiceId === service.id ? "Ajout..." : "Ajouter"}
                </Button>
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  );
}