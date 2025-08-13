import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import lotImage from "@/assets/lot-generic.jpg";
import { Heart } from "lucide-react";
import { useEffect, useState } from "react";
import type React from "react";

export interface LotItem {
  id: string;
  title: string;
  category: string;
  currentBid: number;
  buyNow?: number;
  endsIn: string;
}

const format = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const LotCard = ({ item }: { item: LotItem }) => {
  const [watched, setWatched] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('watchlist');
      const list: string[] = raw ? JSON.parse(raw) : [];
      setWatched(list.includes(item.id));
    } catch {}
  }, [item.id]);

  const toggleWatch = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const raw = localStorage.getItem('watchlist');
      const list: string[] = raw ? JSON.parse(raw) : [];
      const exists = list.includes(item.id);
      const next = exists ? list.filter((id) => id !== item.id) : [...list, item.id];
      localStorage.setItem('watchlist', JSON.stringify(next));
      setWatched(!exists);
    } catch {}
  };

  return (
    <Card className="group relative overflow-hidden transition-shadow hover:shadow-xl">
      <CardContent className="p-0">
        <div className="relative aspect-[4/3] w-full overflow-hidden">
          <div className="absolute right-2 top-2 z-10">
            <Button variant="secondary" size="icon" onClick={toggleWatch} aria-pressed={watched} aria-label={watched ? "Remove from Watchlist" : "Add to Watchlist"}>
              <Heart className="h-4 w-4" fill={watched ? "currentColor" : "none"} />
            </Button>
          </div>
          <img
            src={lotImage}
            alt={`${item.title} collectible auction lot`}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        </div>
        <div className="space-y-2 p-4">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-secondary px-2 py-1 text-xs text-secondary-foreground">
              {item.category}
            </span>
            <span className="text-xs text-muted-foreground">Ends in {item.endsIn}</span>
          </div>
          <h3 className="line-clamp-2 font-semibold leading-tight">{item.title}</h3>
          <div className="flex items-center justify-between pt-1">
            <div className="text-sm">
              <span className="text-muted-foreground">Starting at</span>{" "}
              <span className="font-semibold">{format(item.currentBid)}</span>
            </div>
            {item.buyNow && (
              <Button variant="outline" size="sm">
                Buy Now {format(item.buyNow)}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default LotCard;
