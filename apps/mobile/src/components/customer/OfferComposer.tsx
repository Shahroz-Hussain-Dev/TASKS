import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { Fuel, Minus, Plus } from "lucide-react";
import { useCallback, useRef } from "react";
import type { FareBreakdown } from "@raahi/shared";
import { Chip, Money } from "@/components/ui";
import { clampOffer } from "@/hooks/customer/offer";
import { spring, springBouncy } from "@/lib/motion";
import { haptic } from "@/lib/native";
import { cn, formatDuration, pkr } from "@/lib/utils";

const QUICK_CHIPS = [-10, 10, 50] as const;

/**
 * The passenger's price. Big animated number, ±10 steppers, quick chips and a
 * draggable "fair range" bar that shows where the offer sits between the floor
 * (fuel + driver's PKR 100), the recommended fare and the ceiling.
 */
export function OfferComposer({ fare, value, onChange, step = 10, className }: { fare: FareBreakdown; value: number; onChange: (v: number) => void; step?: number; className?: string }) {
  const track = useRef<HTMLDivElement>(null);
  const { minimumFarePkr: min, recommendedFarePkr: rec, maximumFarePkr: max } = fare;
  const span = Math.max(1, max - min);
  const pct = ((value - min) / span) * 100;
  const recPct = ((rec - min) / span) * 100;

  const set = useCallback(
    (next: number) => {
      const v = clampOffer(next, fare, step);
      if (v !== value) {
        haptic.tick();
        onChange(v);
      }
    },
    [fare, step, value, onChange],
  );

  const setFromPointer = useCallback(
    (clientX: number) => {
      const el = track.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const f = Math.min(1, Math.max(0, (clientX - rect.left) / Math.max(1, rect.width)));
      set(min + f * span);
    },
    [min, span, set],
  );

  const onPan = (_: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => setFromPointer(info.point.x - window.scrollX);

  const mood: { label: string; tone: "amber" | "brand" | "sky" } = value < rec ? { label: "Below fair — fewer drivers may accept", tone: "amber" } : value === rec ? { label: "Fair price — most drivers accept", tone: "brand" } : { label: "Above fair — expect a faster pickup", tone: "sky" };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold text-ink-300 tracking-wide">Your offer</p>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={mood.tone} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={spring} className={cn("text-[12px] font-semibold", mood.tone === "amber" && "text-amber-300", mood.tone === "brand" && "text-brand-400", mood.tone === "sky" && "text-sky-400")}>
            {mood.label}
          </motion.span>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between gap-3">
        <Stepper icon={Minus} label="Lower offer" disabled={value <= min} onClick={() => set(value - step)} />
        <motion.div key={value} initial={{ scale: 0.94 }} animate={{ scale: 1 }} transition={springBouncy} className="flex-1 text-center">
          <Money value={value} className="text-[40px] leading-none font-bold text-ink-50 tracking-tight" />
        </motion.div>
        <Stepper icon={Plus} label="Raise offer" disabled={value >= max} onClick={() => set(value + step)} />
      </div>

      <div className="flex items-center justify-center gap-2 flex-wrap">
        {QUICK_CHIPS.map((d) => {
          const target = value + d;
          const blocked = target < min || target > max;
          return (
            <Chip key={d} onClick={() => set(target)} className={cn(blocked && "opacity-40")}>
              {d > 0 ? `+${d}` : d}
            </Chip>
          );
        })}
        <Chip active={value === rec} onClick={() => set(rec)}>
          Fair {pkr(rec)}
        </Chip>
      </div>

      <div className="pt-1">
        <motion.div ref={track} onPan={onPan} onPanStart={onPan} onTap={(_, info) => setFromPointer(info.point.x - window.scrollX)} className="relative h-8 touch-none cursor-pointer select-none" role="slider" aria-label="Offer" aria-valuemin={min} aria-valuemax={max} aria-valuenow={value}>
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 rounded-full overflow-hidden bg-white/6">
            <div className="absolute inset-0 opacity-30" style={{ background: `linear-gradient(90deg, #fbbf24 0%, #34d399 ${recPct}%, #a78bfa 100%)` }} />
            <motion.div className={cn("absolute inset-y-0 left-0 rounded-full", mood.tone === "amber" && "bg-amber-400", mood.tone === "brand" && "bg-brand-400", mood.tone === "sky" && "bg-violet-400")} animate={{ width: `${pct}%` }} transition={spring} />
          </div>
          <span className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-4 w-0.5 rounded-full bg-ink-50/70" style={{ left: `${recPct}%` }} aria-hidden />
          <motion.span animate={{ left: `${pct}%` }} transition={spring} className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-6 rounded-full bg-ink-50 border-[3px] border-brand-500 shadow-glow" />
        </motion.div>
        <div className="grid grid-cols-3 text-[11.5px] text-ink-400 mt-0.5">
          <span>
            Min <span className="text-ink-200 font-semibold">{pkr(min)}</span>
          </span>
          <span className="text-center">
            Fair <span className="text-ink-200 font-semibold">{pkr(rec)}</span>
          </span>
          <span className="text-right">
            Max <span className="text-ink-200 font-semibold">{pkr(max)}</span>
          </span>
        </div>
      </div>

      <div className="flex items-start gap-2.5 rounded-2xl bg-white/4 border border-white/6 px-3 py-2.5">
        <Fuel className="size-4 text-amber-300 shrink-0 mt-0.5" />
        <p className="text-[12.5px] text-ink-300 leading-snug">
          Covers ~{fare.litresNeeded.toFixed(1)} L petrol ({pkr(fare.fuelCostPkr)}) + driver's {pkr(fare.driverFlatPkr)}
          {fare.timeCostPkr > 0 && <> · {formatDuration(fare.durationMin)} of driving</>}
          {fare.comfortMultiplier > 1 && <> · {Math.round((fare.comfortMultiplier - 1) * 100)}% comfort tier</>}
        </p>
      </div>
    </div>
  );
}

function Stepper({ icon: Icon, label, onClick, disabled }: { icon: typeof Minus; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <motion.button type="button" aria-label={label} whileTap={disabled ? undefined : { scale: 0.88 }} transition={springBouncy} disabled={disabled} onClick={onClick} className={cn("size-12 rounded-2xl flex items-center justify-center border transition-colors", disabled ? "bg-white/3 border-white/5 text-ink-600" : "bg-ink-700 border-white/8 text-ink-50 hover:bg-ink-600")}>
      <Icon className="size-5" strokeWidth={2.4} />
    </motion.button>
  );
}
