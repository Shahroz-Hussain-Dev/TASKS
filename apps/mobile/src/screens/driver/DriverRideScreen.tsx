import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ChatCircleDots, Crosshair, Flag, HandCoins, NavigationArrow, Siren, Star, X } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { decodePolyline, estimateDurationMin, estimateRoadKm, haversineKm, type LatLng, type RideDto, type RideStatus, type RouteQuote } from "@raahi/shared";
import { Breathe } from "@/components/driver/Breathe";
import { Confetti } from "@/components/driver/Confetti";
import { FitCamera } from "@/components/driver/FitCamera";
import { CarMarker, MapView, Marker, PinMarker, RouteLine, type MapHandle } from "@/components/Map";
import CancelSheet from "@/components/ride/CancelSheet";
import RatingSheet from "@/components/ride/RatingSheet";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import { isActiveRide } from "@/components/shared/meta";
import { Avatar, Button, IconButton, Money, Sheet, Skeleton, useToast } from "@/components/ui";
import { dk, RIDE_POLL_MS } from "@/hooks/driver/keys";
import { navigationUrl } from "@/hooks/driver/onboarding";
import { presence, useDriverPresence, useGpsHold } from "@/hooks/driver/presence";
import { qk } from "@/hooks/queryKeys";
import { api, ApiRequestError, request } from "@/lib/api";
import { DEFAULT_CENTER } from "@/lib/config";
import { item, spring, springBouncy, stagger } from "@/lib/motion";
import { haptic, isNative } from "@/lib/native";
import { cn, errorMessage, formatDuration, formatKm } from "@/lib/utils";

const POLICE = "15";
const RESCUE = "1122";
/** Driver position is rounded to ~100 m for the route-to-pickup query so GPS jitter doesn't refetch. */
const r3 = (n: number) => Math.round(n * 1e3) / 1e3;
/** The routing API refuses legs shorter than this (same floor as the server); draw a straight line instead of asking. */
const MIN_ROUTE_KM = 0.2;
/** "Navigate" is a sky jelly — the Button has no sky variant, so paint it inline. */
const SKY_JELLY = { background: "#3da9fc", color: "#ffffff", "--jelly-edge": "#2c90e0" } as CSSProperties;

function dial(number: string) {
  const url = `tel:${number}`;
  const w = window.open(url, "_system");
  if (!w) window.location.assign(url);
}

function openNavigation(to: LatLng, label: string) {
  haptic.light();
  const url = navigationUrl(to.lat, to.lng, label, isNative);
  if (isNative) {
    window.location.assign(url);
    return;
  }
  window.open(url, "_blank", "noopener");
}

interface StepMeta {
  headline: string;
  cta: string;
  /** I've arrived = sun, Start trip = teal, Complete trip = coral. */
  ctaVariant: "amber" | "teal" | "primary";
  navLabel: string;
  target: LatLng;
}

function stepFor(ride: RideDto): StepMeta | null {
  const first = ride.customer.fullName.trim().split(/\s+/)[0] ?? "the passenger";
  switch (ride.status) {
    case "assigned":
      return { headline: "Head to the pickup", cta: "I've arrived", ctaVariant: "amber", navLabel: "Navigate to pickup", target: ride.pickup };
    case "arrived":
      return { headline: `Waiting for ${first}`, cta: "Start trip", ctaVariant: "teal", navLabel: "Navigate to drop-off", target: ride.dropoff };
    case "in_progress":
      return { headline: "Heading to the destination", cta: "Complete trip", ctaVariant: "primary", navLabel: "Navigate", target: ride.dropoff };
    default:
      return null;
  }
}

/**
 * Live ride for the driver. The map shows the way to the pickup, then the
 * trip route; one morphing button walks through arrived → start → complete.
 * Completion celebrates the cash to collect, then asks for a passenger rating.
 */
export default function DriverRideScreen() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const pres = useDriverPresence();
  const mapRef = useRef<MapHandle>(null);
  const leaving = useRef(false);
  const [follow, setFollow] = useState(true);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [sosOpen, setSosOpen] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [ratingOpen, setRatingOpen] = useState(false);

  const query = useQuery({
    queryKey: qk.ride(id),
    queryFn: ({ signal }) => api.rides.get(id, signal),
    enabled: id.length > 0,
    refetchInterval: (q) => (q.state.data && !isActiveRide(q.state.data.status) ? false : RIDE_POLL_MS),
    refetchIntervalInBackground: false,
    retry: (count, err) => !(err instanceof ApiRequestError && (err.status === 404 || err.status === 403)) && count < 2,
  });
  const ride = query.data;
  const active = Boolean(ride && isActiveRide(ride.status));
  useGpsHold("ride", active);

  const step = ride ? stepFor(ride) : null;
  const toPickup = ride?.status === "assigned" || ride?.status === "arrived";

  /* ----------------------------- routing ------------------------------ */
  const from = useMemo<LatLng | null>(() => (pres.fix ? { lat: r3(pres.fix.lat), lng: r3(pres.fix.lng) } : null), [pres.fix]);
  const pickupRoute = useQuery({
    queryKey: from && ride ? dk.routeTo(from, ride.pickup) : ["geo", "route", "idle"],
    queryFn: () => request<RouteQuote>("/api/geo/route", { body: { pickup: from, dropoff: ride?.pickup } }),
    enabled: Boolean(from && ride && toPickup && haversineKm(from, ride.pickup) >= MIN_ROUTE_KM),
    staleTime: 60_000,
    retry: 1,
  });

  const tripPoints = useMemo<LatLng[]>(() => {
    if (!ride) return [];
    if (ride.routePolyline) {
      try {
        const pts = decodePolyline(ride.routePolyline);
        if (pts.length >= 2) return pts;
      } catch {
        /* straight line below */
      }
    }
    return [ride.pickup, ride.dropoff];
  }, [ride]);

  const approachPoints = useMemo<LatLng[]>(() => {
    if (!ride || !toPickup) return [];
    if (pickupRoute.data && pickupRoute.data.geometry.length >= 2) return pickupRoute.data.geometry;
    return pres.fix ? [pres.fix, ride.pickup] : [];
  }, [ride, toPickup, pickupRoute.data, pres.fix]);

  const sub = useMemo(() => {
    if (!ride) return "";
    if (ride.status === "assigned") {
      if (pickupRoute.data) return `${formatKm(pickupRoute.data.distanceKm)} · about ${formatDuration(pickupRoute.data.durationMin)}`;
      if (pres.fix) {
        const km = estimateRoadKm(pres.fix, ride.pickup);
        return `${formatKm(km)} · about ${formatDuration(estimateDurationMin(km))}`;
      }
      return ride.pickup.address;
    }
    if (ride.status === "arrived") return `Meet at ${ride.pickup.name ?? ride.pickup.address}`;
    if (ride.status === "in_progress") {
      const km = pres.fix ? estimateRoadKm(pres.fix, ride.dropoff) : ride.distanceKm;
      return `${ride.dropoff.name ?? ride.dropoff.address} · about ${formatDuration(estimateDurationMin(km))}`;
    }
    return "";
  }, [ride, pickupRoute.data, pres.fix]);

  /* ------------------------------ camera ------------------------------ */
  const framePoints = useMemo<LatLng[]>(() => {
    if (!ride) return [];
    const own = pres.fix ? [pres.fix] : [];
    return toPickup ? [...own, ride.pickup] : [ride.pickup, ride.dropoff, ...own];
    // Framing recomputes on status changes; GPS follow is handled separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ride?.status, ride?.id]);
  useEffect(() => {
    setFollow(true);
  }, [ride?.status]);

  const fixLat = pres.fix?.lat;
  const fixLng = pres.fix?.lng;
  useEffect(() => {
    if (!follow || fixLat === undefined || fixLng === undefined || !ride || !isActiveRide(ride.status)) return;
    const map = mapRef.current?.map;
    if (!map) return;
    const b = map.getBounds();
    if (!b.contains([fixLng, fixLat])) map.easeTo({ center: [fixLng, fixLat], duration: 900, essential: true });
  }, [follow, fixLat, fixLng, ride]);

  /* --------------------------- state effects --------------------------- */
  const leave = () => {
    if (leaving.current) return;
    leaving.current = true;
    presence.setActiveRide(null);
    void queryClient.invalidateQueries({ queryKey: dk.activeRide });
    void queryClient.invalidateQueries({ queryKey: dk.earnings });
    void queryClient.invalidateQueries({ queryKey: qk.rides });
    navigate("/d/home", { replace: true });
  };

  useEffect(() => {
    if (!ride || leaving.current) return;
    if (ride.status === "completed") {
      if (ride.myRating) leave();
      else {
        haptic.success();
        setCelebrate(true);
        import("@/lib/confetti")
          .then((m) => m.celebrate({ intensity: "big" }))
          .catch(() => {
            /* confetti is a delight, never a dependency */
          });
      }
    } else if (ride.status === "cancelled_by_customer") {
      toast({ title: "Passenger cancelled", body: "Sorry about that. You're back on the request feed.", tone: "neutral" });
      leave();
    } else if (ride.status === "cancelled_by_driver") {
      leave();
    }
    // Driven by status transitions only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ride?.status]);

  useEffect(() => {
    const err = query.error;
    if (err instanceof ApiRequestError && (err.status === 404 || err.status === 403)) {
      toast({ title: "Ride not found", body: "It may have been cancelled.", tone: "error" });
      leave();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.error]);

  /* ------------------------------ actions ------------------------------ */
  const advance = useMutation({
    mutationFn: (status: RideStatus) => (status === "assigned" ? api.rides.arrived(id) : status === "arrived" ? api.rides.start(id) : api.rides.complete(id)),
    onSuccess: (updated, status) => {
      haptic.success();
      queryClient.setQueryData(qk.ride(id), updated);
      presence.pingNow();
      if (status === "assigned") toast({ title: "Passenger notified", body: "They know you've arrived.", tone: "success" });
      if (status === "arrived") toast({ title: "Trip started", body: "Drive safe.", tone: "success" });
    },
    onError: (err) => toast({ title: "That didn't go through", body: errorMessage(err), tone: "error" }),
  });

  const cancel = useMutation({
    mutationFn: (input: { reason: string; details?: string }) => api.rides.cancel(id, input),
    onSuccess: (updated) => {
      queryClient.setQueryData(qk.ride(id), updated);
      setCancelOpen(false);
      toast({ title: "Trip cancelled", body: "You're back on the request feed.", tone: "neutral" });
    },
  });

  const center = pres.fix ?? ride?.pickup ?? DEFAULT_CENTER;
  const canCancel = ride?.status === "assigned" || ride?.status === "arrived";
  const statusTint = ride?.status === "in_progress" ? "bg-teal-100 text-teal-700" : ride?.status === "arrived" ? "bg-sun-100 text-sun-600" : "bg-sky-100 text-sky-600";

  return (
    <div className="relative h-full w-full bg-paper-50">
      <MapView ref={mapRef} center={center} zoom={14} padding={{ top: 110, bottom: 380, left: 30, right: 30 }} onMoveStart={() => setFollow(false)}>
        {ride && (
          <>
            <FitCamera points={framePoints} padding={{ top: 120, bottom: 380, left: 40, right: 40 }} revision={`${ride.id}:${ride.status}`} />
            {toPickup && approachPoints.length >= 2 && <RouteLine points={approachPoints} id="approach" color="#3da9fc" width={4} />}
            {tripPoints.length >= 2 && <RouteLine points={tripPoints} id="trip" animated={ride.status === "in_progress"} color={ride.status === "in_progress" ? "#12a594" : "#cfc9d9"} width={ride.status === "in_progress" ? 5 : 3} />}
            <Marker position={ride.pickup} anchor="bottom" zIndex={3}>
              <PinMarker kind="pickup" label={ride.status === "in_progress" ? undefined : "Pickup"} />
            </Marker>
            <Marker position={ride.dropoff} anchor="bottom" zIndex={3}>
              <PinMarker kind="dropoff" label="Drop-off" />
            </Marker>
          </>
        )}
        {pres.fix && (
          <Marker position={pres.fix} zIndex={5}>
            <CarMarker heading={pres.fix.heading} category={ride?.category ?? "car"} pulse />
          </Marker>
        )}
      </MapView>

      <OfflineBanner className="!top-[calc(var(--safe-top)_+_76px)]" />

      {/* Top chrome */}
      <div className="absolute inset-x-0 top-0 px-4 flex items-start justify-between pointer-events-none" style={{ paddingTop: "calc(var(--safe-top) + 12px)" }}>
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="pointer-events-auto glass rounded-[22px] px-3.5 py-2 max-w-[70%]">
          <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-[0.14em]", statusTint)}>{ride?.status === "in_progress" ? "Trip in progress" : ride?.status === "arrived" ? "At pickup" : "Pickup"}</span>
          <p className="text-[14px] font-bold text-ink-900 truncate mt-1">{ride ? (toPickup ? ride.pickup.address : ride.dropoff.address) : "…"}</p>
        </motion.div>
        <div className="pointer-events-auto flex flex-col gap-2">
          <IconButton icon={Siren} label="Emergency" variant="solid" className="text-rose-500" onClick={() => setSosOpen(true)} />
          <AnimatePresence>
            {!follow && pres.fix && (
              <motion.div key="rc" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }} transition={spring}>
                <IconButton
                  icon={Crosshair}
                  label="Recenter"
                  variant="solid"
                  className="text-teal-600"
                  onClick={() => {
                    haptic.tick();
                    setFollow(true);
                    if (pres.fix) mapRef.current?.flyTo(pres.fix, 15.5);
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Panel */}
      <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={spring} className="absolute inset-x-0 bottom-0 bg-paper-50 rounded-t-[32px] shadow-float px-5 pt-4" style={{ paddingBottom: "calc(var(--safe-bottom) + 16px)" }}>
        {!ride ? (
          <div className="flex flex-col gap-3 pb-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
            <div className="flex items-center gap-3 mt-2">
              <Skeleton className="size-12 rounded-full" />
              <div className="flex-1 flex flex-col gap-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <Skeleton className="h-14 w-full rounded-2xl mt-2" />
          </div>
        ) : (
          <motion.div variants={stagger(0.06)} initial="hidden" animate="show" className="flex flex-col gap-4">
            <motion.div variants={item.down} className="min-h-12">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={ride.status} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={spring}>
                  <h1 className="font-display text-[24px] font-semibold text-ink-900 leading-tight">{step?.headline ?? "Trip completed"}</h1>
                  <p className="text-[13.5px] font-semibold text-ink-500 mt-0.5 truncate">{sub}</p>
                </motion.div>
              </AnimatePresence>
            </motion.div>

            {/* Passenger + fare */}
            <motion.div variants={item.left} className="flex items-center gap-3 pillow p-3">
              <Avatar name={ride.customer.fullName} src={ride.customer.avatarUrl} size={48} />
              <div className="flex-1 min-w-0">
                <p className="font-display font-semibold text-[16px] text-ink-900 truncate">{ride.customer.fullName}</p>
                <p className="text-[12.5px] font-semibold text-ink-500 flex items-center gap-1 tabular-nums">
                  <Star className="size-3.5 text-sun-500" weight="fill" />
                  {ride.customer.ratingCount > 0 ? `${ride.customer.ratingAvg.toFixed(1)} (${ride.customer.ratingCount})` : "New rider"}
                  <span className="text-ink-300 mx-1">·</span>
                  {formatKm(ride.distanceKm)} · {formatDuration(ride.durationMin)}
                </p>
              </div>
              <div className="text-right mr-1 flex flex-col items-end">
                <span className="inline-flex rounded-full bg-sun-100 px-2.5 py-0.5">
                  <Money value={ride.farePkr} className="text-[17px] text-ink-900 leading-none" />
                </span>
                <p className="text-[10.5px] text-ink-400 mt-1 uppercase tracking-wide font-extrabold">Cash</p>
              </div>
              <div className="relative">
                <IconButton icon={ChatCircleDots} label="Chat with passenger" variant="teal" size={44} onClick={() => navigate(`/rides/${ride.id}/chat`)} />
                {ride.unreadMessages > 0 && <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-sun-500 text-ink-900 text-[10px] font-extrabold flex items-center justify-center tabular-nums ring-2 ring-white">{ride.unreadMessages > 9 ? "9+" : ride.unreadMessages}</span>}
              </div>
            </motion.div>

            {/* CTA */}
            {step && (
              <motion.div variants={item.up} className="flex flex-col gap-2">
                <div className="grid grid-cols-[auto_1fr] gap-2">
                  <Button variant="outline" size="xl" icon={NavigationArrow} style={SKY_JELLY} onClick={() => openNavigation(step.target, toPickup ? "Pickup" : "Drop-off")} aria-label={step.navLabel}>
                    Navigate
                  </Button>
                  <Breathe tone={step.ctaVariant === "amber" ? "sun" : step.ctaVariant === "teal" ? "teal" : "coral"}>
                    <Button full size="xl" variant={step.ctaVariant} icon={ride.status === "in_progress" ? Flag : undefined} loading={advance.isPending} onClick={() => advance.mutate(ride.status)}>
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.span key={step.cta} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={spring} className="inline-block">
                          {step.cta}
                        </motion.span>
                      </AnimatePresence>
                    </Button>
                  </Breathe>
                </div>
                {canCancel && (
                  <Button variant="ghost" size="md" icon={X} className="text-ink-500" onClick={() => setCancelOpen(true)}>
                    Cancel trip
                  </Button>
                )}
              </motion.div>
            )}
          </motion.div>
        )}
      </motion.div>

      {/* Completion celebration */}
      <AnimatePresence>
        {celebrate && ride && (
          <motion.div key="celebrate" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 bg-paper-50/97 flex flex-col items-center justify-center px-6 text-center overflow-hidden">
            <span aria-hidden className="blob bg-sun-100 w-80 h-80 -top-16 -right-24" />
            <span aria-hidden className="blob bg-teal-100 w-64 h-64 -bottom-12 -left-16" style={{ animationDelay: "-6s" }} />
            <Confetti count={90} seed={7} />
            <motion.div variants={stagger(0.1, 0.15)} initial="hidden" animate="show" className="relative w-full flex flex-col items-center gap-4">
              <motion.div variants={item.scale} className="relative w-full">
                <span aria-hidden className="blob bg-sun-100 w-56 h-56 left-1/2 -translate-x-1/2 -top-10" />
                <div className="sticker sticker-tilt-l bg-white p-6 flex flex-col items-center gap-3">
                  <motion.span initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={springBouncy} className="size-20 rounded-[28px] bg-sun-500 text-ink-900 flex items-center justify-center shadow-pillow">
                    <HandCoins className="size-10" weight="duotone" />
                  </motion.span>
                  <p className="text-[12px] font-extrabold uppercase tracking-[0.18em] text-teal-600">Trip completed</p>
                  <h2 className="font-display text-[32px] font-semibold text-ink-900 leading-tight">
                    Collect <Money value={ride.farePkr} className="text-coral-500!" /> in cash
                  </h2>
                  <p className="text-[14.5px] font-semibold text-ink-500 leading-relaxed">
                    from {ride.customer.fullName.split(" ")[0]}. {formatKm(ride.distanceKm)} · {formatDuration(ride.durationMin)}. Every rupee is yours.
                  </p>
                </div>
              </motion.div>
              <motion.div variants={item.up} className="w-full pt-2">
                <Breathe tone="sun">
                  <Button
                    full
                    size="xl"
                    variant="amber"
                    onClick={() => {
                      haptic.medium();
                      setCelebrate(false);
                      setRatingOpen(true);
                    }}
                  >
                    Cash collected · rate passenger
                  </Button>
                </Breathe>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <RatingSheet
        open={ratingOpen}
        ride={ride ?? null}
        perspective="driver"
        onClose={() => {
          setRatingOpen(false);
          leave();
        }}
        onRated={(updated) => queryClient.setQueryData(qk.ride(id), updated)}
      />

      <CancelSheet open={cancelOpen} onClose={() => setCancelOpen(false)} perspective="driver" onConfirm={(reason, details) => cancel.mutateAsync({ reason, details }).then(() => undefined)} />

      <Sheet open={sosOpen} onClose={() => setSosOpen(false)} title="Emergency">
        <div className="flex flex-col gap-2 pb-2">
          <p className="text-[14px] font-semibold text-ink-600 leading-relaxed">If you're in danger, call the authorities first. Your trip details stay on record with Raahi.</p>
          <Button full variant="danger" size="xl" icon={Siren} onClick={() => dial(POLICE)}>
            Call Police · {POLICE}
          </Button>
          <Button full variant="secondary" size="lg" onClick={() => dial(RESCUE)}>
            Call Rescue · {RESCUE}
          </Button>
          <Button full variant="ghost" onClick={() => setSosOpen(false)} className={cn("text-ink-500")}>
            Close
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
