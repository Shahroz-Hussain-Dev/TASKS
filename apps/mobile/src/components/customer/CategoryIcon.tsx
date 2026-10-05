import { Car, CarProfile, Motorcycle, Snowflake, Sparkle } from "@phosphor-icons/react";
import type { VehicleCategory } from "@raahi/shared";
import { cn } from "@/lib/utils";

type IconWeight = "thin" | "light" | "regular" | "bold" | "fill" | "duotone";

/**
 * Sunrise colour for each ride category (DESIGN.md §1): Moto = sky,
 * Rickshaw = sun, Ride = coral, Ride AC = teal, Comfort = lavender.
 * Classes are spelled out so Tailwind can see them.
 */
export interface CategoryTone {
  name: "sky" | "sun" | "coral" | "teal" | "lavender";
  /** 500 hex, for inline styles (map pins, gradients). */
  hex: string;
  /** Tint surface + 500 text. */
  tint: string;
  /** Solid 500 surface + contrasting text. */
  solid: string;
  /** Text in the 500/600 shade. */
  text: string;
  /** Border in the 500 shade. */
  border: string;
  /** Tint background only. */
  bg: string;
}

export const CATEGORY_TONE: Record<VehicleCategory, CategoryTone> = {
  bike: { name: "sky", hex: "#3da9fc", tint: "bg-sky-100 text-sky-600", solid: "bg-sky-500 text-white", text: "text-sky-600", border: "border-sky-500", bg: "bg-sky-100" },
  rickshaw: { name: "sun", hex: "#ffc53d", tint: "bg-sun-100 text-sun-600", solid: "bg-sun-500 text-ink-900", text: "text-sun-600", border: "border-sun-500", bg: "bg-sun-100" },
  car: { name: "coral", hex: "#ff6b4a", tint: "bg-coral-100 text-coral-600", solid: "bg-coral-500 text-white", text: "text-coral-600", border: "border-coral-500", bg: "bg-coral-100" },
  car_ac: { name: "teal", hex: "#12a594", tint: "bg-teal-100 text-teal-600", solid: "bg-teal-500 text-white", text: "text-teal-600", border: "border-teal-500", bg: "bg-teal-100" },
  car_premium: { name: "lavender", hex: "#8b7cf6", tint: "bg-lavender-100 text-lavender-600", solid: "bg-lavender-500 text-white", text: "text-lavender-600", border: "border-lavender-500", bg: "bg-lavender-100" },
};

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
