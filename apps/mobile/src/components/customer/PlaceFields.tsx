import { motion } from "framer-motion";
import { ArrowUpDown } from "lucide-react";
import type { Place } from "@raahi/shared";
import { Skeleton } from "@/components/ui";
import { spring } from "@/lib/motion";
import { haptic } from "@/lib/native";
import { cn } from "@/lib/utils";

/**
 * Pickup and drop-off rows joined by a timeline. Tapping a row opens search;
 * the swap button flips the two.
 */
export function PlaceFields({ pickup, dropoff, locating, onEdit, onSwap, className }: { pickup: Place | null; dropoff: Place | null; locating?: boolean; onEdit: (target: "pickup" | "dropoff") => void; onSwap: () => void; className?: string }) {
  return (
    <div className={cn("relative rounded-3xl bg-ink-800 border border-white/8 shadow-card p-2 flex items-stretch gap-2", className)}>
      <div className="flex flex-col items-center py-4 pl-2.5 w-6 shrink-0">
        <span className="size-3 rounded-full bg-brand-400 border-2 border-ink-950 shadow-glow" />
        <span className="flex-1 w-px my-1 border-l border-dashed border-ink-400/60" />
        <span className="size-3 rounded-[3px] bg-amber-400 border-2 border-ink-950" />
      </div>
      <div className="flex-1 min-w-0 flex flex-col">
        <FieldRow label="Pickup" place={pickup} placeholder={locating ? "Finding your location…" : "Set pickup point"} loading={locating && !pickup} onClick={() => onEdit("pickup")} />
        <div className="h-px bg-white/6 mx-1" />
        <FieldRow label="Drop-off" place={dropoff} placeholder="Where to?" accent onClick={() => onEdit("dropoff")} />
      </div>
      <motion.button
        type="button"
        aria-label="Swap pickup and drop-off"
        whileTap={{ scale: 0.86, rotate: 180 }}
        transition={spring}
        disabled={!pickup || !dropoff}
        onClick={() => {
          haptic.light();
          onSwap();
        }}
        className="self-center size-10 rounded-full flex items-center justify-center bg-white/5 text-ink-200 disabled:text-ink-600 disabled:bg-transparent mr-1"
      >
        <ArrowUpDown className="size-[18px]" />
      </motion.button>
    </div>
  );
}

function FieldRow({ label, place, placeholder, loading, accent, onClick }: { label: string; place: Place | null; placeholder: string; loading?: boolean; accent?: boolean; onClick: () => void }) {
  const primary = place ? place.name ?? place.address : null;
  const secondary = place && place.name && place.name !== place.address ? place.address : null;
  return (
    <motion.button type="button" whileTap={{ scale: 0.985 }} transition={spring} onClick={onClick} className="flex-1 text-left rounded-2xl px-3 py-2.5 min-h-[58px] flex flex-col justify-center gap-0.5 hover:bg-white/4 transition-colors">
      <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-500">{label}</span>
      {loading ? (
        <Skeleton className="h-4 w-40 mt-1" />
      ) : primary ? (
        <>
          <span className="text-[15px] font-semibold text-ink-50 truncate leading-snug">{primary}</span>
          {secondary && <span className="text-[12px] text-ink-400 truncate">{secondary}</span>}
        </>
      ) : (
        <span className={cn("text-[15px] font-semibold truncate", accent ? "text-brand-400" : "text-ink-400")}>{placeholder}</span>
      )}
    </motion.button>
  );
}
