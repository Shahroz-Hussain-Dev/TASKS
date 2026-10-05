import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { VEHICLE_CATEGORIES, VEHICLE_CATEGORY_META, type FareBreakdown, type VehicleCategory } from "@raahi/shared";
import { Money, Skeleton } from "@/components/ui";
import { spring, springBouncy, springSoft } from "@/lib/motion";
import { haptic } from "@/lib/native";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "./CategoryIcon";
import { CATEGORY_TONE } from "./categoryTone";

/**
 * Horizontal, snap-scrolling carousel of tinted sticker cards — one per ride
 * category, each with its duotone icon and the recommended fare. The selected
 * card tilts like a peeled sticker and a shared-layout ring glides between
 * options instead of blinking.
 */
export function CategoryCarousel({ value, onChange, fares, loading, className }: { value: VehicleCategory; onChange: (c: VehicleCategory) => void; fares: Record<VehicleCategory, FareBreakdown> | null; loading?: boolean; className?: string }) {
  const scroller = useRef<HTMLDivElement>(null);
  const cards = useRef<Partial<Record<VehicleCategory, HTMLButtonElement | null>>>({});

  useEffect(() => {
    const c = scroller.current;
    const el = cards.current[value];
    if (!c || !el) return;
    const left = el.offsetLeft - (c.clientWidth - el.clientWidth) / 2;
    c.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [value]);

  return (
    <div ref={scroller} className={cn("flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory -mx-4 px-5 py-2", className)} role="radiogroup" aria-label="Ride category">
      {VEHICLE_CATEGORIES.map((id, i) => {
        const meta = VEHICLE_CATEGORY_META[id];
        const tone = CATEGORY_TONE[id];
        const active = id === value;
        const fare = fares?.[id];
        return (
          <motion.button
            key={id}
            ref={(el) => {
              cards.current[id] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            initial={{ opacity: 0, x: 40, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: active ? 1.04 : 1, rotate: active ? -1.5 : 0 }}
            transition={{ ...springSoft, delay: 0.04 * i }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              if (!active) haptic.tick();
              onChange(id);
            }}
            className={cn("relative snap-center shrink-0 w-[126px] rounded-[24px] p-3 text-left transition-shadow", tone.bg, active ? "sticker" : "shadow-pillow")}
          >
            {active && <motion.span layoutId="category-ring" transition={spring} className={cn("absolute inset-0 rounded-[24px] border-[3px] pointer-events-none", tone.border)} />}
            <span className="relative flex flex-col gap-2">
              <motion.span animate={active ? { scale: [1, 1.12, 1] } : { scale: 1 }} transition={springBouncy} className={cn("size-10 rounded-full flex items-center justify-center shadow-pillow", active ? tone.solid : cn("bg-white", tone.text))}>
                <CategoryIcon category={id} className="size-[22px]" weight={active ? "fill" : "duotone"} badgeClassName={active ? "text-white" : undefined} />
              </motion.span>
              <span>
                <span className="block font-display text-[16px] font-semibold text-ink-900 leading-tight">{meta.label}</span>
                <span className="block text-[11.5px] text-ink-500 mt-0.5 font-bold">
                  {meta.seats} {meta.seats === 1 ? "seat" : "seats"}
                </span>
              </span>
              <span className="min-h-5 flex items-center">
                {fare ? (
                  <Money value={fare.recommendedFarePkr} className={cn("text-[15px]", active ? tone.money : "text-ink-700!")} />
                ) : loading ? (
                  <Skeleton className="h-4 w-16 bg-white/70" />
                ) : (
                  <span className="text-[12px] text-ink-400 font-semibold">Set a route</span>
                )}
              </span>
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
