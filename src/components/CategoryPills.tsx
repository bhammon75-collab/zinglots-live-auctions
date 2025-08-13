import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CATEGORIES } from "@/data/categories";

const ACTIVE_COUNTS: Record<string, string> = {
  "TCG": "2.3K active",
  "LEGO": "1.8K active",
  "Action Figures": "950 active",
  "Die-cast": "720 active",
  "Plush": "480 active",
  "Star Wars": "1.2K active",
  "Jewelry": "340 active",
  "Video Games": "890 active",
  "Coins & Currency": "560 active",
  "Comics": "1.5K active",
  "Electronics (parts/repair)": "290 active",
};

const CategoryPills = () => (
  <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-2">
    {CATEGORIES.map((c) => {
      const label = ACTIVE_COUNTS[c.name] ? `${c.name} (${ACTIVE_COUNTS[c.name]})` : c.name;
      return (
        <Button key={c.slug} variant="pill" size="sm" asChild>
          <Link to={`/category/${c.slug}`}>{label}</Link>
        </Button>
      );
    })}
  </div>
);

export default CategoryPills;
