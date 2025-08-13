import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart, Share2, Eye } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useWatchlist } from "@/hooks/useWatchlist";
import { CountdownPill } from "@/components/auctions/CountdownPill";
import { WatchButton } from "@/components/auctions/WatchButton";
import lotImage from "@/assets/lot-generic.jpg";

export interface LotItem {
  id: string;
  title: string;
  category: string;
  currentBid?: number;
  buyNow?: number;
  endsIn: string;
  image_url?: string;
  reserve_met?: boolean;
  watchers?: number;
}

const LotCard = ({ item }: { item: LotItem }) => {
  const { watched, loading, toggle } = useWatchlist(item.id);
  const { toast } = useToast();
  const [isSharing, setIsSharing] = useState(false);

  const price = item.currentBid ?? item.buyNow ?? 0;
  const priceLabel = item.currentBid ? `Current: $${(price/100).toFixed(2)}` : `Starting: $${(price/100).toFixed(2)}`;

  const handleWatch = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggle();
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsSharing(true);

    try {
      const url = `${window.location.origin}/product/${item.id}`;
      const shareData = {
        title: item.title,
        text: `Check out this ${item.category.toLowerCase()} on ZingLots`,
        url,
      };

      // @ts-ignore
      if (navigator.share) {
        // @ts-ignore
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(url);
        toast({
          title: "Link copied!",
          description: "Product link copied to clipboard",
        });
      }
    } catch (error) {
      console.error("Share failed:", error);
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="group rounded-2xl border bg-card shadow-card hover:shadow-lg transition-shadow overflow-hidden">
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <img 
          src={item.image_url || lotImage} 
          alt={item.title}
          className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform"
        />
        
        {/* Reserve status and countdown */}
        <div className="absolute left-3 top-3 flex gap-2">
          <Badge variant={item.reserve_met ? 'default' : 'outline'}>
            {item.reserve_met ? 'Reserve met ✅' : 'Reserve not met'}
          </Badge>
        </div>
        <div className="absolute right-3 bottom-3">
          <CountdownPill endsAt={item.endsIn} />
        </div>
        
        {/* Action buttons */}
        <div className="absolute right-3 top-3 flex gap-2">
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8 bg-background/80 backdrop-blur"
            onClick={handleWatch}
            disabled={loading}
            aria-label={watched ? "Remove from watchlist" : "Add to watchlist"}
          >
            <Heart className={`h-4 w-4 ${watched ? "fill-current text-red-500" : ""}`} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 bg-background/80 backdrop-blur"
            onClick={handleShare}
            disabled={isSharing}
            aria-label="Share"
          >
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="p-3 space-y-2">
        <div className="line-clamp-2 font-medium">{item.title}</div>
        <div className="flex items-center justify-between text-sm">
          <div className="font-semibold">{priceLabel}</div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Eye className="h-4 w-4" />
            <span>{item.watchers ?? 0} watching</span>
          </div>
        </div>
        
        {/* Buy Now button - less prominent */}
        {item.buyNow && (
          <Button variant="outline" size="sm" className="w-full text-xs">
            Buy Now ${(item.buyNow/100).toFixed(2)}
          </Button>
        )}
      </div>
    </div>
  );
};

export default LotCard;
