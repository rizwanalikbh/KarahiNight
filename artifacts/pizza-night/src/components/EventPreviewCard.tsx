import { Eye } from "lucide-react";
import { getBannerSrc } from "../lib/banners";

type PizzaType = { name: string; price: number; discountedPrice?: number; category?: string };

function effectivePrice(pt: PizzaType): number {
  return pt.discountedPrice != null ? pt.discountedPrice : pt.price;
}

function priceLabel(pizzaTypes: PizzaType[]): string {
  const mains = pizzaTypes.filter((p) => (p.category ?? "Main") === "Main");
  if (mains.length === 0) return "90 DKK per dish";
  const prices = mains.map(effectivePrice);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? `${min} DKK per dish` : `from ${min} DKK per dish`;
}

function formatEventDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}

/**
 * Read-only preview of how this event will appear on the guest-facing
 * Home page hero, so admins can see the effect of their choices (name,
 * date, banner, dishes, description) before creating the event.
 */
export function EventPreviewCard({
  name,
  date,
  description,
  location,
  pizzaTypes,
  banner,
}: {
  name: string;
  date: string;
  description?: string;
  location?: string;
  pizzaTypes: PizzaType[];
  banner: { bannerVariant: string | null; customBannerUrl: string | null };
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Eye className="w-3.5 h-3.5" /> Guest preview
      </div>
      <div className="rounded-2xl border overflow-hidden bg-secondary/10">
        <div className="px-4 py-3 text-center space-y-0.5 border-b bg-background/60">
          <div className="font-serif font-bold text-lg leading-tight truncate">
            {name.trim() || "Your event name"}
          </div>
          <div className="text-primary text-xs font-medium">
            {date ? formatEventDate(date) : "Pick a date"}
          </div>
          {location && <div className="text-[11px] text-muted-foreground">📍 {location}</div>}
        </div>
        <div className="w-full aspect-video relative">
          <img src={getBannerSrc(banner)} alt="Banner preview" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-3 text-left">
            <div className="text-white font-medium text-sm">{priceLabel(pizzaTypes)}</div>
            {description && <div className="text-white/80 text-xs line-clamp-2">{description}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
