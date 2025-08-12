import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const categories = [
  { name: "TCG", slug: "tcg" },
  { name: "LEGO", slug: "lego" },
  { name: "Action Figures", slug: "action-figures" },
  { name: "Die-cast", slug: "die-cast" },
  { name: "Plush", slug: "plush" },
];

const CategoryPills = () => (
  <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-2">
    {categories.map((c) => (
      <Button key={c.slug} variant="pill" size="sm" asChild>
        <Link to={`/category/${c.slug}`}>{c.name}</Link>
      </Button>
    ))}
  </div>
);

export default CategoryPills;
