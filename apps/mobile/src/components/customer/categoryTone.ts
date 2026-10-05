import type { VehicleCategory } from "@raahi/shared";

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
  /** Same shade with the important suffix, for Fredoka elements (the global `.font-display` rule sets a colour). */
  money: string;
  /** Border in the 500 shade. */
  border: string;
  /** Tint background only. */
  bg: string;
}

export const CATEGORY_TONE: Record<VehicleCategory, CategoryTone> = {
  bike: { name: "sky", hex: "#3da9fc", tint: "bg-sky-100 text-sky-600", solid: "bg-sky-500 text-white", text: "text-sky-600", money: "text-sky-600!", border: "border-sky-500", bg: "bg-sky-100" },
  rickshaw: { name: "sun", hex: "#ffc53d", tint: "bg-sun-100 text-sun-600", solid: "bg-sun-500 text-ink-900", text: "text-sun-600", money: "text-sun-600!", border: "border-sun-500", bg: "bg-sun-100" },
  car: { name: "coral", hex: "#ff6b4a", tint: "bg-coral-100 text-coral-600", solid: "bg-coral-500 text-white", text: "text-coral-600", money: "text-coral-600!", border: "border-coral-500", bg: "bg-coral-100" },
  car_ac: { name: "teal", hex: "#12a594", tint: "bg-teal-100 text-teal-600", solid: "bg-teal-500 text-white", text: "text-teal-600", money: "text-teal-600!", border: "border-teal-500", bg: "bg-teal-100" },
  car_premium: { name: "lavender", hex: "#8b7cf6", tint: "bg-lavender-100 text-lavender-600", solid: "bg-lavender-500 text-white", text: "text-lavender-600", money: "text-lavender-600!", border: "border-lavender-500", bg: "bg-lavender-100" },
};
