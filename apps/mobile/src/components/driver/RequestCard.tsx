import { motion, useMotionValue, useTransform } from "framer-motion";
import { ArrowRight, Fuel, MessageSquare, Star, Users } from "lucide-react";
import { useMemo } from "react";
import { driverEconomics, type DriverRequestFeedItem } from "@raahi/shared";
import { Avatar, Badge, Button, Money } from "@/components/ui";
import { formatCountdown } from "@/hooks/driver/useNow";
import { spring } from "@/lib/motion";
import { cn, formatDuration, formatKm, secondsLeft } from "@/lib/utils";
import { CountdownRing } from "./CountdownRing";

/**
 * One incoming request in the driver's feed. Slides in from the right, can be
 * swiped left to hide, and morphs into a "waiting for the passenger" state
 * once the driver has an offer out.
 */
export function RequestCard({ item, now, bidTtlSeconds, requestTtlSeconds, onAccept, onOffer, onWithdraw, onDismiss, accepting, withdrawing }: { item: DriverRequestFeedItem; now: number; bidTtlSeconds: number; requestTtlSeconds: number; onAccept: () => void; onOffer: () => void; onWithdraw: () => void; onDismiss: () => void; accepting: boolean; withdrawing: boolean }) {
  const { request, myBid, economics } = item;
  const x = useMotionValue(0);
  const opacity = useTransform(x, [-220, -80, 0], [0.2, 0.85, 1]);
  const hintOpacity = useTransform(x, [-140, -40], [1, 0]);

  const offer = request.offeredFarePkr;
  const eco = useMemo(() => driverEconomics(offer, economics), [offer, economics]);
  const pending = myBid?.status === "pending";
  const bidLeft = myBid ? secondsLeft(myBid.expiresAt, now) : 0;
  const reqLeft = secondsLeft(request.expiresAt, now);
  const reqFrac = requestTtlSeconds > 0 ? Math.min(1, reqLeft / requestTtlSeconds) : 0;
  const premium = offer - request.recommendedFarePkr;

  return (
    <motion.div
      layout
      initial={{ x: 140, opacity: 0, scale: 0.94 }}
      animate={{ x: 0, opacity: 1, scale: 1 }}
      exit={{ x: -220, opacity: 0, scale: 0.9, transition: { duration: 0.22 } }}
      transition={spring}
      className="relative"
    >
      <motion.div style={{ opacity: hintOpacity }} className="absolute inset-y-0 right-4 flex items-center text-[12.5px] font-semibold text-ink-400 pointer-events-none" aria-hidden>
        Hide
        <ArrowRight className="size-4 ml-1 rotate-180" />
      </motion.div>
      <motion.article
        drag={pending ? false : "x"}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0.7, right: 0.04 }}
        dragSnapToOrigin
        onDragEnd={(_, info) => {
          if (info.offset.x < -120 || info.velocity.x < -700) onDismiss();
        }}
        style={{ x, opacity }}
        className={cn("relative overflow-hidden rounded-[28px] glass shadow-float", pending ? "border-brand-500/35" : "")}
        aria-label={`Request from ${request.customer.fullName}`}
      >
        <div className="p-4 flex flex-col gap-3">
          {/* Header */}
          <div className="flex items-start gap-3">
            <Avatar name={request.customer.fullName} src={request.customer.avatarUrl} size={42} />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-ink-50 truncate text-[15px]">{request.customer.fullName}</p>
              <p className="text-[12.5px] text-ink-400 flex items-center gap-1.5 mt-0.5">
                <Star className="size-3 text-amber-300 fill-amber-300" />
                <span className="tabular-nums">{request.customer.ratingCount > 0 ? `${request.customer.ratingAvg.toFixed(1)} (${request.customer.ratingCount})` : "New rider"}</span>
                <span className="text-ink-600">·</span>
                <Users className="size-3" />
                <span>{request.passengers}</span>
              </p>
            </div>
            <div className="text-right shrink-0">
              <Money value={offer} className="text-[24px] font-bold text-amber-300 leading-none" />
              <p className={cn("text-[11.5px] mt-1 tabular-nums", premium > 0 ? "text-brand-300" : premium < 0 ? "text-ink-500" : "text-ink-500")}>{premium > 0 ? `+PKR ${premium} above fair` : premium < 0 ? `PKR ${-premium} below fair` : "Fair price"}</p>
            </div>
          </div>

          {/* Route */}
          <div className="relative pl-5">
            <span className="absolute left-1.5 top-2 bottom-2 w-px bg-gradient-to-b from-brand-400 via-ink-500 to-amber-400" aria-hidden />
            <span className="absolute left-0 top-1 size-3.5 rounded-full border-[3px] border-brand-400 bg-ink-900" aria-hidden />
            <span className="absolute left-0 bottom-1 size-3.5 rounded-sm rotate-45 bg-amber-400" aria-hidden />
            <p className="text-[14px] text-ink-50 leading-snug truncate">{request.pickup.name ?? request.pickup.address}</p>
            <p className="text-[12px] text-brand-300 font-medium mt-0.5">
              {formatKm(item.distanceToPickupKm)} · {formatDuration(item.etaToPickupMin)} to pickup
            </p>
            <p className="text-[14px] text-ink-50 leading-snug truncate mt-2">{request.dropoff.name ?? request.dropoff.address}</p>
            <p className="text-[12px] text-ink-400 mt-0.5">
              Trip {formatKm(request.distanceKm)} · {formatDuration(request.durationMin)}
            </p>
          </div>

          {request.note && (
            <p className="flex items-start gap-2 text-[13px] text-ink-200 bg-white/4 rounded-xl px-3 py-2 leading-snug">
              <MessageSquare className="size-3.5 text-ink-400 shrink-0 mt-0.5" />
              <span className="line-clamp-2">{request.note}</span>
            </p>
          )}

          {/* Economics */}
          <p className={cn("flex items-center gap-1.5 text-[12.5px] tabular-nums", eco.belowBreakEven ? "text-amber-300" : "text-ink-300")}>
            <Fuel className="size-3.5 shrink-0" />
            Fuel ≈ PKR {eco.fuelCostPkr.toLocaleString("en-PK")} · you keep <span className={cn("font-semibold", eco.belowBreakEven ? "text-amber-300" : "text-brand-300")}>PKR {Math.max(0, eco.netEarningPkr).toLocaleString("en-PK")}</span>
            {eco.belowBreakEven && <span className="text-[11.5px]">· below your break-even</span>}
          </p>

          {/* Actions */}
          {pending && myBid ? (
            <div className="flex items-center gap-3 rounded-2xl bg-brand-500/8 border border-brand-500/20 px-3 py-2.5">
              <CountdownRing total={bidTtlSeconds} left={bidLeft} size={44} stroke={3.5}>
                <span className="text-[11px] font-bold text-ink-50 tabular-nums">{formatCountdown(bidLeft)}</span>
              </CountdownRing>
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-semibold text-ink-50">
                  Offer sent · <Money value={myBid.amountPkr} className="text-brand-300" />
                </p>
                <p className="text-[12px] text-ink-400 truncate">Waiting for {request.customer.fullName.split(" ")[0]} to choose…</p>
              </div>
              <Button size="sm" variant="ghost" loading={withdrawing} onClick={onWithdraw} style={{ color: "#fb7185" }}>
                Withdraw
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {myBid && myBid.status !== "pending" && (
                <Badge tone={myBid.status === "expired" ? "neutral" : "rose"} className="self-start">
                  {myBid.status === "expired" ? "Your offer expired" : myBid.status === "withdrawn" ? "Offer withdrawn" : "Passenger chose another driver"}
                </Badge>
              )}
              <div className="grid grid-cols-[1.35fr_1fr] gap-2">
                <Button variant="amber" size="lg" loading={accepting} onClick={onAccept} className="font-display">
                  Accept <Money value={offer} prefix="PKR " className="font-bold" />
                </Button>
                <Button variant="secondary" size="lg" onClick={onOffer}>
                  Offer price
                </Button>
              </div>
            </div>
          )}
        </div>
        {/* Request lifetime */}
        <div className="h-[3px] bg-white/5" aria-hidden>
          <motion.div className={cn("h-full", reqFrac > 0.3 ? "bg-brand-500/70" : "bg-amber-400/80")} initial={false} animate={{ width: `${reqFrac * 100}%` }} transition={{ duration: 1, ease: "linear" }} />
        </div>
      </motion.article>
    </motion.div>
  );
}
