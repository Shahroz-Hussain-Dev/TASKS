import { motion } from "framer-motion";
import { Check, MapPin, Star, X } from "lucide-react";
import type { BidDto } from "@raahi/shared";
import { Avatar, Badge, Button, Money } from "@/components/ui";
import { vehicleLine } from "@/components/shared/meta";
import { spring, springSoft } from "@/lib/motion";
import { cn, formatKm, pkr } from "@/lib/utils";
import { CountdownRing } from "./CountdownRing";

/**
 * One driver's offer. Slides in from the right, leaves to the left when
 * declined, and carries its own expiry ring so the passenger can see which
 * offers are about to disappear.
 */
export function BidCard({ bid, offeredFarePkr, bidTtlSeconds, onAccept, onDecline, accepting, disabled }: { bid: BidDto; offeredFarePkr: number; bidTtlSeconds: number; onAccept: () => void; onDecline: () => void; accepting?: boolean; disabled?: boolean }) {
  const diff = bid.amountPkr - offeredFarePkr;
  const d = bid.driver;
  const rating = d.ratingCount > 0 ? d.ratingAvg.toFixed(1) : null;
  const vehicle = vehicleLine(d.vehicle);

  return (
    <motion.li
      layout
      initial={{ x: 96, opacity: 0, scale: 0.96 }}
      animate={{ x: 0, opacity: 1, scale: 1 }}
      exit={{ x: -72, opacity: 0, scale: 0.94, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }}
      transition={springSoft}
      className={cn("list-none rounded-3xl bg-ink-800 border shadow-card p-4 flex flex-col gap-3", diff <= 0 ? "border-brand-500/30" : "border-white/8")}
    >
      <div className="flex items-start gap-3">
        <Avatar name={d.fullName} src={d.avatarUrl} size={50} ring={diff <= 0} />
        <div className="flex-1 min-w-0">
          <p className="font-display text-[16.5px] font-semibold text-ink-50 truncate leading-tight">{d.fullName}</p>
          <p className="text-[12.5px] text-ink-300 mt-0.5 flex items-center gap-1 truncate">
            <Star className="size-3.5 text-amber-400 fill-amber-400 shrink-0" />
            {rating ? (
              <>
                <span className="font-semibold text-ink-100">{rating}</span>
                <span className="text-ink-500">({d.ratingCount})</span>
              </>
            ) : (
              <span className="font-semibold text-ink-100">New driver</span>
            )}
            <span className="text-ink-600">·</span>
            <span className="truncate">{d.totalRides} {d.totalRides === 1 ? "trip" : "trips"}</span>
          </p>
          {vehicle && <p className="text-[12.5px] text-ink-400 truncate mt-0.5">{vehicle}</p>}
        </div>
        <CountdownRing expiresAt={bid.expiresAt} totalSeconds={bidTtlSeconds} size={44} />
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <p className="text-[13px] text-ink-300 flex items-center gap-1.5">
            <MapPin className="size-3.5 text-brand-400 shrink-0" />
            <span className="font-semibold text-ink-100">{bid.etaMin} min</span>
            <span>to you</span>
            {bid.distanceToPickupKm != null && (
              <>
                <span className="text-ink-600">·</span>
                <span>{formatKm(bid.distanceToPickupKm)} away</span>
              </>
            )}
          </p>
          {bid.message && <p className="text-[13px] text-ink-300 italic truncate">“{bid.message}”</p>}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Money value={bid.amountPkr} className={cn("text-[24px] font-bold leading-none", diff > 0 ? "text-amber-300" : "text-brand-400")} />
          {diff === 0 ? (
            <Badge tone="brand">Your price</Badge>
          ) : diff > 0 ? (
            <Badge tone="amber">+{pkr(diff)}</Badge>
          ) : (
            <Badge tone="brand">−{pkr(Math.abs(diff))} cheaper</Badge>
          )}
        </div>
      </div>

      <motion.div layout transition={spring} className="grid grid-cols-[1fr_1.6fr] gap-2 pt-1">
        <Button variant="outline" size="md" icon={X} onClick={onDecline} disabled={accepting || disabled}>
          Decline
        </Button>
        <Button variant={diff > 0 ? "amber" : "primary"} size="md" icon={Check} loading={accepting} disabled={disabled} onClick={onAccept}>
          Accept {pkr(bid.amountPkr)}
        </Button>
      </motion.div>
    </motion.li>
  );
}
