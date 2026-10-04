import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import type { RideDto } from "@raahi/shared";
import { Money } from "@/components/ui";
import { RideStatusBadge } from "@/components/shared/RideStatusBadge";
import { timeOfDay } from "@/components/shared/meta";
import { item, spring } from "@/lib/motion";
import { haptic } from "@/lib/native";
import { cn, formatKm } from "@/lib/utils";
import { CategoryIcon } from "./CategoryIcon";

/** One row in the rides history. */
export function RideRow({ ride, onClick }: { ride: RideDto; onClick: () => void }) {
  const cancelled = ride.status === "cancelled_by_customer" || ride.status === "cancelled_by_driver";
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
        className="w-full text-left rounded-3xl bg-ink-800 border border-white/6 shadow-card p-3.5 flex items-center gap-3"
      >
        <span className={cn("size-11 rounded-2xl flex items-center justify-center shrink-0", cancelled ? "bg-white/4 text-ink-500" : "bg-brand-500/12 text-brand-400")}>
          <CategoryIcon category={ride.category} className="size-[22px]" />
        </span>
        <span className="flex-1 min-w-0 flex flex-col gap-0.5">
          <span className="flex items-center gap-2 text-[11.5px] text-ink-400">
            <span>{timeOfDay(ride.createdAt)}</span>
            <span className="text-ink-600">·</span>
            <span>{formatKm(ride.distanceKm)}</span>
          </span>
          <span className={cn("text-[15px] font-semibold truncate leading-snug", cancelled ? "text-ink-300 line-through decoration-ink-500" : "text-ink-50")}>{ride.dropoff.name ?? ride.dropoff.address}</span>
          <span className="text-[12.5px] text-ink-400 truncate">from {ride.pickup.name ?? ride.pickup.address}</span>
        </span>
        <span className="flex flex-col items-end gap-1.5 shrink-0">
          <Money value={ride.farePkr} className={cn("text-[15.5px] font-bold", cancelled ? "text-ink-500" : "text-ink-50")} />
          <RideStatusBadge status={ride.status} />
        </span>
        <ChevronRight className="size-4 text-ink-500 shrink-0 -ml-1" />
      </motion.button>
    </motion.li>
  );
}
