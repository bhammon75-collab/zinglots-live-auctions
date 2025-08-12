import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import lotImage from "@/assets/lot-generic.jpg";

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
  return (
    <Card className="group relative overflow-hidden transition-shadow hover:shadow-xl">
      <CardContent className="p-0">
        <div className="aspect-[4/3] w-full overflow-hidden">
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
              <span className="text-muted-foreground">Current bid</span>{" "}
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
