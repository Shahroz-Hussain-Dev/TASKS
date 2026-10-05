import { motion, useMotionValue, useTransform } from "framer-motion";
import { ArrowLeft, ChatCircleDots, GasPump, Star, Users } from "@phosphor-icons/react";
import { useMemo } from "react";
import { driverEconomics, type DriverRequestFeedItem } from "@raahi/shared";
import { Avatar, Badge, Button, Money } from "@/components/ui";
import { formatCountdown } from "@/hooks/driver/useNow";
import { spring, wiggle } from "@/lib/motion";
import { cn, formatDuration, formatKm, secondsLeft } from "@/lib/utils";
import { CountdownRing } from "./CountdownRing";

/**
 * One incoming request in the driver's feed. Slides in from the right with a
 * little wiggle, can be swiped left to hide, and morphs into a "waiting for
 * the passenger" state once the driver has an offer out.
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
      initial={{ x: 160, opacity: 0, scale: 0.94 }}
      animate={{ x: 0, opacity: 1, scale: 1, rotate: [...wiggle.rotate] }}
      exit={{ x: -220, opacity: 0, scale: 0.9, transition: { duration: 0.22 } }}
      transition={{ ...spring, rotate: { ...wiggle.transition, delay: 0.3 } }}
      className="relative"
    >
      <motion.div style={{ opacity: hintOpacity }} className="absolute inset-y-0 right-4 flex items-center text-[12.5px] font-bold text-ink-400 pointer-events-none" aria-hidden>
        <ArrowLeft className="size-4 mr-1" weight="bold" />
        Hide
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
        className={cn("relative overflow-hidden pillow", pending && "ring-2 ring-teal-200")}
        aria-label={`Request from ${request.customer.fullName}`}
      >
        <div className="p-4 flex flex-col gap-3">
          {/* Header */}
          <div className="flex items-start gap-3">
            <Avatar name={request.customer.fullName} src={request.customer.avatarUrl} size={44} />
            <div className="flex-1 min-w-0">
              <p className="font-display font-semibold text-ink-900 truncate text-[16px]">{request.customer.fullName}</p>
              <p className="text-[12.5px] font-semibold text-ink-500 flex items-center gap-1.5 mt-0.5">
                <Star className="size-3.5 text-sun-500" weight="fill" />
                <span className="tabular-nums">{request.customer.ratingCount > 0 ? `${request.customer.ratingAvg.toFixed(1)} (${request.customer.ratingCount})` : "New rider"}</span>
                <span className="text-ink-300">·</span>
                <Users className="size-3.5" weight="duotone" />
                <span>{request.passengers}</span>
              </p>
            </div>
            <div className="text-right shrink-0 flex flex-col items-end gap-1">
              <span className="inline-flex items-center rounded-full bg-sun-100 px-3 py-1">
                <Money value={offer} className="text-[20px] text-ink-900 leading-none" />
              </span>
              <p className={cn("text-[11.5px] font-bold tabular-nums", premium > 0 ? "text-teal-600" : "text-ink-400")}>{premium > 0 ? `+PKR ${premium} above fair` : premium < 0 ? `PKR ${-premium} below fair` : "Fair price"}</p>
            </div>
          </div>

          {/* Route */}
          <div className="relative pl-6">
            <span className="absolute left-[7px] top-3 bottom-3 w-0.5 rounded-full bg-paper-300" aria-hidden />
            <span className="absolute left-0 top-1 size-4 rounded-full bg-teal-500 ring-[3px] ring-teal-100" aria-hidden />
            <span className="absolute left-0 bottom-1 size-4 rounded-full bg-coral-500 ring-[3px] ring-coral-100" aria-hidden />
            <p className="text-[14.5px] font-bold text-ink-900 leading-snug truncate">{request.pickup.name ?? request.pickup.address}</p>
            <p className="text-[12px] text-teal-600 font-bold mt-0.5">
              {formatKm(item.distanceToPickupKm)} · {formatDuration(item.etaToPickupMin)} to pickup
            </p>
            <p className="text-[14.5px] font-bold text-ink-900 leading-snug truncate mt-2.5">{request.dropoff.name ?? request.dropoff.address}</p>
            <p className="text-[12px] font-semibold text-ink-500 mt-0.5">
              Trip {formatKm(request.distanceKm)} · {formatDuration(request.durationMin)}
            </p>
          </div>

          {request.note && (
            <p className="flex items-start gap-2 text-[13px] font-semibold text-ink-700 bg-paper-100 rounded-2xl px-3 py-2 leading-snug">
              <ChatCircleDots className="size-4 text-coral-500 shrink-0 mt-0.5" weight="duotone" />
              <span className="line-clamp-2">{request.note}</span>
            </p>
          )}

          {/* Economics */}
          <p className={cn("flex items-center gap-1.5 text-[12.5px] font-semibold tabular-nums", eco.belowBreakEven ? "text-sun-600" : "text-ink-500")}>
            <GasPump className="size-4 shrink-0" weight="duotone" />
            Fuel ≈ PKR {eco.fuelCostPkr.toLocaleString("en-PK")} · you keep <span className={cn("font-extrabold", eco.belowBreakEven ? "text-sun-600" : "text-teal-600")}>PKR {Math.max(0, eco.netEarningPkr).toLocaleString("en-PK")}</span>
            {eco.belowBreakEven && <span className="text-[11.5px]">· below your break-even</span>}
          </p>

          {/* Actions */}
          {pending && myBid ? (
            <div className="flex items-center gap-3 rounded-[22px] bg-teal-100 px-3 py-2.5">
              <CountdownRing total={bidTtlSeconds} left={bidLeft} size={44} stroke={3.5}>
                <span className="text-[11px] font-extrabold text-ink-900 tabular-nums">{formatCountdown(bidLeft)}</span>
              </CountdownRing>
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-extrabold text-ink-900">
                  Offer sent · <Money value={myBid.amountPkr} className="text-teal-600" />
                </p>
                <p className="text-[12px] font-semibold text-ink-500 truncate">Waiting for {request.customer.fullName.split(" ")[0]} to choose…</p>
              </div>
              <Button size="sm" variant="ghost" loading={withdrawing} onClick={onWithdraw} className="text-rose-500">
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
                <Button variant="teal" size="lg" loading={accepting} onClick={onAccept} className="font-display">
                  Accept <Money value={offer} prefix="PKR " className="font-bold" />
                </Button>
                <Button variant="outline" size="lg" onClick={onOffer}>
                  Offer price
                </Button>
              </div>
            </div>
          )}
        </div>
        {/* Request lifetime */}
        <div className="h-[4px] bg-paper-200" aria-hidden>
          <motion.div className={cn("h-full rounded-r-full", reqFrac > 0.3 ? "bg-teal-400" : "bg-sun-500")} initial={false} animate={{ width: `${reqFrac * 100}%` }} transition={{ duration: 1, ease: "linear" }} />
        </div>
      </motion.article>
    </motion.div>
  );
}
