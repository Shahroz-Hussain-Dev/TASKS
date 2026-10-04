import { motion } from "framer-motion";
import { ChevronRight, Star } from "lucide-react";
import type { RideDto } from "@raahi/shared";
import { RideStatusBadge } from "@/components/shared/RideStatusBadge";
import { timeOfDay } from "@/components/shared/meta";
import { Avatar, Money } from "@/components/ui";
import { item, spring } from "@/lib/motion";
import { haptic } from "@/lib/native";
import { cn, formatDuration, formatKm } from "@/lib/utils";

/** One past trip in the driver's history, with what it earned. */
export function DriverRideRow({ ride, onClick }: { ride: RideDto; onClick: () => void }) {
  const earned = ride.status === "completed";
  return (
    <motion.li variants={item.up} layout transition={spring}>
      <motion.button
        type="button"
        whileTap={{ scale: 0.985 }}
        transition={spring}
        onClick={() => {
          haptic.light();
          onClick();
        }}
        className="w-full rounded-3xl bg-ink-800 border border-white/6 shadow-card p-3.5 flex items-center gap-3 text-left"
      >
        <Avatar name={ride.customer.fullName} src={ride.customer.avatarUrl} size={44} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-[12px] text-ink-400">
            <span className="tabular-nums">{timeOfDay(ride.createdAt)}</span>
            <span className="text-ink-600">·</span>
            <span className="truncate">{ride.customer.fullName}</span>
            {ride.theirRating && (
              <span className="inline-flex items-center gap-0.5 text-amber-300">
                <Star className="size-3 fill-amber-300" />
                {ride.theirRating.stars}
              </span>
            )}
          </div>
          <p className="text-[14px] text-ink-50 leading-snug truncate mt-0.5">{ride.pickup.name ?? ride.pickup.address}</p>
          <p className="text-[13px] text-ink-300 leading-snug truncate">→ {ride.dropoff.name ?? ride.dropoff.address}</p>
          <p className="text-[12px] text-ink-500 mt-0.5">
            {formatKm(ride.distanceKm)} · {formatDuration(ride.durationMin)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {earned ? <Money value={ride.farePkr} className="text-[16px] font-bold text-brand-300" /> : <span className={cn("font-display text-[14px] font-semibold text-ink-500 line-through")}>PKR {ride.farePkr.toLocaleString("en-PK")}</span>}
          <RideStatusBadge status={ride.status} />
        </div>
        <ChevronRight className="size-4 text-ink-600 shrink-0 -ml-1" />
      </motion.button>
    </motion.li>
  );
}
