import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Hourglass, TrendUp, Users, X } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MARKET_RULES, VEHICLE_CATEGORY_META, decodePolyline, type BidDto, type LatLng, type RideRequestDto } from "@raahi/shared";
import { AnimatedCarMarker } from "@/components/customer/AnimatedCarMarker";
import { BidCard } from "@/components/customer/BidCard";
import { CategoryIcon } from "@/components/customer/CategoryIcon";
import { CATEGORY_TONE } from "@/components/customer/categoryTone";
import { FitCamera } from "@/components/customer/FitCamera";
import { RadarSearch } from "@/components/Illustrations";
import { MapView, Marker, PinMarker, RouteLine } from "@/components/Map";
import { BackButton } from "@/components/shared/BackButton";
import { ConfirmSheet } from "@/components/shared/ConfirmSheet";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import { Button, Money, useToast } from "@/components/ui";
import { ck } from "@/hooks/customer/keys";
import "@/hooks/customer/mapRuntime";
import { useElementHeight } from "@/hooks/customer/useElementHeight";
import { formatCountdown, useNow } from "@/hooks/customer/useNow";
import { qk } from "@/hooks/queryKeys";
import { api, ApiRequestError } from "@/lib/api";
import { item, spring, springBouncy, stagger } from "@/lib/motion";
import { haptic, localNotify } from "@/lib/native";
import { cn, errorMessage, pkr, secondsLeft } from "@/lib/utils";

const POLL_MS = 2_500;

/**
 * Waiting room for offers. Polls the request every 2.5 s, shows a radar
 * while nothing has arrived, then stacks bid cards (newest first) that slide
 * in from the right with their own expiry rings.
 */
export default function BiddingScreen() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const panelRef = useRef<HTMLDivElement>(null);
  const panelHeight = useElementHeight(panelRef, 360);
  const now = useNow(1000);
  const leaving = useRef(false);
  const [declined, setDeclined] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  const config = useQuery({ queryKey: qk.config, queryFn: () => api.config(), staleTime: 10 * 60_000 });
  const bidTtl = config.data?.settings.bidTtlSeconds ?? MARKET_RULES.bidTtlSeconds;
  const requestTtl = config.data?.settings.requestTtlSeconds ?? MARKET_RULES.requestTtlSeconds;

  const query = useQuery({
    queryKey: ck.request(id),
    queryFn: ({ signal }) => api.requests.get(id, signal),
    enabled: id.length > 0,
    refetchInterval: (q) => (q.state.data && q.state.data.status !== "open" ? false : POLL_MS),
    refetchIntervalInBackground: false,
    retry: (count, err) => !(err instanceof ApiRequestError && (err.status === 404 || err.status === 403)) && count < 2,
  });
  const request = query.data;

  /* ----------------------- lifecycle transitions ----------------------- */
  const leave = (to: string) => {
    if (leaving.current) return;
    leaving.current = true;
    void queryClient.invalidateQueries({ queryKey: ck.activeTrip });
    navigate(to, { replace: true });
  };

  useEffect(() => {
    if (!request || leaving.current) return;
    if (request.status === "accepted" && request.rideId) {
      haptic.success();
      leave(`/c/ride/${request.rideId}`);
    } else if (request.status === "expired") {
      toast({ title: "No driver accepted in time", body: "Try a higher offer or another ride category.", tone: "neutral" });
      leave("/c/home");
    } else if (request.status === "cancelled") {
      toast({ title: "Request cancelled", body: "You can plan a new ride whenever you're ready.", tone: "neutral" });
      leave("/c/home");
    }
    // Only status changes should drive navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.status, request?.rideId]);

  useEffect(() => {
    const err = query.error;
    if (err instanceof ApiRequestError && (err.status === 404 || err.status === 403)) {
      toast({ title: "Request not found", body: "It may have been cancelled or expired.", tone: "error" });
      leave("/c/home");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.error]);

  /* --------------------------- bids to show --------------------------- */
  const visibleBids = useMemo<BidDto[]>(() => {
    const bids = request?.bids ?? [];
    return bids
      .filter((b) => b.status === "pending" && !declined.has(b.id) && new Date(b.expiresAt).getTime() > now)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [request?.bids, declined, now]);

  // Buzz when a new offer lands; notify when the app is in the background.
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    const bids = request?.bids ?? [];
    if (seen.current === null) {
      seen.current = new Set(bids.map((b) => b.id));
      return;
    }
    const fresh = bids.filter((b) => !seen.current?.has(b.id) && b.status === "pending");
    for (const b of bids) seen.current.add(b.id);
    if (fresh.length === 0) return;
    haptic.medium();
    if (document.hidden) {
      const b = fresh[0];
      if (b) void localNotify("New offer on Raahi", `${b.driver.fullName} offered ${pkr(b.amountPkr)} · ${b.etaMin} min away`);
    }
  }, [request?.bids]);

  /* ------------------------------ actions ------------------------------ */
  const accept = useMutation({
    mutationFn: (bidId: string) => api.requests.accept(id, bidId),
    onMutate: (bidId) => setAcceptingId(bidId),
    onSuccess: (ride) => {
      haptic.success();
      queryClient.setQueryData(qk.ride(ride.id), ride);
      toast({ title: "Driver confirmed", body: `${ride.driver.fullName} is on the way.`, tone: "success" });
      leave(`/c/ride/${ride.id}`);
    },
    onError: (err, bidId) => {
      haptic.error();
      toast({ title: "Couldn't accept this offer", body: errorMessage(err), tone: "error" });
      if (err instanceof ApiRequestError && (err.status === 409 || err.status === 410)) setDeclined((s) => new Set([...s, bidId]));
      void query.refetch();
    },
    onSettled: () => setAcceptingId(null),
  });

  const raise = useMutation({
    mutationFn: (amount: number) => api.requests.updateOffer(id, amount),
    onSuccess: (req) => {
      haptic.success();
      queryClient.setQueryData<RideRequestDto>(ck.request(id), req);
      toast({ title: `Offer raised to ${pkr(req.offeredFarePkr)}`, body: "Nearby drivers can see your new price.", tone: "success" });
    },
    onError: (err) => toast({ title: "Couldn't raise your offer", body: errorMessage(err), tone: "error" }),
  });

  const cancel = useMutation({
    mutationFn: () => api.requests.cancel(id, "Changed my plans"),
    onSuccess: (req) => {
      queryClient.setQueryData<RideRequestDto>(ck.request(id), req);
      setCancelOpen(false);
      toast({ title: "Request cancelled", tone: "neutral" });
      leave("/c/home");
    },
  });

  const decline = (bid: BidDto) => {
    haptic.tick();
    setDeclined((s) => new Set([...s, bid.id]));
  };

  /* ------------------------------- map -------------------------------- */
  const routePoints = useMemo<LatLng[]>(() => {
    if (!request) return [];
    if (request.routePolyline) {
      try {
        const d = decodePolyline(request.routePolyline);
        if (d.length >= 2) return d;
      } catch {
        /* straight line below */
      }
    }
    return [request.pickup, request.dropoff];
  }, [request]);

  const cameraPoints = useMemo<LatLng[]>(() => {
    const pts = [...routePoints];
    for (const b of visibleBids) if (b.driverLocation) pts.push(b.driverLocation);
    return pts;
  }, [routePoints, visibleBids]);

  /** Cheapest visible offer — shown as the "best offer" sticker when there is a choice. */
  const bestBidId = useMemo(() => visibleBids.reduce<BidDto | null>((best, b) => (best === null || b.amountPkr < best.amountPkr ? b : best), null)?.id ?? null, [visibleBids]);

  const left = request ? secondsLeft(request.expiresAt, now) : 0;
  const ttlFraction = request ? Math.min(1, left / Math.max(1, requestTtl)) : 1;
  const atMax = request ? request.offeredFarePkr >= request.maxFarePkr : true;
  const meta = request ? VEHICLE_CATEGORY_META[request.category] : null;

  return (
    <div className="relative h-full w-full bg-paper-50">
      <MapView center={request?.pickup} zoom={13}>
        {request && (
          <>
            <RouteLine points={routePoints} id="request-route" />
            <Marker position={request.pickup} anchor="bottom" zIndex={2}>
              <PinMarker kind="pickup" />
            </Marker>
            <Marker position={request.dropoff} anchor="bottom" zIndex={2}>
              <PinMarker kind="dropoff" label={request.dropoff.name ?? undefined} />
            </Marker>
            {visibleBids.map((b) => b.driverLocation && <AnimatedCarMarker key={b.driver.id} position={b.driverLocation} category={b.driver.vehicle?.category ?? request.category} pulse />)}
            <FitCamera points={cameraPoints} bottom={panelHeight} fitKey={visibleBids.length} follow={false} />
          </>
        )}
      </MapView>

      <OfflineBanner />

      {/* Top chrome */}
      <motion.div variants={stagger(0.08)} initial="hidden" animate="show" className="absolute inset-x-0 top-0 pointer-events-none flex items-start justify-between px-4" style={{ paddingTop: "calc(var(--safe-top) + 12px)" }}>
        <motion.div variants={item.down} className="pointer-events-auto">
          <BackButton fallback="/c/home" />
        </motion.div>
        {request && meta && (
          <motion.div variants={item.down} className="pointer-events-auto pillow rounded-full h-11 pl-1.5 pr-4 flex items-center gap-2 text-[13.5px] font-extrabold text-ink-900">
            <span className={cn("size-8 rounded-full flex items-center justify-center", CATEGORY_TONE[request.category].tint)}>
              <CategoryIcon category={request.category} className="size-[18px]" />
            </span>
            {meta.label}
            <span className="text-ink-300">·</span>
            <Users className="size-[18px] text-lavender-500" weight="duotone" />
            {request.passengers}
          </motion.div>
        )}
      </motion.div>

      {/* Bottom panel */}
      <div ref={panelRef} className="absolute inset-x-0 bottom-0 z-10 flex flex-col max-h-[66%]">
        <motion.div initial={{ y: 90, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={spring} className="glass rounded-t-[32px] shadow-float flex flex-col min-h-0">
          <div className="flex justify-center pt-3">
            <span className="h-1.5 w-12 rounded-full bg-paper-300" />
          </div>

          <motion.div variants={stagger(0.07, 0.1)} initial="hidden" animate="show" className="flex flex-col min-h-0">
            <motion.header variants={item.down} className="px-5 pt-3 pb-2 flex items-end justify-between gap-3">
              <div>
                <p className="text-[11.5px] font-extrabold uppercase tracking-[0.16em] text-ink-400">Your offer</p>
                {request ? <Money value={request.offeredFarePkr} className="text-[32px] text-coral-600 leading-none" /> : <span className="block h-8 w-28 rounded-lg shimmer bg-paper-200" />}
              </div>
              <div className="text-right">
                <p className="text-[11.5px] font-extrabold uppercase tracking-[0.16em] text-ink-400">Expires in</p>
                <p className={cn("font-display text-[22px] font-semibold tabular-nums leading-none mt-0.5", left <= 60 ? "text-rose-500" : left <= 180 ? "text-sun-600" : "text-ink-900")}>{request ? (left > 0 ? formatCountdown(left) : "Wrapping up…") : "—:——"}</p>
              </div>
            </motion.header>

            <motion.div variants={item.fade} className="mx-5 h-1.5 rounded-full bg-paper-200 overflow-hidden">
              <motion.div className={cn("h-full rounded-full", left <= 60 ? "bg-rose-500" : left <= 180 ? "bg-sun-500" : "bg-teal-500")} animate={{ width: `${ttlFraction * 100}%` }} transition={{ duration: 1, ease: "linear" }} />
            </motion.div>

            <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-4 pt-3 pb-3">
              <AnimatePresence mode="wait" initial={false}>
                {!request ? (
                  <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-3 py-2">
                    {[0, 1].map((i) => (
                      <div key={i} className="pillow p-4 flex gap-3">
                        <span className="size-12 rounded-full shimmer bg-paper-200" />
                        <div className="flex-1 flex flex-col gap-2 pt-1">
                          <span className="h-3.5 w-1/2 rounded shimmer bg-paper-200" />
                          <span className="h-3 w-2/3 rounded shimmer bg-paper-200" />
                        </div>
                      </div>
                    ))}
                  </motion.div>
                ) : visibleBids.length === 0 ? (
                  <motion.div key="radar" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={spring} className="relative flex flex-col items-center text-center gap-2 py-2">
                    <span aria-hidden className="blob bg-coral-100 w-56 h-44 top-0 left-1/2 -translate-x-1/2 opacity-70" />
                    <RadarSearch size={168} className="relative" />
                    <p className="relative font-display text-[19px] font-semibold text-ink-900 -mt-2">Sending your offer to nearby drivers…</p>
                    <p className="relative text-[13.5px] text-ink-500 leading-relaxed max-w-[30ch] font-medium">Drivers within {MARKET_RULES.matchRadiusKm} km can accept your price or send a counter-offer.</p>
                    {query.isError && <p className="relative text-[12.5px] text-sun-600 mt-1 font-bold">Reconnecting… we'll keep checking for offers.</p>}
                  </motion.div>
                ) : (
                  <motion.ul key="bids" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-3.5 pt-3">
                    <AnimatePresence initial={false} mode="popLayout">
                      {visibleBids.map((b) => (
                        <BidCard key={b.id} bid={b} offeredFarePkr={request.offeredFarePkr} bidTtlSeconds={bidTtl} highlight={visibleBids.length > 1 && b.id === bestBidId} accepting={acceptingId === b.id} disabled={acceptingId !== null && acceptingId !== b.id} onAccept={() => accept.mutate(b.id)} onDecline={() => decline(b)} />
                      ))}
                    </AnimatePresence>
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>

            <motion.footer variants={item.up} className="px-4 pt-3 border-t border-paper-200 flex flex-col gap-2.5" style={{ paddingBottom: "calc(var(--safe-bottom) + 14px)" }}>
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                <span className="inline-flex items-center gap-1.5 text-[12.5px] font-extrabold text-ink-600 shrink-0">
                  <TrendUp className="size-[18px] text-sun-600" weight="duotone" />
                  Raise your fare
                </span>
                {MARKET_RULES.raiseChipsPkr.map((delta) => {
                  const next = (request?.offeredFarePkr ?? 0) + delta;
                  const blocked = !request || next > request.maxFarePkr;
                  return (
                    <motion.div key={delta} whileTap={blocked ? undefined : { scale: 0.94 }} transition={springBouncy}>
                      <Button size="sm" variant="amber" disabled={blocked || raise.isPending} loading={raise.isPending && raise.variables === next} onClick={() => raise.mutate(next)} className="shrink-0">
                        +{delta}
                      </Button>
                    </motion.div>
                  );
                })}
                <AnimatePresence>
                  {atMax && request && (
                    <motion.span key="max" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="text-[11.5px] text-ink-400 shrink-0 font-bold">
                      Max {pkr(request.maxFarePkr)}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              <Button full size="md" variant="ghost" icon={X} disabled={!request} className="text-rose-500" onClick={() => setCancelOpen(true)}>
                Cancel request
              </Button>
            </motion.footer>
          </motion.div>
        </motion.div>
      </div>

      <ConfirmSheet open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel your request?" icon={Hourglass} body={visibleBids.length > 0 ? `${visibleBids.length} ${visibleBids.length === 1 ? "driver has" : "drivers have"} already made an offer. They'll be told you cancelled.` : "Drivers nearby will stop seeing your request. You can post a new one at any time."} confirmLabel="Yes, cancel" cancelLabel="Keep waiting" onConfirm={() => cancel.mutateAsync().then(() => undefined)} />
    </div>
  );
}
