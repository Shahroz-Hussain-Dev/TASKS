import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Clock3, Minus, NotebookPen, Plus, Route, Search, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { VEHICLE_CATEGORY_META, createRideRequestSchema, decodePolyline, isWithinFareBounds, type LatLng, type Place, type VehicleCategory } from "@raahi/shared";
import { CategoryCarousel } from "@/components/customer/CategoryCarousel";
import { FitCamera } from "@/components/customer/FitCamera";
import { MapPicker } from "@/components/customer/MapPicker";
import { OfferComposer } from "@/components/customer/OfferComposer";
import { PlaceFields } from "@/components/customer/PlaceFields";
import { MapView, Marker, PinMarker, RouteLine, type MapHandle } from "@/components/Map";
import PlaceSearch from "@/components/PlaceSearch";
import { BackButton } from "@/components/shared/BackButton";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import { Button, Skeleton, TextArea, useToast } from "@/components/ui";
import { ck } from "@/hooks/customer/keys";
import "@/hooks/customer/mapRuntime";
import { clampOffer } from "@/hooks/customer/offer";
import { readPlanState } from "@/hooks/customer/planState";
import { useDeviceLocation } from "@/hooks/customer/useDeviceLocation";
import { useElementHeight } from "@/hooks/customer/useElementHeight";
import { pushRecentPlace, useRecentPlaces } from "@/hooks/customer/useRecentPlaces";
import { api, ApiRequestError } from "@/lib/api";
import { DEFAULT_CENTER } from "@/lib/config";
import { item, spring, springBouncy, stagger } from "@/lib/motion";
import { haptic } from "@/lib/native";
import { cn, errorMessage, formatDuration, formatKm, pkr } from "@/lib/utils";

const OFFER_STEP = 10;
const NOTE_MAX = 200;

/**
 * Plan a ride: pickup (defaults to GPS, reverse-geocoded), destination via
 * search or map pin, live quote with route, category carousel, offer composer
 * and the "Find a driver" call to action.
 */
export default function PlanRideScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const initial = useMemo(() => readPlanState(location.state), [location.state]);
  const mapRef = useRef<MapHandle>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelHeight = useElementHeight(panelRef, 320);
  const device = useDeviceLocation();
  const recents = useRecentPlaces();

  const [pickup, setPickup] = useState<Place | null>(initial.pickup ?? null);
  const [dropoff, setDropoff] = useState<Place | null>(initial.dropoff ?? null);
  const [category, setCategory] = useState<VehicleCategory>(initial.category ?? "car");
  const [offer, setOffer] = useState<number | null>(null);
  const [passengers, setPassengers] = useState(1);
  const [note, setNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [search, setSearch] = useState<"pickup" | "dropoff" | null>(null);
  const [mapPick, setMapPick] = useState<"pickup" | "dropoff" | null>(null);

  /* ---------------- pickup defaults to where the device is ---------------- */
  const wantAutoPickup = !pickup && device.status === "ready" && !!device.fix;
  const reverse = useQuery({
    queryKey: ck.reverse(device.fix),
    queryFn: () => api.geo.reverse(device.fix ?? DEFAULT_CENTER),
    enabled: wantAutoPickup,
    staleTime: 5 * 60_000,
    retry: 1,
  });
  useEffect(() => {
    if (!wantAutoPickup || !device.fix) return;
    const { lat, lng } = device.fix;
    if (reverse.data) setPickup({ lat, lng, address: reverse.data.address, name: reverse.data.name || "Current location" });
    else if (reverse.isError) setPickup({ lat, lng, address: "Current location", name: "Current location" });
  }, [wantAutoPickup, reverse.data, reverse.isError, device.fix]);

  /* ------------------------------ quote ------------------------------ */
  const route = pickup && dropoff ? { pickup, dropoff } : null;
  const quote = useQuery({
    queryKey: route ? ck.quote(route.pickup, route.dropoff) : ["quote", "idle"],
    queryFn: () => api.rides.quote({ pickup: { lat: route?.pickup.lat ?? 0, lng: route?.pickup.lng ?? 0 }, dropoff: { lat: route?.dropoff.lat ?? 0, lng: route?.dropoff.lng ?? 0 } }),
    enabled: route !== null,
    staleTime: 60_000,
    retry: 1,
  });
  const fares = quote.data?.fares ?? null;
  const fare = fares?.[category] ?? null;

  // A new fare (route or category changed) pre-fills the recommended price.
  const fareKey = fare ? `${category}:${fare.minimumFarePkr}:${fare.recommendedFarePkr}:${fare.maximumFarePkr}` : null;
  const lastFareKey = useRef<string | null>(null);
  useEffect(() => {
    if (!fare || !fareKey || fareKey === lastFareKey.current) return;
    lastFareKey.current = fareKey;
    setOffer(fare.recommendedFarePkr);
  }, [fare, fareKey]);

  const seats = VEHICLE_CATEGORY_META[category].seats;
  useEffect(() => {
    setPassengers((p) => Math.min(Math.max(1, p), seats));
  }, [seats]);

  const routePoints = useMemo<LatLng[]>(() => {
    const q = quote.data;
    if (!q) return [];
    if (q.geometry.length >= 2) return q.geometry;
    if (q.polyline) {
      try {
        const decoded = decodePolyline(q.polyline);
        if (decoded.length >= 2) return decoded;
      } catch {
        /* fall through to a straight line */
      }
    }
    return pickup && dropoff ? [pickup, dropoff] : [];
  }, [quote.data, pickup, dropoff]);

  const cameraPoints = useMemo<LatLng[]>(() => {
    if (routePoints.length >= 2) return routePoints;
    return [pickup, dropoff].filter((p): p is Place => p !== null);
  }, [routePoints, pickup, dropoff]);

  /* ----------------------------- create ----------------------------- */
  const create = useMutation({
    mutationFn: async () => {
      if (!pickup || !dropoff || !quote.data || !fare || offer === null) throw new Error("Set your pickup and destination first");
      if (!isWithinFareBounds(offer, fare.minimumFarePkr, fare.maximumFarePkr)) throw new Error(`Your offer must be between ${pkr(fare.minimumFarePkr)} and ${pkr(fare.maximumFarePkr)}`);
      const parsed = createRideRequestSchema.safeParse({
        pickup,
        dropoff,
        category,
        offeredFarePkr: offer,
        passengers,
        note: note.trim() || undefined,
        distanceKm: quote.data.distanceKm,
        durationMin: quote.data.durationMin,
        routePolyline: quote.data.polyline ?? undefined,
      });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Check your ride details");
      return api.requests.create(parsed.data);
    },
    onSuccess: (req) => {
      haptic.success();
      if (dropoff) void pushRecentPlace(dropoff);
      queryClient.setQueryData(ck.request(req.id), req);
      void queryClient.invalidateQueries({ queryKey: ck.activeTrip });
      navigate(`/c/request/${req.id}`, { replace: true });
    },
    onError: async (err) => {
      haptic.error();
      if (err instanceof ApiRequestError && err.status === 409) {
        const d = (err.details ?? {}) as { requestId?: unknown; rideId?: unknown };
        void queryClient.invalidateQueries({ queryKey: ck.activeTrip });
        if (typeof d.rideId === "string") {
          toast({ title: "You're already on a ride", body: "Finish it before requesting another.", tone: "neutral" });
          navigate(`/c/ride/${d.rideId}`, { replace: true });
          return;
        }
        if (typeof d.requestId === "string") {
          toast({ title: "You already have an open request", body: "Taking you back to your offers.", tone: "neutral" });
          navigate(`/c/request/${d.requestId}`, { replace: true });
          return;
        }
        try {
          const active = await api.requests.active();
          if (active.ride) {
            navigate(`/c/ride/${active.ride.id}`, { replace: true });
            return;
          }
          if (active.request) {
            navigate(`/c/request/${active.request.id}`, { replace: true });
            return;
          }
        } catch {
          /* fall through to the generic toast */
        }
      }
      toast({ title: "Couldn't send your request", body: errorMessage(err), tone: "error" });
    },
  });

  /* ---------------------------- handlers ---------------------------- */
  const setPlace = (target: "pickup" | "dropoff", place: Place) => {
    if (target === "pickup") setPickup(place);
    else setDropoff(place);
    setSearch(null);
    setMapPick(null);
  };

  const swap = () => {
    if (!pickup || !dropoff) return;
    setPickup(dropoff);
    setDropoff(pickup);
  };

  const quoting = route !== null && quote.isLoading;
  const ready = !!fare && offer !== null && !quoting && !quote.isError;
  const ctaLabel = !pickup ? "Waiting for your location" : !dropoff ? "Choose a destination" : quoting ? "Calculating your fare…" : quote.isError ? "Couldn't calculate the fare" : offer !== null ? `Find a driver for ${pkr(offer)}` : "Find a driver";

  return (
    <div className="relative h-full w-full bg-ink-900">
      <MapView ref={mapRef} center={pickup ?? device.fix ?? DEFAULT_CENTER} zoom={14}>
        {routePoints.length >= 2 && <RouteLine points={routePoints} id="plan-route" />}
        {pickup && (
          <Marker position={pickup} anchor="bottom" zIndex={2}>
            <PinMarker kind="pickup" label={dropoff ? undefined : pickup.name ?? "Pickup"} />
          </Marker>
        )}
        {dropoff && (
          <Marker position={dropoff} anchor="bottom" zIndex={2}>
            <PinMarker kind="dropoff" label={dropoff.name ?? "Drop-off"} />
          </Marker>
        )}
        <FitCamera points={cameraPoints} bottom={panelHeight} />
      </MapView>

      <OfflineBanner />

      {/* Top chrome */}
      <motion.div variants={stagger(0.08)} initial="hidden" animate="show" className="absolute inset-x-0 top-0 pointer-events-none flex items-start justify-between px-4" style={{ paddingTop: "calc(var(--safe-top) + 12px)" }}>
        <motion.div variants={item.down} className="pointer-events-auto">
          <BackButton fallback="/c/home" />
        </motion.div>
        <AnimatePresence>
          {quote.data && (
            <motion.div key="trip-pill" initial={{ opacity: 0, y: -16, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.9 }} transition={springBouncy} className="pointer-events-auto glass rounded-full h-11 px-4 flex items-center gap-2 shadow-card text-[13.5px] font-semibold text-ink-50">
              <Route className="size-4 text-brand-400" />
              {formatKm(quote.data.distanceKm)}
              <span className="text-ink-600">·</span>
              <Clock3 className="size-4 text-amber-300" />
              {formatDuration(quote.data.durationMin)}
              {quote.data.source === "estimate" && <span className="ml-1 text-[11px] font-bold uppercase tracking-wider text-ink-400">est.</span>}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Bottom panel */}
      <div ref={panelRef} className="absolute inset-x-0 bottom-0 z-10 flex flex-col max-h-[74%]">
        <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={spring} className="glass rounded-t-[30px] shadow-float flex flex-col min-h-0 relative">
          <div className="flex justify-center pt-3">
            <span className="h-1.5 w-12 rounded-full bg-white/15" />
          </div>
          <motion.div variants={stagger(0.07, 0.12)} initial="hidden" animate="show" className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-4 pt-3 flex flex-col gap-4" style={{ paddingBottom: "calc(var(--safe-bottom) + 96px)" }}>
            <motion.div variants={item.up}>
              <PlaceFields pickup={pickup} dropoff={dropoff} locating={device.status === "locating" || (wantAutoPickup && reverse.isLoading)} onEdit={setSearch} onSwap={swap} />
            </motion.div>

            {!dropoff && (
              <motion.div variants={item.left} className="flex flex-col gap-1">
                {recents.places.length > 0 ? (
                  <>
                    <p className="px-1 text-[11.5px] font-bold uppercase tracking-[0.16em] text-ink-500">Recent destinations</p>
                    <ul className="flex flex-col">
                      {recents.places.map((p) => (
                        <li key={`${p.lat},${p.lng}`} className="list-none">
                          <motion.button type="button" whileTap={{ scale: 0.985 }} transition={spring} onClick={() => setDropoff(p)} className="w-full flex items-center gap-3 rounded-2xl px-2 py-2.5 text-left hover:bg-white/4">
                            <span className="size-9 rounded-xl bg-white/5 text-ink-300 flex items-center justify-center shrink-0">
                              <Clock3 className="size-[18px]" />
                            </span>
                            <span className="flex-1 min-w-0">
                              <span className="block text-[14.5px] font-semibold text-ink-50 truncate">{p.name ?? p.address}</span>
                              {p.name && p.name !== p.address && <span className="block text-[12px] text-ink-400 truncate">{p.address}</span>}
                            </span>
                          </motion.button>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <button type="button" onClick={() => setSearch("dropoff")} className="flex items-center gap-3 rounded-2xl bg-white/4 border border-white/6 px-3.5 py-3 text-left">
                    <Search className="size-5 text-brand-400 shrink-0" />
                    <span className="text-[14px] text-ink-300 leading-snug">Search a landmark, road or area — or drop a pin on the map.</span>
                  </button>
                )}
              </motion.div>
            )}

            {route && (
              <>
                <motion.div variants={item.right}>
                  <CategoryCarousel value={category} onChange={setCategory} fares={fares} loading={quoting} />
                </motion.div>

                <AnimatePresence mode="wait" initial={false}>
                  {quote.isError ? (
                    <motion.div key="err" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring} className="rounded-2xl bg-rose-500/10 border border-rose-500/25 p-3.5 flex items-start gap-3">
                      <AlertTriangle className="size-5 text-rose-400 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-[14px] font-semibold text-ink-50">We couldn't price this route</p>
                        <p className="text-[12.5px] text-ink-300 mt-0.5">{errorMessage(quote.error, "Check your connection and try again.")}</p>
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => void quote.refetch()}>
                        Retry
                      </Button>
                    </motion.div>
                  ) : fare && offer !== null ? (
                    <motion.div key={`offer-${category}`} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={spring} className="rounded-3xl bg-ink-800 border border-white/8 shadow-card p-4">
                      <OfferComposer fare={fare} value={clampOffer(offer, fare, OFFER_STEP)} onChange={setOffer} step={OFFER_STEP} />
                    </motion.div>
                  ) : (
                    <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-3xl bg-ink-800 border border-white/8 p-4 flex flex-col gap-3">
                      <Skeleton className="h-3.5 w-24" />
                      <div className="flex items-center justify-between">
                        <Skeleton className="size-12 rounded-2xl" />
                        <Skeleton className="h-9 w-36" />
                        <Skeleton className="size-12 rounded-2xl" />
                      </div>
                      <Skeleton className="h-2 w-full" />
                      <Skeleton className="h-10 w-full rounded-2xl" />
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.div variants={item.left} className="flex items-stretch gap-2.5">
                  <div className="flex-1 rounded-2xl bg-ink-800 border border-white/8 px-3 py-2.5 flex items-center gap-3">
                    <Users className="size-5 text-ink-300 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-500">Passengers</p>
                      <p className="text-[14px] font-semibold text-ink-50">
                        {passengers} of {seats}
                      </p>
                    </div>
                    <Counter value={passengers} min={1} max={seats} onChange={setPassengers} />
                  </div>
                  <motion.button type="button" whileTap={{ scale: 0.95 }} transition={spring} onClick={() => setNoteOpen((v) => !v)} className={cn("rounded-2xl border px-3 flex items-center gap-2 text-[13.5px] font-semibold transition-colors", noteOpen || note ? "bg-brand-500/12 border-brand-500/40 text-brand-300" : "bg-ink-800 border-white/8 text-ink-200")}>
                    <NotebookPen className="size-5" />
                    {note ? "Note added" : "Add note"}
                  </motion.button>
                </motion.div>

                <AnimatePresence initial={false}>
                  {noteOpen && (
                    <motion.div key="note" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={spring} className="overflow-hidden">
                      <TextArea label="Note for the driver" placeholder="Gate number, landmark, luggage, or anything the driver should know" value={note} maxLength={NOTE_MAX} onChange={(e) => setNote(e.target.value)} className="min-h-20" hint={`${NOTE_MAX - note.length} characters left`} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </motion.div>

          {/* Sticky CTA */}
          <div className="absolute inset-x-0 bottom-0 px-4 pt-6 bg-gradient-to-t from-ink-900 via-ink-900/90 to-transparent rounded-b-none" style={{ paddingBottom: "calc(var(--safe-bottom) + 14px)" }}>
            <Button full size="xl" disabled={!ready} loading={create.isPending} onClick={() => create.mutate()}>
              {ctaLabel}
            </Button>
          </div>
        </motion.div>
      </div>

      <PlaceSearch
        open={search !== null}
        target={search ?? "dropoff"}
        near={pickup ?? device.fix ?? null}
        initialQuery=""
        onClose={() => setSearch(null)}
        onPick={(place) => search && setPlace(search, place)}
        onPickOnMap={() => {
          const t = search ?? "dropoff";
          setSearch(null);
          setMapPick(t);
        }}
      />

      <MapPicker
        open={mapPick !== null}
        target={mapPick ?? "dropoff"}
        initial={mapPick === "pickup" ? pickup ?? device.fix ?? null : dropoff ?? pickup ?? device.fix ?? null}
        onClose={() => setMapPick(null)}
        onConfirm={(place) => mapPick && setPlace(mapPick, place)}
      />
    </div>
  );
}

function Counter({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  const step = (d: number) => {
    const next = Math.min(max, Math.max(min, value + d));
    if (next !== value) {
      haptic.tick();
      onChange(next);
    }
  };
  return (
    <div className="flex items-center gap-1">
      <motion.button type="button" aria-label="Fewer passengers" whileTap={{ scale: 0.85 }} transition={springBouncy} disabled={value <= min} onClick={() => step(-1)} className="size-9 rounded-xl bg-white/6 text-ink-50 flex items-center justify-center disabled:text-ink-600 disabled:bg-white/3">
        <Minus className="size-4" strokeWidth={2.5} />
      </motion.button>
      <motion.button type="button" aria-label="More passengers" whileTap={{ scale: 0.85 }} transition={springBouncy} disabled={value >= max} onClick={() => step(1)} className="size-9 rounded-xl bg-white/6 text-ink-50 flex items-center justify-center disabled:text-ink-600 disabled:bg-white/3">
        <Plus className="size-4" strokeWidth={2.5} />
      </motion.button>
    </div>
  );
}
