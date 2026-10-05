import { motion } from "framer-motion";
import { Check, NavigationArrow, Star, X } from "@phosphor-icons/react";
import type { BidDto } from "@raahi/shared";
import { Avatar, Badge, Button, Money } from "@/components/ui";
import { spring, springSoft } from "@/lib/motion";
import { cn, formatKm, pkr } from "@/lib/utils";
import { CountdownRing } from "./CountdownRing";

/**
 * One driver's offer on a white pillow. Slides in from the right, leaves to
 * the left when declined, and carries its own coral expiry ring so the
 * passenger can see which offers are about to disappear. The best offer is
 * presented as a peeled sticker.
 */
export function BidCard({ bid, offeredFarePkr, bidTtlSeconds, onAccept, onDecline, accepting, disabled, highlight }: { bid: BidDto; offeredFarePkr: number; bidTtlSeconds: number; onAccept: () => void; onDecline: () => void; accepting?: boolean; disabled?: boolean; highlight?: boolean }) {
  const diff = bid.amountPkr - offeredFarePkr;
  const d = bid.driver;
  const rating = d.ratingCount > 0 ? d.ratingAvg.toFixed(1) : null;
  const v = d.vehicle;
  const car = v ? [v.color, v.make, v.model].filter(Boolean).join(" ") : null;

  return (
    <motion.li
      layout
      initial={{ x: 96, opacity: 0, scale: 0.96 }}
      animate={{ x: 0, opacity: 1, scale: 1, rotate: highlight ? -1.2 : 0 }}
      exit={{ x: -72, opacity: 0, scale: 0.94, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }}
      transition={springSoft}
      className={cn("relative list-none pillow p-4 flex flex-col gap-3", highlight && "sticker bg-coral-100/60")}
    >
      {highlight && (
        <motion.span initial={{ scale: 0, rotate: -8 }} animate={{ scale: 1, rotate: -6 }} transition={spring} className="absolute -top-3 left-4 rounded-full bg-sun-500 text-ink-900 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider shadow-pillow">
          Best offer
        </motion.span>
      )}
      <div className="flex items-start gap-3">
        <Avatar name={d.fullName} src={d.avatarUrl} size={52} ring={diff <= 0} />
        <div className="flex-1 min-w-0">
          <p className="font-display text-[17px] font-semibold text-ink-900 truncate leading-tight">{d.fullName}</p>
          <p className="text-[12.5px] text-ink-500 mt-0.5 flex items-center gap-1 truncate font-semibold">
            <Star className="size-4 text-sun-500 shrink-0" weight="fill" />
            {rating ? (
              <>
                <span className="font-extrabold text-ink-800">{rating}</span>
                <span className="text-ink-400">({d.ratingCount})</span>
              </>
            ) : (
              <span className="font-extrabold text-ink-800">New driver</span>
            )}
            <span className="text-ink-300">·</span>
            <span className="truncate">{d.totalRides} {d.totalRides === 1 ? "trip" : "trips"}</span>
          </p>
          {(car || v?.plate) && (
            <span className="mt-1.5 inline-flex items-center gap-1.5 max-w-full rounded-full bg-paper-100 pl-2.5 pr-1 py-0.5 text-[12px] font-bold text-ink-700">
              <span className="truncate">{car}</span>
              {v?.plate && <span className="rounded-full bg-white border border-paper-300 px-1.5 py-px font-display font-semibold tracking-[0.08em] text-ink-900 text-[11.5px]">{v.plate}</span>}
            </span>
          )}
        </div>
        <CountdownRing expiresAt={bid.expiresAt} totalSeconds={bidTtlSeconds} size={46} />
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <p className="text-[13px] text-ink-500 flex items-center gap-1.5 font-semibold">
            <NavigationArrow className="size-4 text-teal-500 shrink-0" weight="duotone" />
            <span className="font-extrabold text-ink-800">{bid.etaMin} min</span>
            <span>to you</span>
            {bid.distanceToPickupKm != null && (
              <>
                <span className="text-ink-300">·</span>
                <span>{formatKm(bid.distanceToPickupKm)} away</span>
              </>
            )}
          </p>
          {bid.message && <p className="text-[13px] text-ink-500 italic truncate font-medium">“{bid.message}”</p>}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Money value={bid.amountPkr} className={cn("text-[26px] leading-none", diff > 0 ? "text-sun-600!" : "text-coral-600!")} />
          {diff === 0 ? (
            <Badge tone="teal">Your price</Badge>
          ) : diff > 0 ? (
            <Badge tone="sun">+{pkr(diff)}</Badge>
          ) : (
            <Badge tone="mint">−{pkr(Math.abs(diff))} cheaper</Badge>
          )}
        </div>
      </div>

      <motion.div layout transition={spring} className="grid grid-cols-[1fr_1.7fr] gap-2 pt-1">
        <Button variant="ghost" size="md" icon={X} onClick={onDecline} disabled={accepting || disabled}>
          Decline
        </Button>
        <Button variant="primary" size="md" icon={Check} loading={accepting} disabled={disabled} onClick={onAccept}>
          Accept {pkr(bid.amountPkr)}
        </Button>
      </motion.div>
    </motion.li>
  );
}
