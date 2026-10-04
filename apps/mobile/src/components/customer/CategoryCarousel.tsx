import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { VEHICLE_CATEGORIES, VEHICLE_CATEGORY_META, type FareBreakdown, type VehicleCategory } from "@raahi/shared";
import { Money, Skeleton } from "@/components/ui";
import { spring, springSoft } from "@/lib/motion";
import { haptic } from "@/lib/native";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "./CategoryIcon";

/**
 * Horizontal, snap-scrolling picker of ride categories with the recommended
 * fare for each. The selected card gets a shared-layout glow so the highlight
 * slides between options instead of blinking.
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
    <div ref={scroller} className={cn("flex gap-2.5 overflow-x-auto no-scrollbar snap-x snap-mandatory -mx-4 px-4 py-1", className)} role="radiogroup" aria-label="Ride category">
      {VEHICLE_CATEGORIES.map((id, i) => {
        const meta = VEHICLE_CATEGORY_META[id];
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
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...springSoft, delay: 0.04 * i }}
            whileTap={{ scale: 0.96 }}
            onClick={() => {
              if (!active) haptic.tick();
              onChange(id);
            }}
            className={cn("relative snap-center shrink-0 w-[124px] rounded-2xl p-3 text-left border transition-colors overflow-hidden", active ? "border-brand-500/70" : "border-white/8 bg-ink-800")}
          >
            {active && <motion.span layoutId="category-glow" transition={spring} className="absolute inset-0 bg-brand-500/12" />}
            <span className="relative flex flex-col gap-2">
              <span className={cn("size-10 rounded-xl flex items-center justify-center", active ? "bg-brand-500 text-ink-950" : "bg-white/5 text-ink-200")}>
                <CategoryIcon category={id} className="size-[22px]" badgeClassName={active ? "text-ink-950" : undefined} />
              </span>
              <span>
                <span className="block font-display text-[14.5px] font-semibold text-ink-50 leading-tight">{meta.label}</span>
                <span className="block text-[11.5px] text-ink-400 mt-0.5">
                  {meta.seats} {meta.seats === 1 ? "seat" : "seats"}
                </span>
              </span>
              <span className="min-h-5 flex items-center">
                {fare ? (
                  <Money value={fare.recommendedFarePkr} className={cn("text-[14px] font-bold", active ? "text-brand-300" : "text-ink-100")} />
                ) : loading ? (
                  <Skeleton className="h-4 w-16" />
                ) : (
                  <span className="text-[12px] text-ink-500">Set a route</span>
                )}
              </span>
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
