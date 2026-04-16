import type {
  QuoteDetails,
  QuoteGeneralFormState,
  QuoteItem,
  QuoteItemFormState,
  RoomFormState,
} from "../types";

export function formatDateForInput(date: Date) {
  return date.toISOString().split("T")[0];
}

export function getDefaultValidUntil(validityDays = 30) {
  const date = new Date();
  date.setDate(date.getDate() + validityDays);
  return formatDateForInput(date);
}

export function createInitialItemForm(tvaRate = 21): QuoteItemFormState {
  return {
    room_id: "",
    item_type: "service",
    category: "painting",
    label: "",
    description: "",
    unit: "m2",
    quantity: "1",
    unit_price_ht: "0",
    tva_rate: String(tvaRate),
  };
}

export function createInitialRoomForm(): RoomFormState {
  return {
    name: "",
    notes: "",
  };
}

export function createInitialQuoteGeneralForm(
  quote: QuoteDetails | null
): QuoteGeneralFormState {
  return {
    title: quote?.title ?? "",
    description: quote?.description ?? "",
    status: quote?.status ?? "draft",
    issue_date: quote?.issue_date ?? formatDateForInput(new Date()),
    valid_until: quote?.valid_until ?? "",
    tva_rate: String(quote?.tva_rate ?? 21),
    notes: quote?.notes ?? "",
    terms: quote?.terms ?? "",
  };
}

export function getNextSortOrder(values: number[]) {
  return values.length > 0 ? Math.max(...values) + 1 : 1;
}

export function mapItemToForm(item: QuoteItem): QuoteItemFormState {
  return {
    room_id: item.room_id || "",
    item_type: item.item_type,
    category: item.category || "other",
    label: item.label,
    description: item.description || "",
    unit: item.unit,
    quantity: String(item.quantity),
    unit_price_ht: String(item.unit_price_ht),
    tva_rate: String(item.tva_rate),
  };
}