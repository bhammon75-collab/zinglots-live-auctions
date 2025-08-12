import type { LotItem } from "@/components/LotCard";

export const CATEGORIES = [
  { name: "TCG", slug: "tcg" },
  { name: "LEGO", slug: "lego" },
  { name: "Action Figures", slug: "action-figures" },
  { name: "Die-cast", slug: "die-cast" },
  { name: "Plush", slug: "plush" },
] as const;

export const DEMO_SELLERS = [
  { id: "s1", name: "BrickVault" },
  { id: "s2", name: "RetroHero Toys" },
  { id: "s3", name: "Minty Cards" },
];

export const DEMO_SHOWS = [
  { id: "show1", title: "Friday Night Zing!", when: "Tomorrow 7PM", lots: 12 },
  { id: "show2", title: "Sunday Super Selects", when: "Sun 2PM", lots: 8 },
];

export const DEMO_LOTS: LotItem[] = Array.from({ length: 20 }).map((_, i) => {
  const cats = CATEGORIES.map((c) => c.name);
  const category = cats[i % cats.length];
  return {
    id: `lot-${i + 1}`,
    title: `${category}: Collector Lot #${1000 + i}`,
    category,
    currentBid: 1000 + i * 125,
    buyNow: i % 3 === 0 ? 4999 + i * 100 : undefined,
    endsIn: `${30 - (i % 30)}m`,
  };
});
