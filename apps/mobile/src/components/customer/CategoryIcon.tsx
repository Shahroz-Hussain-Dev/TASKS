import { Car, CarProfile, Motorcycle, Snowflake, Sparkle } from "@phosphor-icons/react";
import type { VehicleCategory } from "@raahi/shared";
import { cn } from "@/lib/utils";

type IconWeight = "thin" | "light" | "regular" | "bold" | "fill" | "duotone";

/** Auto-rickshaw glyph — Phosphor has no rickshaw, so this mimics its duotone layering on a 24px grid. */
function RickshawGlyph({ className, weight = "duotone" }: { className?: string; weight?: IconWeight }) {
  const filled = weight === "fill";
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M4 15V9.5A3.5 3.5 0 0 1 7.5 6H14l4 5h2.5a1.5 1.5 0 0 1 1.5 1.5V15Z" fill="currentColor" opacity={filled ? 1 : 0.2} />
      <path d="M4 15V9.5A3.5 3.5 0 0 1 7.5 6H14l4 5h2.5a1.5 1.5 0 0 1 1.5 1.5V15" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 6v5h4M4 11h10M9 17h6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="7" cy="17" r="2" fill={filled ? "currentColor" : "#fff"} stroke="currentColor" strokeWidth={2} />
      <circle cx="17" cy="17" r="2" fill={filled ? "currentColor" : "#fff"} stroke="currentColor" strokeWidth={2} />
    </svg>
  );
}

/**
 * Duotone icon for a ride category. AC and Comfort tiers carry a small badge so
 * the five options read at a glance even in a 40px tile.
 */
export function CategoryIcon({ category, className, badgeClassName, weight = "duotone" }: { category: VehicleCategory; className?: string; badgeClassName?: string; weight?: IconWeight }) {
  switch (category) {
    case "bike":
      return <Motorcycle className={className} weight={weight} />;
    case "rickshaw":
      return <RickshawGlyph className={className} weight={weight} />;
    case "car":
      return <Car className={className} weight={weight} />;
    case "car_ac":
      return (
        <span className="relative inline-flex">
          <CarProfile className={className} weight={weight} />
          <Snowflake className={cn("absolute -right-1.5 -top-1.5 size-3 text-sky-500", badgeClassName)} weight="fill" />
        </span>
      );
    case "car_premium":
      return (
        <span className="relative inline-flex">
          <Car className={className} weight={weight} />
          <Sparkle className={cn("absolute -right-1.5 -top-1.5 size-3 text-sun-500", badgeClassName)} weight="fill" />
        </span>
      );
  }
}
