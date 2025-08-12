import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

import { CATEGORIES } from "@/data/categories";

const CategoryPills = () => (
  <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-2">
    {CATEGORIES.map((c) => (
      <Button key={c.slug} variant="pill" size="sm" asChild>
        <Link to={`/category/${c.slug}`}>{c.name}</Link>
      </Button>
    ))}
  </div>
);

export default CategoryPills;
