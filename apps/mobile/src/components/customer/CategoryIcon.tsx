import { Bike, Car, CarFront, Snowflake, Sparkles } from "lucide-react";
import type { VehicleCategory } from "@raahi/shared";
import { cn } from "@/lib/utils";

/** Auto-rickshaw glyph — lucide has no rickshaw, so this matches its 24px grid and 2px stroke. */
function RickshawGlyph({ className, strokeWidth = 2 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M4 15V9.5A3.5 3.5 0 0 1 7.5 6H14l4 5h2.5a1.5 1.5 0 0 1 1.5 1.5V15" />
      <path d="M14 6v5h4" />
      <path d="M4 11h10" />
      <circle cx="7" cy="17" r="2" />
      <circle cx="17" cy="17" r="2" />
      <path d="M9 17h6" />
    </svg>
  );
}

/**
 * Icon for a ride category. AC and Comfort tiers carry a small badge so the
 * five options read at a glance even in a 40px tile.
 */
export function CategoryIcon({ category, className, badgeClassName, strokeWidth = 2.1 }: { category: VehicleCategory; className?: string; badgeClassName?: string; strokeWidth?: number }) {
  switch (category) {
    case "bike":
      return <Bike className={className} strokeWidth={strokeWidth} />;
    case "rickshaw":
      return <RickshawGlyph className={className} strokeWidth={strokeWidth} />;
    case "car":
      return <Car className={className} strokeWidth={strokeWidth} />;
    case "car_ac":
      return (
        <span className="relative inline-flex">
          <CarFront className={className} strokeWidth={strokeWidth} />
          <Snowflake className={cn("absolute -right-1.5 -top-1.5 size-3 text-sky-400", badgeClassName)} strokeWidth={2.4} />
        </span>
      );
    case "car_premium":
      return (
        <span className="relative inline-flex">
          <Car className={className} strokeWidth={strokeWidth} />
          <Sparkles className={cn("absolute -right-1.5 -top-1.5 size-3 text-amber-300", badgeClassName)} strokeWidth={2.4} />
        </span>
      );
  }
}
