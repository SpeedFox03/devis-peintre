type PricedQuoteItem = {
  quantity: number;
  unit_price_ht: number;
};

export function calculateItemsTotal(items: PricedQuoteItem[]) {
  const total = items.reduce(
    (sum, item) =>
      sum + Number(item.quantity || 0) * Number(item.unit_price_ht || 0),
    0,
  );

  return Math.round((total + Number.EPSILON) * 100) / 100;
}
