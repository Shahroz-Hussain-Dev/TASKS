import { motion } from "framer-motion";
import { CaretRight } from "@phosphor-icons/react";
import type { RideDto } from "@raahi/shared";
import { Money } from "@/components/ui";
import { RideStatusBadge } from "@/components/shared/RideStatusBadge";
import { timeOfDay } from "@/components/shared/meta";
import { item, spring } from "@/lib/motion";
import { haptic } from "@/lib/native";
import { cn, formatKm } from "@/lib/utils";
import { CategoryIcon } from "./CategoryIcon";
import { CATEGORY_TONE } from "./categoryTone";

/** One pillow row in the rides history: mini route dots, places, fare in Fredoka. */
export function RideRow({ ride, onClick }: { ride: RideDto; onClick: () => void }) {
  const cancelled = ride.status === "cancelled_by_customer" || ride.status === "cancelled_by_driver";
  const tone = CATEGORY_TONE[ride.category];
  return (
    <motion.li layout variants={item.up} transition={spring} className="list-none">
      <motion.button
        type="button"
        whileTap={{ scale: 0.985 }}
        transition={spring}
        onClick={() => {
          haptic.light();
          onClick();
        }}
        className="w-full text-left pillow p-3.5 flex items-center gap-3"
      >
        <span className={cn("size-12 rounded-full flex items-center justify-center shrink-0", cancelled ? "bg-paper-100 text-ink-300" : tone.tint)}>
          <CategoryIcon category={ride.category} className="size-[24px]" />
        </span>
        <span className="flex flex-col items-center self-stretch py-1.5 shrink-0" aria-hidden>
          <span className={cn("size-2.5 rounded-full", cancelled ? "bg-ink-200" : "bg-teal-500")} />
          <span className="flex-1 w-0 border-l-2 border-dotted border-paper-300 my-1" />
          <span className={cn("size-2.5 rounded-[3px]", cancelled ? "bg-ink-200" : "bg-coral-500")} />
        </span>
        <span className="flex-1 min-w-0 flex flex-col gap-0.5">
          <span className="text-[12.5px] text-ink-500 truncate font-medium">{ride.pickup.name ?? ride.pickup.address}</span>
          <span className={cn("text-[15px] font-extrabold truncate leading-snug", cancelled ? "text-ink-400 line-through decoration-ink-300" : "text-ink-900")}>{ride.dropoff.name ?? ride.dropoff.address}</span>
          <span className="flex items-center gap-1.5 text-[11.5px] text-ink-400 font-semibold">
            <span>{timeOfDay(ride.createdAt)}</span>
            <span className="text-ink-300">·</span>
            <span>{formatKm(ride.distanceKm)}</span>
          </span>
        </span>
        <span className="flex flex-col items-end gap-1.5 shrink-0">
          <Money value={ride.farePkr} className={cn("text-[17px]", cancelled ? "text-ink-400" : "text-ink-900")} />
          <RideStatusBadge status={ride.status} />
        </span>
        <CaretRight className="size-4 text-ink-300 shrink-0 -ml-1" weight="bold" />
      </motion.button>
    </motion.li>
  );
}
