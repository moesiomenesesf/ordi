export type ProductQuantities = Record<string, number>;

export function changeProductQuantity(current: ProductQuantities, productId: string, amount: number): ProductQuantities {
  const next = { ...current };
  const quantity = Math.min(99, Math.max(0, (current[productId] ?? 0) + amount));
  if (quantity === 0) delete next[productId];
  else next[productId] = quantity;
  return next;
}
