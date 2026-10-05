import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { GasPump, Minus, Plus } from "@phosphor-icons/react";
import { useCallback, useRef } from "react";
import type { FareBreakdown } from "@raahi/shared";
import { Chip, Money, type IconComponent } from "@/components/ui";
import { clampOffer } from "@/hooks/customer/offer";
import { spring, springBouncy } from "@/lib/motion";
import { haptic } from "@/lib/native";
import { cn, formatDuration, pkr } from "@/lib/utils";

const QUICK_CHIPS = [-10, 10, 50] as const;

/**
 * The passenger's price on a sun-tinted card: a huge Fredoka amount, −/+ jelly
 * circles, quick chips and a draggable rainbow range bar (teal → sun → coral)
 * showing where the offer sits between the floor (fuel + driver's PKR 100),
 * the recommended fare and the ceiling.
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

  const mood: { label: string; tone: "sun" | "teal" | "coral"; hex: string } =
    value < rec ? { label: "Below fair — fewer drivers may accept", tone: "sun", hex: "#e8ad1f" } : value === rec ? { label: "Fair price — most drivers accept", tone: "teal", hex: "#12a594" } : { label: "Above fair — expect a faster pickup", tone: "coral", hex: "#ff6b4a" };

  return (
    <div className={cn("relative flex flex-col gap-3 overflow-hidden", className)}>
      <span aria-hidden className="blob bg-sun-200/60 -right-10 -top-12 w-44 h-44" />
      <div className="relative flex items-center justify-between gap-2">
        <p className="text-[12px] font-extrabold uppercase tracking-[0.16em] text-ink-500">Your offer</p>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={mood.tone} initial={{ opacity: 0, y: 6, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.9 }} transition={spring} className={cn("inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-[12px] font-extrabold", mood.tone === "sun" && "text-sun-600", mood.tone === "teal" && "text-teal-600", mood.tone === "coral" && "text-coral-600")}>
            <span className="size-2 rounded-full" style={{ background: mood.hex }} />
            {mood.label}
          </motion.span>
        </AnimatePresence>
      </div>

      <div className="relative flex items-center justify-between gap-3">
        <Stepper icon={Minus} label="Lower offer" disabled={value <= min} onClick={() => set(value - step)} />
        <motion.div key={value} initial={{ scale: 0.94 }} animate={{ scale: 1 }} transition={springBouncy} className="flex-1 text-center">
          <Money value={value} className="text-[46px] leading-none text-ink-900 tracking-tight" />
        </motion.div>
        <Stepper icon={Plus} label="Raise offer" disabled={value >= max} onClick={() => set(value + step)} />
      </div>

      <div className="relative flex items-center justify-center gap-2 flex-wrap">
        {QUICK_CHIPS.map((d) => {
          const target = value + d;
          const blocked = target < min || target > max;
          return (
            <Chip key={d} tone="sun" onClick={() => set(target)} className={cn("bg-white/80", blocked && "opacity-40")}>
              {d > 0 ? `+${d}` : d}
            </Chip>
          );
        })}
        <Chip tone="teal" active={value === rec} onClick={() => set(rec)} className={cn(value !== rec && "bg-white/80")}>
          Fair {pkr(rec)}
        </Chip>
      </div>

      <div className="relative pt-1">
        <motion.div ref={track} onPan={onPan} onPanStart={onPan} onTap={(_, info) => setFromPointer(info.point.x - window.scrollX)} className="relative h-9 touch-none cursor-pointer select-none" role="slider" aria-label="Offer" aria-valuemin={min} aria-valuemax={max} aria-valuenow={value}>
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-3 rounded-full overflow-hidden bg-white/70">
            <div className="absolute inset-0" style={{ background: `linear-gradient(90deg, #12a594 0%, #ffc53d ${recPct}%, #ff6b4a 100%)` }} />
            <motion.div className="absolute inset-y-0 right-0 bg-white/70" animate={{ left: `${pct}%` }} transition={spring} />
          </div>
          <span className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-5 w-1 rounded-full bg-white shadow-pillow" style={{ left: `${recPct}%` }} aria-hidden />
          <motion.span animate={{ left: `${pct}%`, borderColor: mood.hex }} transition={spring} className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-7 rounded-full bg-white border-[4px] shadow-float" style={{ borderColor: mood.hex }} />
        </motion.div>
        <div className="grid grid-cols-3 text-[11.5px] text-ink-500 mt-0.5 font-semibold">
          <span>
            Min <span className="text-ink-800 font-extrabold">{pkr(min)}</span>
          </span>
          <span className="text-center">
            Fair <span className="text-ink-800 font-extrabold">{pkr(rec)}</span>
          </span>
          <span className="text-right">
            Max <span className="text-ink-800 font-extrabold">{pkr(max)}</span>
          </span>
        </div>
      </div>

      <div className="relative flex items-start gap-2.5 rounded-2xl bg-white/80 px-3 py-2.5">
        <GasPump className="size-5 text-sun-600 shrink-0 mt-0.5" weight="duotone" />
        <p className="text-[12.5px] text-ink-600 leading-snug font-semibold">
          Covers ~{fare.litresNeeded.toFixed(1)} L petrol ({pkr(fare.fuelCostPkr)}) + driver's {pkr(fare.driverFlatPkr)}
          {fare.timeCostPkr > 0 && <> · {formatDuration(fare.durationMin)} of driving</>}
          {fare.comfortMultiplier > 1 && <> · {Math.round((fare.comfortMultiplier - 1) * 100)}% comfort tier</>}
        </p>
      </div>
    </div>
  );
}

function Stepper({ icon: Icon, label, onClick, disabled }: { icon: IconComponent; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <motion.button type="button" aria-label={label} whileTap={disabled ? undefined : { scale: 0.9 }} transition={springBouncy} disabled={disabled} onClick={onClick} className={cn("size-[52px] rounded-full flex items-center justify-center", disabled ? "bg-white/50 text-ink-300" : "jelly jelly-white text-ink-900")}>
      <Icon className="size-6" weight="bold" />
    </motion.button>
  );
}
