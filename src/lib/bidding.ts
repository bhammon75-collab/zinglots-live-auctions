export const INCREMENTS = [
  { upTo: 100, step: 5 },
  { upTo: 500, step: 10 },
  { upTo: 1000, step: 25 },
  { upTo: 5000, step: 50 },
  { upTo: 10000, step: 100 },
  { upTo: Infinity, step: 250 },
] as const;

export function stepFor(price: number) {
  return INCREMENTS.find((b) => price < b.upTo)!.step;
}

export function nextMinimum(current_price: number | null | undefined, starting_bid: number) {
  if (current_price == null) return starting_bid;
  return current_price + stepFor(current_price);
}
