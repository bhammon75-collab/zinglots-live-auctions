import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import lotImage from "@/assets/lot-generic.jpg";
import { Heart, Share2, Star } from "lucide-react";
import type React from "react";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useToast } from "@/hooks/use-toast";

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
  const { watched, loading, toggle } = useWatchlist(item.id);
  const { toast } = useToast();

  const handleWatch = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggle();
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const shareUrl = `${window.location.origin}/product/${item.id}?utm_source=share&utm_medium=social&utm_campaign=product_share`;
      // @ts-ignore
      if (navigator.share) {
        // @ts-ignore
        await navigator.share({ title: item.title, text: "Check out this find on ZingLots", url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast({ description: "Link copied to clipboard" });
      }
    } catch {}
  };

  return (
    <Card className="group relative overflow-hidden transition-shadow hover:shadow-xl">
      <CardContent className="p-0">
        <div className="relative aspect-[4/3] w-full overflow-hidden">
          <div className="absolute right-2 top-2 z-10">
            <Button variant="secondary" size="icon" onClick={handleWatch} disabled={loading} aria-pressed={watched} aria-label={watched ? "Remove from Watchlist" : "Add to Watchlist"}>
              <Heart className="h-4 w-4" fill={watched ? "currentColor" : "none"} />
            </Button>
          </div>
          <img
            src={lotImage}
            alt={`${item.title} collectible listing`}
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
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Star className="h-3 w-3 fill-current" />
            4.9 • 1.2k ratings
          </div>
          <div className="flex items-center justify-between pt-1">
            <div className="text-sm">
              <span className="text-muted-foreground">Starting at</span>{" "}
              <span className="font-semibold">{format(item.currentBid)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" aria-label="Share" onClick={handleShare}>
                <Share2 className="h-4 w-4" />
              </Button>
              {item.buyNow && (
                <Button variant="outline" size="sm">
                  Buy Now {format(item.buyNow)}
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default LotCard;
