import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { GpsFix, Money as MoneyIcon, Phone, ShareNetwork, ShieldWarning, Star, X } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MARKET_RULES, decodePolyline, estimateDurationMin, estimateRoadKm, type DriverPublicDto, type LatLng, type RideDto, type RideStatus } from "@raahi/shared";
import { AnimatedCarMarker } from "@/components/customer/AnimatedCarMarker";
import { DriverCard } from "@/components/customer/DriverCard";
import { FitCamera } from "@/components/customer/FitCamera";
import { MapView, Marker, PinMarker, RouteLine } from "@/components/Map";
import CancelSheet from "@/components/ride/CancelSheet";
import RatingSheet from "@/components/ride/RatingSheet";
import { BackButton } from "@/components/shared/BackButton";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import { RIDE_STATUS_META, isActiveRide, vehicleLine } from "@/components/shared/meta";
import { Button, IconButton, Money, Sheet, useToast } from "@/components/ui";
import { ck } from "@/hooks/customer/keys";
import "@/hooks/customer/mapRuntime";
import { useElementHeight } from "@/hooks/customer/useElementHeight";
import { useNow } from "@/hooks/customer/useNow";
import { qk } from "@/hooks/queryKeys";
import { api, ApiRequestError } from "@/lib/api";
import { item, spring, springBouncy, stagger } from "@/lib/motion";
import { haptic } from "@/lib/native";
import { cn, errorMessage, formatDuration, formatKm, pkr } from "@/lib/utils";

const POLL_MS = 3_000;
/** Frosted cream, a touch more opaque than `.glass` so map labels never fight the cards. */
const PANEL_BG = "rgb(255 251 245 / 0.94)";
/** How often the camera re-frames the driver while the ride is live. */
const FOLLOW_MS = 25_000;
const POLICE = "15";
const RESCUE = "1122";

type DriverWithPhone = DriverPublicDto & { phone?: string | null };

/** Status pill: label + colour that morphs as the ride progresses (sky → sun → teal → mint). */
const STATUS_PILL: Partial<Record<RideStatus, { label: string; bg: string; fg: string }>> = {
  assigned: { label: "Driver coming", bg: "#3da9fc", fg: "#ffffff" },
  arrived: { label: "At pickup", bg: "#ffc53d", fg: "#1f1b2d" },
  in_progress: { label: "On trip", bg: "#12a594", fg: "#ffffff" },
  completed: { label: "Trip done", bg: "#2fbf71", fg: "#ffffff" },
};

/** Opens the dialler. `window.open` is intercepted by the native shell; the location fallback covers browsers that block it. */
function dial(number: string) {
  const url = `tel:${number}`;
  const w = window.open(url, "_system");
  if (!w) window.location.assign(url);
}

function describe(ride: RideDto, now: number): { headline: string; sub: string; stale: boolean } {
  const drv = ride.driverLocation;
  const stale = !!drv && now - new Date(drv.updatedAt).getTime() > MARKET_RULES.driverStaleSeconds * 1000;
  const first = ride.driver.fullName.trim().split(/\s+/)[0] ?? "Your driver";
  switch (ride.status) {
    case "assigned": {
      if (!drv) return { headline: "Driver is on the way", sub: "Waiting for the driver's location…", stale };
      const km = estimateRoadKm(drv, ride.pickup);
      return { headline: `${first} is on the way`, sub: `About ${estimateDurationMin(km)} min away · ${formatKm(km)}`, stale };
    }
    case "arrived":
      return { headline: `${first} has arrived`, sub: `Meet at ${ride.pickup.name ?? ride.pickup.address}`, stale };
    case "in_progress": {
      const km = drv ? estimateRoadKm(drv, ride.dropoff) : null;
      const eta = km !== null ? estimateDurationMin(km) : ride.durationMin;
      return { headline: "Heading to your destination", sub: `${ride.dropoff.name ?? ride.dropoff.address} · about ${formatDuration(eta)}`, stale };
    }
    case "completed":
      return { headline: "You've arrived", sub: `Pay ${pkr(ride.farePkr)} in cash to ${first}`, stale: false };
    default:
      return { headline: RIDE_STATUS_META[ride.status].headline, sub: ride.cancelReason ?? "", stale: false };
  }
}

/**
 * Live ride for the passenger: the car glides across the map, the headline
 * morphs with each status, and the driver card keeps call/chat one tap away.
 * Completion opens the rating sheet; cancellation sends the person home.
 */
export default function RideScreen() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const now = useNow(5_000);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelHeight = useElementHeight(panelRef, 340);
  const leaving = useRef(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [sosOpen, setSosOpen] = useState(false);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [followTick, setFollowTick] = useState(0);

  const query = useQuery({
    queryKey: qk.ride(id),
    queryFn: ({ signal }) => api.rides.get(id, signal),
    enabled: id.length > 0,
    refetchInterval: (q) => (q.state.data && !isActiveRide(q.state.data.status) ? false : POLL_MS),
    refetchIntervalInBackground: false,
    retry: (count, err) => !(err instanceof ApiRequestError && (err.status === 404 || err.status === 403)) && count < 2,
  });
  const ride = query.data;
  const active = !!ride && isActiveRide(ride.status);

  const goHome = () => {
    if (leaving.current) return;
    leaving.current = true;
    void queryClient.invalidateQueries({ queryKey: ck.activeTrip });
    void queryClient.invalidateQueries({ queryKey: qk.rides });
    navigate("/c/home", { replace: true });
  };

  /* --------------------------- status effects --------------------------- */
  useEffect(() => {
    if (!ride || leaving.current) return;
    if (ride.status === "completed") {
      void queryClient.invalidateQueries({ queryKey: ck.activeTrip });
      void queryClient.invalidateQueries({ queryKey: qk.rides });
      if (!ride.myRating) {
        haptic.success();
        setRatingOpen(true);
      }
    } else if (ride.status === "cancelled_by_driver" || ride.status === "cancelled_by_customer") {
      toast({
        title: ride.status === "cancelled_by_driver" ? "Your driver cancelled" : "Ride cancelled",
        body: ride.status === "cancelled_by_driver" ? "Sorry about that. You can request a new ride straight away." : "Hope to see you again soon.",
        tone: "neutral",
      });
      goHome();
    }
    // Navigation is driven by status transitions only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ride?.status]);

  useEffect(() => {
    const err = query.error;
    if (err instanceof ApiRequestError && (err.status === 404 || err.status === 403)) {
      toast({ title: "Ride not found", body: "It may have been cancelled.", tone: "error" });
      goHome();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.error]);

  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => setFollowTick((n) => n + 1), FOLLOW_MS);
    return () => window.clearInterval(t);
  }, [active]);

  /* ------------------------------ actions ------------------------------ */
  const cancel = useMutation({
    mutationFn: (input: { reason: string; details?: string }) => api.rides.cancel(id, input),
    onSuccess: (updated) => {
      queryClient.setQueryData(qk.ride(id), updated);
      setCancelOpen(false);
    },
  });

  const share = async () => {
    if (!ride) return;
    haptic.light();
    const link = `https://www.google.com/maps/dir/?api=1&origin=${ride.pickup.lat},${ride.pickup.lng}&destination=${ride.dropoff.lat},${ride.dropoff.lng}`;
    const vehicle = vehicleLine(ride.driver.vehicle);
    const text = [`I'm on a Raahi ride with ${ride.driver.fullName}${vehicle ? ` (${vehicle})` : ""}.`, `From ${ride.pickup.address}`, `To ${ride.dropoff.address}`, `Fare ${pkr(ride.farePkr)} · cash`, `Route: ${link}`].join("\n");
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "My Raahi trip", text });
        return;
      }
      await navigator.clipboard.writeText(text);
      toast({ title: "Trip details copied", body: "Paste them into any chat to share your ride.", tone: "success" });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      toast({ title: "Couldn't share", body: errorMessage(err), tone: "error" });
    }
  };

  /* -------------------------------- map -------------------------------- */
  const routePoints = useMemo<LatLng[]>(() => {
    if (!ride) return [];
    if (ride.routePolyline) {
      try {
        const d = decodePolyline(ride.routePolyline);
        if (d.length >= 2) return d;
      } catch {
        /* straight line below */
      }
    }
    return [ride.pickup, ride.dropoff];
  }, [ride]);

  const cameraPoints = useMemo<LatLng[]>(() => {
    if (!ride) return [];
    const drv = ride.driverLocation;
    if (!drv || !isActiveRide(ride.status)) return [ride.pickup, ride.dropoff];
    return ride.status === "in_progress" ? [drv, ride.dropoff] : [drv, ride.pickup];
  }, [ride]);

  const info = ride ? describe(ride, now) : null;
  const phone = (ride?.driver as DriverWithPhone | undefined)?.phone ?? null;
  const canCancel = !!ride && (ride.status === "assigned" || ride.status === "arrived");

  return (
    <div className="relative h-full w-full bg-paper-50">
      <MapView center={ride?.pickup} zoom={14}>
        {ride && (
          <>
            <RouteLine points={routePoints} id="ride-route" animated={ride.status === "in_progress"} />
            <Marker position={ride.pickup} anchor="bottom" zIndex={2}>
              <PinMarker kind="pickup" />
            </Marker>
            <Marker position={ride.dropoff} anchor="bottom" zIndex={2}>
              <PinMarker kind="dropoff" label={ride.dropoff.name ?? undefined} />
            </Marker>
            {ride.driverLocation && <AnimatedCarMarker position={ride.driverLocation} heading={ride.driverLocation.heading} category={ride.driver.vehicle?.category ?? ride.category} pulse={ride.status === "assigned"} />}
            <FitCamera points={cameraPoints} bottom={panelHeight} fitKey={`${ride.status}:${followTick}`} follow={false} />
          </>
        )}
      </MapView>

      <OfflineBanner />

      {/* Top chrome */}
      <motion.div variants={stagger(0.08)} initial="hidden" animate="show" className="absolute inset-x-0 top-0 pointer-events-none flex items-start justify-between px-4" style={{ paddingTop: "calc(var(--safe-top) + 12px)" }}>
        <motion.div variants={item.down} className="pointer-events-auto">
          <BackButton fallback="/c/home" />
        </motion.div>
        <motion.div variants={item.down} className="pointer-events-auto flex items-center gap-2">
          <IconButton icon={ShareNetwork} label="Share trip" variant="solid" className="text-ink-700" onClick={() => void share()} />
          <motion.button type="button" aria-label="Emergency help" whileTap={{ scale: 0.92, y: 3 }} transition={springBouncy} onClick={() => {
            haptic.heavy();
            setSosOpen(true);
          }} className="h-12 pl-3 pr-4 rounded-full jelly jelly-rose font-display font-semibold text-[15px] tracking-wide flex items-center gap-1.5">
            <ShieldWarning className="size-[22px]" weight="duotone" />
            SOS
          </motion.button>
        </motion.div>
      </motion.div>

      <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ ...spring, delay: 0.3 }} className="absolute right-4 z-10" style={{ bottom: panelHeight + 14 }}>
        <IconButton icon={GpsFix} label="Re-centre" variant="solid" className="text-sky-600" onClick={() => {
          haptic.tick();
          setFollowTick((n) => n + 1);
        }} />
      </motion.div>

      {/* Bottom panel */}
      <div ref={panelRef} className="absolute inset-x-0 bottom-0 z-10 flex flex-col max-h-[70%]">
        <motion.div initial={{ y: 90, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={spring} className="glass rounded-t-[32px] shadow-float flex flex-col min-h-0 overflow-y-auto no-scrollbar px-4 pt-3" style={{ paddingBottom: "calc(var(--safe-bottom) + 16px)", background: PANEL_BG }}>
          <div className="flex justify-center">
            <span className="h-1.5 w-12 rounded-full bg-paper-300" />
          </div>

          <motion.div variants={stagger(0.07, 0.1)} initial="hidden" animate="show" className="flex flex-col gap-3.5 pt-3">
            <motion.div variants={item.down} className="px-1 min-h-[58px]">
              {ride && STATUS_PILL[ride.status] && (
                <motion.span layout initial={{ scale: 0.6, opacity: 0, rotate: -4 }} animate={{ scale: 1, opacity: 1, rotate: -1.5, backgroundColor: STATUS_PILL[ride.status]!.bg, color: STATUS_PILL[ride.status]!.fg }} transition={springBouncy} className="sticker inline-flex items-center gap-1.5 rounded-full px-3 h-8 text-[12.5px] font-extrabold uppercase tracking-wider mb-2 ml-0.5">
                  <span className="size-2 rounded-full bg-white/80" />
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span key={ride.status} initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -8, opacity: 0 }} transition={spring}>
                      {STATUS_PILL[ride.status]!.label}
                    </motion.span>
                  </AnimatePresence>
                </motion.span>
              )}
              <AnimatePresence mode="wait" initial={false}>
                {ride && info ? (
                  <motion.div key={ride.status} initial={{ opacity: 0, y: 14, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -10, filter: "blur(4px)" }} transition={spring}>
                    <h1 className="font-display text-[24px] font-semibold text-ink-900 leading-tight">{info.headline}</h1>
                    <p className="text-[13.5px] text-ink-500 mt-1 leading-snug font-semibold">{info.sub}</p>
                    {info.stale && <p className="text-[12px] text-sun-600 mt-0.5 font-bold">The driver's location hasn't updated for a while.</p>}
                  </motion.div>
                ) : (
                  <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-2 pt-1">
                    <span className="h-5 w-2/3 rounded shimmer bg-paper-200" />
                    <span className="h-3.5 w-1/2 rounded shimmer bg-paper-200" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {ride && (
              <>
                <motion.div variants={item.right}>
                  <DriverCard driver={ride.driver} unread={ride.unreadMessages} phone={phone} onChat={() => navigate(`/rides/${ride.id}/chat`)} onCall={phone ? () => dial(phone) : undefined} />
                </motion.div>

                <motion.div variants={item.left} className="pillow bg-sun-100 px-4 py-3 flex items-center gap-3">
                  <span className="size-11 rounded-full bg-white text-sun-600 flex items-center justify-center shrink-0">
                    <MoneyIcon className="size-6" weight="duotone" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-500">Fare · cash</p>
                    <p className="text-[12.5px] text-ink-600 truncate font-semibold">
                      {formatKm(ride.distanceKm)} · {formatDuration(ride.durationMin)} · 100% to your driver
                    </p>
                  </div>
                  <Money value={ride.farePkr} className="text-[24px] text-ink-900" />
                </motion.div>

                <motion.div variants={item.up} className="flex flex-col gap-2 pt-0.5">
                  {ride.status === "completed" ? (
                    <>
                      {!ride.myRating ? (
                        <Button full size="xl" icon={Star} onClick={() => setRatingOpen(true)}>
                          Rate your driver
                        </Button>
                      ) : (
                        <div className="rounded-[22px] bg-mint-100 px-4 py-3 text-[14px] text-ink-800 font-semibold flex items-center gap-2">
                          <Star className="size-5 text-sun-500" weight="fill" />
                          You rated this trip {ride.myRating.stars} {ride.myRating.stars === 1 ? "star" : "stars"}. Thank you!
                        </div>
                      )}
                      <Button full variant="secondary" onClick={goHome}>
                        Done
                      </Button>
                    </>
                  ) : canCancel ? (
                    <Button full variant="ghost" icon={X} className="text-rose-500!" onClick={() => setCancelOpen(true)}>
                      Cancel ride
                    </Button>
                  ) : (
                    <p className="text-center text-[12.5px] text-ink-500 py-1 font-semibold">Sit back and enjoy the ride. Use SOS if anything feels wrong.</p>
                  )}
                </motion.div>
              </>
            )}

            {query.isError && !ride && (
              <motion.div variants={item.up} className="flex flex-col items-center gap-3 py-4 text-center">
                <p className="text-[14px] text-ink-600 font-semibold">{errorMessage(query.error, "We couldn't load this ride.")}</p>
                <Button variant="secondary" size="md" onClick={() => void query.refetch()}>
                  Try again
                </Button>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      </div>

      <CancelSheet open={cancelOpen} onClose={() => setCancelOpen(false)} perspective="customer" onConfirm={(reason, details) => cancel.mutateAsync({ reason, details }).then(() => undefined)} />

      <RatingSheet
        open={ratingOpen}
        ride={ride ?? null}
        perspective="customer"
        onClose={() => {
          setRatingOpen(false);
          if (ride?.status === "completed") goHome();
        }}
        onRated={() => {
          setRatingOpen(false);
          goHome();
        }}
      />

      <Sheet open={sosOpen} onClose={() => setSosOpen(false)} title="Emergency help">
        <motion.div variants={stagger(0.06)} initial="hidden" animate="show" className="flex flex-col gap-3 pb-2">
          <motion.div variants={item.down} className="rounded-[22px] bg-rose-100 px-4 py-3 flex items-start gap-3">
            <ShieldWarning className="size-6 text-rose-500 shrink-0 mt-0.5" weight="duotone" />
            <p className="text-[13.5px] text-ink-800 leading-snug font-semibold">If you feel unsafe, call for help now. Keep the app open — your trip details are below to read out.</p>
          </motion.div>
          <motion.div variants={item.up} className="grid grid-cols-2 gap-2">
            <Button size="xl" variant="danger" icon={Phone} onClick={() => dial(POLICE)}>
              Police · {POLICE}
            </Button>
            <Button size="xl" variant="outline" icon={Phone} onClick={() => dial(RESCUE)}>
              Rescue · {RESCUE}
            </Button>
          </motion.div>
          {ride && (
            <motion.div variants={item.up} className="pillow px-4 py-3 text-[13px] text-ink-600 leading-relaxed font-medium">
              <p className={cn("font-extrabold text-ink-900")}>{ride.driver.fullName}{ride.driver.vehicle?.plate ? ` · ${ride.driver.vehicle.plate}` : ""}</p>
              {vehicleLine(ride.driver.vehicle) && <p>{vehicleLine(ride.driver.vehicle)}</p>}
              <p className="text-ink-500 mt-1">From {ride.pickup.address}</p>
              <p className="text-ink-500">To {ride.dropoff.address}</p>
            </motion.div>
          )}
          <motion.div variants={item.up}>
            <Button full variant="ghost" icon={ShareNetwork} onClick={() => void share()}>
              Share my trip with someone
            </Button>
          </motion.div>
        </motion.div>
      </Sheet>
    </div>
  );
}
