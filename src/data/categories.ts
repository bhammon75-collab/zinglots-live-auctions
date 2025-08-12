export type Category = {
  name: string;
  slug: string;
  children?: { name: string; slug: string }[];
};

// Full category list used across the app (pills, filters, demo data)
export const CATEGORIES: Category[] = [
  { name: "TCG", slug: "tcg" },
  { name: "LEGO", slug: "lego" },
  { name: "Action Figures", slug: "action-figures" },
  { name: "Die-cast", slug: "die-cast" },
  { name: "Plush", slug: "plush" },

  // Featured new categories
  { name: "Star Wars", slug: "star-wars" },
  {
    name: "Jewelry",
    slug: "jewelry",
    children: [
      { name: "Costume", slug: "jewelry-costume" },
      { name: "Fine", slug: "jewelry-fine" },
      { name: "Scrap", slug: "jewelry-scrap" },
    ],
  },
  { name: "Watch Parts", slug: "watch-parts" },
  {
    name: "Stamps & Postcards",
    slug: "stamps-postcards",
    children: [
      { name: "Kiloware", slug: "stamps-kiloware" },
      { name: "Shoebox Lots", slug: "stamps-shoebox-lots" },
    ],
  },
  {
    name: "Coins & Currency",
    slug: "coins-currency",
    children: [
      { name: "Junk / 90% Silver", slug: "coins-junk-silver" },
    ],
  },
  {
    name: "Video Games",
    slug: "video-games",
    children: [
      { name: "Retro", slug: "video-games-retro" },
      { name: "Modern", slug: "video-games-modern" },
    ],
  },
  {
    name: "Electronics (parts/repair)",
    slug: "electronics-repair-parts",
    children: [
      { name: "Phones", slug: "electronics-phones" },
      { name: "Tablets", slug: "electronics-tablets" },
      { name: "Computers", slug: "electronics-computers" },
    ],
  },
  {
    name: "Comics",
    slug: "comics",
    children: [
      { name: "Short/Long-box", slug: "comics-box-lots" },
      { name: "Run Fills", slug: "comics-run-fills" },
      { name: "Bulk Readers", slug: "comics-bulk-readers" },
    ],
  },
  { name: "Clothing (reseller bundles)", slug: "clothing-reseller-bundles" },
  {
    name: "Fabric & Sewing",
    slug: "fabric-sewing",
    children: [
      { name: "Fabric Scraps", slug: "fabric-scraps" },
      { name: "Quilting Bundles", slug: "quilting-bundles" },
      { name: "Vintage Patterns", slug: "vintage-sewing-patterns" },
      { name: "Ribbons/Lace/Trims/Zippers", slug: "ribbons-lace-trims-zippers" },
    ],
  },
  {
    name: "Books & Media",
    slug: "books-media",
    children: [
      { name: "Series/Genre Lots", slug: "books-series-genre" },
      { name: "Media Boxes", slug: "media-boxes" },
    ],
  },
  {
    name: "Crafting Supplies",
    slug: "crafting-supplies",
    children: [
      { name: "Embroidery & Cross-stitch", slug: "embroidery-cross-stitch" },
      { name: "Beads & Findings", slug: "beads-findings" },
      { name: "Scrapbooking/Stamping/Die-cut", slug: "scrapbooking-stamping-die-cut" },
      { name: "Cricut/HTV Vinyl", slug: "cricut-htv-vinyl" },
      { name: "Polymer Clay & Resin", slug: "polymer-clay-resin" },
      { name: "Candle/Soap Making", slug: "candle-soap-making" },
      { name: "Diamond Painting Kits", slug: "diamond-painting-kits" },
    ],
  },
  { name: "Yarn", slug: "yarn" },
];

// A small, curated set to keep the top nav tidy
export const FEATURED_CATEGORIES: Category[] = [
  { name: "TCG", slug: "tcg" },
  { name: "LEGO", slug: "lego" },
  { name: "Star Wars", slug: "star-wars" },
  { name: "Jewelry", slug: "jewelry" },
  { name: "Video Games", slug: "video-games" },
  { name: "Coins & Currency", slug: "coins-currency" },
  { name: "Comics", slug: "comics" },
  { name: "Electronics (parts/repair)", slug: "electronics-repair-parts" },
];
