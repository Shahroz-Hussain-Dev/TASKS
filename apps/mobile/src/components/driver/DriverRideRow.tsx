import { motion } from "framer-motion";
import { CaretRight, Star } from "@phosphor-icons/react";
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
        className="w-full pillow p-3.5 flex items-center gap-3 text-left"
      >
        <Avatar name={ride.customer.fullName} src={ride.customer.avatarUrl} size={44} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-[12px] font-bold text-ink-500">
            <span className="tabular-nums">{timeOfDay(ride.createdAt)}</span>
            <span className="text-ink-300">·</span>
            <span className="truncate">{ride.customer.fullName}</span>
            {ride.theirRating && (
              <span className="inline-flex items-center gap-0.5 text-sun-600">
                <Star className="size-3" weight="fill" />
                {ride.theirRating.stars}
              </span>
            )}
          </div>
          <p className="text-[14px] font-bold text-ink-900 leading-snug truncate mt-0.5 flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-teal-500 shrink-0" aria-hidden />
            {ride.pickup.name ?? ride.pickup.address}
          </p>
          <p className="text-[13px] font-semibold text-ink-600 leading-snug truncate flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-coral-500 shrink-0" aria-hidden />
            {ride.dropoff.name ?? ride.dropoff.address}
          </p>
          <p className="text-[12px] font-semibold text-ink-400 mt-0.5">
            {formatKm(ride.distanceKm)} · {formatDuration(ride.durationMin)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {earned ? (
            <span className="inline-flex rounded-full bg-sun-100 px-2.5 py-1">
              <Money value={ride.farePkr} className="text-[15px] text-ink-900" />
            </span>
          ) : (
            <span className={cn("font-display text-[14px] font-semibold text-ink-400 line-through")}>PKR {ride.farePkr.toLocaleString("en-PK")}</span>
          )}
          <RideStatusBadge status={ride.status} />
        </div>
        <CaretRight className="size-4 text-ink-300 shrink-0 -ml-1" weight="bold" />
      </motion.button>
    </motion.li>
  );
}
