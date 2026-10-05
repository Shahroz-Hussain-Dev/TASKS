import { motion } from "framer-motion";
import { ArrowsDownUp } from "@phosphor-icons/react";
import type { Place } from "@raahi/shared";
import { Skeleton } from "@/components/ui";
import { spring } from "@/lib/motion";
import { haptic } from "@/lib/native";
import { cn } from "@/lib/utils";

/**
 * Pickup and drop-off rows joined by a dotted timeline (teal dot → coral dot)
 * on a white pillow. Tapping a row opens search; the swap button flips the two.
 */
export function PlaceFields({ pickup, dropoff, locating, onEdit, onSwap, className }: { pickup: Place | null; dropoff: Place | null; locating?: boolean; onEdit: (target: "pickup" | "dropoff") => void; onSwap: () => void; className?: string }) {
  return (
    <div className={cn("relative pillow p-2 flex items-stretch gap-2", className)}>
      <div className="flex flex-col items-center py-5 pl-3 w-6 shrink-0">
        <span className="size-3.5 rounded-full bg-teal-500 ring-[3px] ring-teal-100" />
        <span className="flex-1 w-0 my-1.5 border-l-2 border-dotted border-paper-300" />
        <span className="size-3.5 rounded-[4px] bg-coral-500 ring-[3px] ring-coral-100" />
      </div>
      <div className="flex-1 min-w-0 flex flex-col">
        <FieldRow label="Pickup" place={pickup} placeholder={locating ? "Finding your location…" : "Set pickup point"} loading={locating && !pickup} onClick={() => onEdit("pickup")} />
        <div className="h-px bg-paper-200 mx-1" />
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
        className="self-center size-10 rounded-full flex items-center justify-center jelly jelly-cream text-ink-700 disabled:text-ink-300 disabled:shadow-none mr-1"
      >
        <ArrowsDownUp className="size-[20px]" weight="bold" />
      </motion.button>
    </div>
  );
}

function FieldRow({ label, place, placeholder, loading, accent, onClick }: { label: string; place: Place | null; placeholder: string; loading?: boolean; accent?: boolean; onClick: () => void }) {
  const primary = place ? place.name ?? place.address : null;
  const secondary = place && place.name && place.name !== place.address ? place.address : null;
  return (
    <motion.button type="button" whileTap={{ scale: 0.985 }} transition={spring} onClick={onClick} className="flex-1 text-left rounded-2xl px-3 py-2.5 min-h-[58px] flex flex-col justify-center gap-0.5 hover:bg-paper-100 transition-colors">
      <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-400">{label}</span>
      {loading ? (
        <Skeleton className="h-4 w-40 mt-1" />
      ) : primary ? (
        <>
          <span className="text-[15px] font-extrabold text-ink-900 truncate leading-snug">{primary}</span>
          {secondary && <span className="text-[12px] text-ink-500 truncate font-medium">{secondary}</span>}
        </>
      ) : (
        <span className={cn("text-[15.5px] font-extrabold truncate", accent ? "font-display text-coral-600!" : "text-ink-300")}>{placeholder}</span>
      )}
    </motion.button>
  );
}
