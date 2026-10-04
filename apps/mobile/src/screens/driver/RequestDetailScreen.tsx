import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Fuel, MessageSquare, Send, Star, Timer, Users } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { decodePolyline, driverEconomics, MARKET_RULES, placeBidSchema, roundTo, type DriverRequestFeedItem, type LatLng } from "@raahi/shared";
import { CountdownRing } from "@/components/driver/CountdownRing";
import { Stepper } from "@/components/driver/Stepper";
import { FitCamera } from "@/components/driver/FitCamera";
import { CarMarker, MapView, Marker, PinMarker, RouteLine } from "@/components/Map";
import { BackButton } from "@/components/shared/BackButton";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import { Avatar, Button, Chip, EmptyState, Input, Money, Skeleton, useToast } from "@/components/ui";
import { dk } from "@/hooks/driver/keys";
import { useDriverPresence, useGpsHold } from "@/hooks/driver/presence";
import { useActiveRideRedirect } from "@/hooks/driver/useActiveRideRedirect";
import { useConfig } from "@/hooks/driver/useConfig";
import { useDriverFeed } from "@/hooks/driver/useDriverFeed";
import { formatCountdown, useNow } from "@/hooks/driver/useNow";
import { api } from "@/lib/api";
import { DEFAULT_CENTER } from "@/lib/config";
import { item, spring, stagger } from "@/lib/motion";
import { haptic } from "@/lib/native";
import { cn, errorMessage, formatDuration, formatKm, secondsLeft } from "@/lib/utils";

const STEP_PKR = 10;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Bid composer. The full route on the map, the passenger's offer, quick
 * chips (accept / +10 / +20 / +30 %), a clamped stepper and live personal
 * economics, then one tap to send the offer.
 */
export default function RequestDetailScreen() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { settings } = useConfig();
  const pres = useDriverPresence();
  const now = useNow(1000);
  useGpsHold("request");
  useActiveRideRedirect(true);

  const feed = useDriverFeed(true);
  const feedItem = useMemo<DriverRequestFeedItem | null>(() => feed.data?.items.find((i) => i.request.id === id) ?? null, [feed.data, id]);
  const req = feedItem?.request ?? null;

  const [amount, setAmount] = useState<number | null>(null);
  const [eta, setEta] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!feedItem || amount !== null) return;
    setAmount(clamp(feedItem.request.offeredFarePkr, feedItem.request.minFarePkr, feedItem.request.maxFarePkr));
    setEta(clamp(Math.round(feedItem.etaToPickupMin) || 1, 1, 120));
  }, [feedItem, amount]);

  const routePoints = useMemo<LatLng[]>(() => {
    if (!req) return [];
    if (req.routePolyline) {
      try {
        const pts = decodePolyline(req.routePolyline);
        if (pts.length >= 2) return pts;
      } catch {
        /* fall through to a straight line */
      }
    }
    return [req.pickup, req.dropoff];
  }, [req]);

  const chips = useMemo(() => {
    if (!req) return [];
    const out: { step: number; value: number }[] = [];
    for (const step of MARKET_RULES.bidChipSteps) {
      const value = clamp(roundTo(req.offeredFarePkr * (1 + step), STEP_PKR), req.minFarePkr, req.maxFarePkr);
      if (!out.some((c) => c.value === value)) out.push({ step, value });
    }
    return out;
  }, [req]);

  const eco = feedItem && amount !== null ? driverEconomics(amount, feedItem.economics) : null;
  const pending = feedItem?.myBid?.status === "pending" ? feedItem.myBid : null;

  const place = useMutation({
    mutationFn: (body: { amountPkr: number; etaMin: number; message?: string }) => api.driver.placeBid(id, body),
    onSuccess: (bid) => {
      haptic.success();
      queryClient.setQueryData<{ items: DriverRequestFeedItem[]; online: boolean; serverTime: string }>(dk.feed, (f) => (f ? { ...f, items: f.items.map((x) => (x.request.id === id ? { ...x, myBid: bid } : x)) } : f));
      void queryClient.invalidateQueries({ queryKey: dk.feed });
      toast({ title: bid.amountPkr === req?.offeredFarePkr ? "Accepted at the passenger's price" : `Offer sent · PKR ${bid.amountPkr.toLocaleString("en-PK")}`, body: "We'll take you to the ride the moment they confirm.", tone: "success" });
      navigate("/d/home", { replace: true });
    },
    onError: (err) => {
      haptic.error();
      setError(errorMessage(err, "Couldn't send your offer"));
    },
  });

  const withdraw = useMutation({
    mutationFn: (bidId: string) => api.driver.withdrawBid(bidId),
    onSuccess: () => {
      haptic.light();
      queryClient.setQueryData<{ items: DriverRequestFeedItem[]; online: boolean; serverTime: string }>(dk.feed, (f) => (f ? { ...f, items: f.items.map((x) => (x.request.id === id && x.myBid ? { ...x, myBid: { ...x.myBid, status: "withdrawn" } } : x)) } : f));
      void queryClient.invalidateQueries({ queryKey: dk.feed });
      toast({ title: "Offer withdrawn", body: "You can send a new one.", tone: "neutral" });
    },
    onError: (err) => toast({ title: "Couldn't withdraw", body: errorMessage(err), tone: "error" }),
  });

  const send = () => {
    if (!req || amount === null || eta === null) return;
    const parsed = placeBidSchema.safeParse({ amountPkr: amount, etaMin: eta, message: message.trim() || undefined });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your offer");
      haptic.warning();
      return;
    }
    setError(null);
    place.mutate(parsed.data);
  };

  const gone = !feed.isLoading && feed.data && (!req || req.status !== "open");
  const reqLeft = req ? secondsLeft(req.expiresAt, now) : 0;
  const center = req?.pickup ?? pres.fix ?? DEFAULT_CENTER;

  return (
    <div className="relative h-full w-full bg-ink-900">
      <MapView center={center} zoom={13} padding={{ top: 110, bottom: 420, left: 30, right: 30 }}>
        {req && (
          <>
            <FitCamera points={pres.fix ? [...routePoints, pres.fix] : routePoints} padding={{ top: 120, bottom: 430, left: 40, right: 40 }} revision={`${id}:${routePoints.length}`} />
            <RouteLine points={routePoints} id="request-route" />
            <Marker position={req.pickup} anchor="bottom" zIndex={3}>
              <PinMarker kind="pickup" label="Pickup" />
            </Marker>
            <Marker position={req.dropoff} anchor="bottom" zIndex={3}>
              <PinMarker kind="dropoff" label="Drop-off" />
            </Marker>
          </>
        )}
        {pres.fix && (
          <Marker position={pres.fix} zIndex={5}>
            <CarMarker heading={pres.fix.heading} />
          </Marker>
        )}
      </MapView>

      <OfflineBanner className="!top-[calc(var(--safe-top)_+_68px)]" />
      <div className="absolute inset-x-0 top-0 px-4 flex items-center justify-between pointer-events-none" style={{ paddingTop: "calc(var(--safe-top) + 12px)" }}>
        <div className="pointer-events-auto">
          <BackButton fallback="/d/home" />
        </div>
        {req && (
          <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={spring} className="pointer-events-auto glass rounded-full pl-3 pr-1.5 py-1.5 flex items-center gap-2 shadow-card">
            <span className="text-[12.5px] text-ink-300">Expires in</span>
            <CountdownRing total={settings.requestTtlSeconds} left={reqLeft} size={34} stroke={3}>
              <span className="text-[9.5px] font-bold text-ink-50 tabular-nums">{formatCountdown(reqLeft)}</span>
            </CountdownRing>
          </motion.div>
        )}
      </div>

      {/* Panel */}
      <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={spring} className="absolute inset-x-0 bottom-0 glass rounded-t-[32px] shadow-float" style={{ paddingBottom: "calc(var(--safe-bottom) + 16px)" }}>
        <div className="flex justify-center pt-3">
          <div className="h-1.5 w-12 rounded-full bg-white/15" />
        </div>
        <div className="px-5 pt-2 max-h-[64vh] overflow-y-auto no-scrollbar">
          {feed.isLoading && !req ? (
            <div className="flex flex-col gap-4 pb-4">
              <div className="flex items-center gap-3">
                <Skeleton className="size-12 rounded-full" />
                <div className="flex-1 flex flex-col gap-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-8 w-24" />
              </div>
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-9 w-full rounded-full" />
              <Skeleton className="h-14 w-full rounded-2xl" />
            </div>
          ) : gone || !req || !feedItem ? (
            <EmptyState icon={Timer} title="This request is no longer available" body={feed.isError ? errorMessage(feed.error, "Can't reach Raahi right now.") : "The passenger may have found a driver, cancelled, or moved out of your area."} action={<Button size="md" onClick={() => navigate("/d/home", { replace: true })}>Back to requests</Button>} />
          ) : (
            <motion.div variants={stagger(0.06)} initial="hidden" animate="show" className="flex flex-col gap-4 pb-2">
              {/* Passenger + offer */}
              <motion.div variants={item.down} className="flex items-start gap-3">
                <Avatar name={req.customer.fullName} src={req.customer.avatarUrl} size={48} />
                <div className="flex-1 min-w-0">
                  <p className="font-display text-[17px] font-semibold text-ink-50 truncate">{req.customer.fullName}</p>
                  <p className="text-[12.5px] text-ink-400 flex items-center gap-1.5 mt-0.5">
                    <Star className="size-3 text-amber-300 fill-amber-300" />
                    <span className="tabular-nums">{req.customer.ratingCount > 0 ? `${req.customer.ratingAvg.toFixed(1)} (${req.customer.ratingCount})` : "New rider"}</span>
                    <span className="text-ink-600">·</span>
                    <Users className="size-3" /> {req.passengers}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-500">Offer</p>
                  <Money value={req.offeredFarePkr} className="text-[24px] font-bold text-amber-300 leading-none" />
                </div>
              </motion.div>

              {/* Route */}
              <motion.div variants={item.left} className="relative pl-5">
                <span className="absolute left-1.5 top-2 bottom-2 w-px bg-gradient-to-b from-brand-400 via-ink-500 to-amber-400" aria-hidden />
                <span className="absolute left-0 top-1 size-3.5 rounded-full border-[3px] border-brand-400 bg-ink-900" aria-hidden />
                <span className="absolute left-0 bottom-1 size-3.5 rounded-sm rotate-45 bg-amber-400" aria-hidden />
                <p className="text-[14px] text-ink-50 leading-snug">{req.pickup.address}</p>
                <p className="text-[12px] text-brand-300 font-medium mt-0.5">
                  {formatKm(feedItem.distanceToPickupKm)} · {formatDuration(feedItem.etaToPickupMin)} from you
                </p>
                <p className="text-[14px] text-ink-50 leading-snug mt-2">{req.dropoff.address}</p>
                <p className="text-[12px] text-ink-400 mt-0.5">
                  Trip {formatKm(req.distanceKm)} · {formatDuration(req.durationMin)} · fair price PKR {req.recommendedFarePkr.toLocaleString("en-PK")}
                </p>
              </motion.div>

              {req.note && (
                <motion.p variants={item.right} className="flex items-start gap-2 text-[13px] text-ink-200 bg-white/4 rounded-xl px-3 py-2 leading-snug">
                  <MessageSquare className="size-3.5 text-ink-400 shrink-0 mt-0.5" />
                  <span>{req.note}</span>
                </motion.p>
              )}

              {pending ? (
                <motion.div variants={item.up} className="flex items-center gap-3 rounded-3xl bg-brand-500/8 border border-brand-500/25 p-4">
                  <CountdownRing total={settings.bidTtlSeconds} left={secondsLeft(pending.expiresAt, now)} size={56}>
                    <span className="text-[12px] font-bold text-ink-50 tabular-nums">{formatCountdown(secondsLeft(pending.expiresAt, now))}</span>
                  </CountdownRing>
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-[16px] font-semibold text-ink-50">
                      Offer sent · <Money value={pending.amountPkr} className="text-brand-300" />
                    </p>
                    <p className="text-[12.5px] text-ink-400 leading-snug">Waiting for {req.customer.fullName.split(" ")[0]}. Withdraw to send a different price.</p>
                  </div>
                  <Button size="sm" variant="ghost" style={{ color: "#fb7185" }} loading={withdraw.isPending} onClick={() => withdraw.mutate(pending.id)}>
                    Withdraw
                  </Button>
                </motion.div>
              ) : (
                amount !== null &&
                eta !== null && (
                  <>
                    {/* Chips */}
                    <motion.div variants={item.right} className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">
                      {chips.map((c) => (
                        <Chip key={c.step} active={amount === c.value} onClick={() => setAmount(c.value)} className="shrink-0">
                          {c.step === 0 ? `Accept at PKR ${c.value.toLocaleString("en-PK")}` : `+${Math.round(c.step * 100)}% · ${c.value.toLocaleString("en-PK")}`}
                        </Chip>
                      ))}
                    </motion.div>

                    {/* Stepper + range */}
                    <motion.div variants={item.up} className="rounded-3xl bg-ink-800/70 border border-white/6 p-4 flex flex-col gap-3">
                      <Stepper label="Your price" money value={amount} onChange={setAmount} step={STEP_PKR} min={req.minFarePkr} max={req.maxFarePkr} />
                      <RangeTrack min={req.minFarePkr} max={req.maxFarePkr} value={amount} offer={req.offeredFarePkr} />
                      <div className="flex justify-between text-[11.5px] text-ink-500 tabular-nums">
                        <span>Min PKR {req.minFarePkr.toLocaleString("en-PK")}</span>
                        <span>Max PKR {req.maxFarePkr.toLocaleString("en-PK")}</span>
                      </div>
                    </motion.div>

                    {/* ETA */}
                    <motion.div variants={item.up} className="rounded-3xl bg-ink-800/70 border border-white/6 px-4 py-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[13px] font-semibold text-ink-200">I can reach the pickup in</p>
                        <p className="text-[12px] text-ink-500">Suggested {formatDuration(feedItem.etaToPickupMin)} by road</p>
                      </div>
                      <Stepper size="md" value={eta} onChange={setEta} step={1} min={1} max={120} format={(v) => `${v} min`} />
                    </motion.div>

                    {/* Economics */}
                    {eco && (
                      <motion.div variants={item.left} layout className={cn("rounded-3xl border p-4 grid grid-cols-3 gap-2", eco.belowBreakEven ? "bg-amber-400/8 border-amber-400/25" : "bg-brand-500/8 border-brand-500/20")}>
                        <div className="col-span-3 flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.12em] text-ink-400">
                          <Fuel className="size-3.5" /> Your economics
                        </div>
                        <Econ label="You keep" value={<Money value={Math.max(0, eco.netEarningPkr)} className={cn("text-[17px] font-bold", eco.belowBreakEven ? "text-amber-300" : "text-brand-300")} />} />
                        <Econ label="Per minute" value={<span className="text-[17px] font-display font-bold text-ink-50 tabular-nums">PKR {eco.earningPerMinutePkr.toFixed(1)}</span>} />
                        <Econ label="Fuel" value={<span className="text-[17px] font-display font-bold text-ink-50 tabular-nums">PKR {eco.fuelCostPkr.toLocaleString("en-PK")}</span>} />
                        <AnimatePresence initial={false}>
                          {eco.belowBreakEven && (
                            <motion.p key="warn" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="col-span-3 text-[12.5px] text-amber-300 leading-snug overflow-hidden">
                              After fuel this leaves less than PKR {feedItem.economics.driverFlatPkr} for your time. Consider a higher offer.
                            </motion.p>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    )}

                    <motion.div variants={item.up}>
                      <Input icon={MessageSquare} placeholder="Message to passenger (optional)" value={message} maxLength={120} onChange={(e) => setMessage(e.target.value)} error={error} />
                    </motion.div>

                    <motion.div variants={item.up} className="pt-1">
                      <Button full size="xl" variant={amount === req.offeredFarePkr ? "amber" : "primary"} icon={Send} loading={place.isPending} onClick={send}>
                        {amount === req.offeredFarePkr ? "Accept at" : "Send offer"} <Money value={amount} className="font-bold" />
                      </Button>
                    </motion.div>
                  </>
                )
              )}
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function Econ({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-ink-500 uppercase tracking-wide font-bold">{label}</p>
      <div className="mt-0.5 truncate">{value}</div>
    </div>
  );
}

/** Where the current price and the passenger's offer sit inside the allowed range. */
function RangeTrack({ min, max, value, offer }: { min: number; max: number; value: number; offer: number }) {
  const span = Math.max(1, max - min);
  const pct = (v: number) => `${((clamp(v, min, max) - min) / span) * 100}%`;
  return (
    <div className="relative h-3">
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-white/8" />
      <motion.div className="absolute left-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-gradient-to-r from-brand-600 to-brand-400" initial={false} animate={{ width: pct(value) }} transition={spring} />
      <span className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-2 rounded-full bg-amber-400 ring-2 ring-ink-900" style={{ left: pct(offer) }} aria-label="Passenger's offer" />
      <motion.span className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-4 rounded-full bg-brand-400 ring-[3px] ring-ink-900 shadow-glow" initial={false} animate={{ left: pct(value) }} transition={spring} />
    </div>
  );
}
