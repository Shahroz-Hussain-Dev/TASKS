import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Bell, Clock3, LocateFixed, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { VEHICLE_CATEGORIES, VEHICLE_CATEGORY_META, type Place, type VehicleCategory } from "@raahi/shared";
import { CategoryIcon } from "@/components/customer/CategoryIcon";
import { TAB_BAR_CLEARANCE } from "@/components/customer/TabBar";
import { MapView, Marker, UserDot, useMap, type MapHandle } from "@/components/Map";
import { Avatar, Button, IconButton } from "@/components/ui";
import { useActiveTrip } from "@/hooks/customer/useActiveTrip";
import { useBannerOffset } from "@/hooks/customer/useBannerOffset";
import { useDeviceLocation } from "@/hooks/customer/useDeviceLocation";
import { useMapSurface } from "@/hooks/customer/useMapSurface";
import { useRecentPlaces } from "@/hooks/customer/useRecentPlaces";
import "@/hooks/customer/mapRuntime";
import type { PlanRideState } from "@/hooks/customer/planState";
import { useAuth } from "@/lib/auth";
import { DEFAULT_CENTER } from "@/lib/config";
import { item, spring, springBouncy, stagger } from "@/lib/motion";
import { haptic, type LocationFix } from "@/lib/native";
import { cn } from "@/lib/utils";

const MAP_PADDING = { bottom: 300 };
const RECENTS_SHOWN = 3;

function greetingFor(hour: number): string {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * Passenger home: live map centred on the device, a greeting from the top,
 * the "Where to?" card lifting in from the bottom with recent destinations and
 * quick category shortcuts.
 */
export default function HomeScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const mapRef = useRef<MapHandle>(null);
  const device = useDeviceLocation({ watch: true });
  const recents = useRecentPlaces();
  const trip = useActiveTrip();
  const bannerOffset = useBannerOffset();
  const [noticeDismissed, setNoticeDismissed] = useState(false);

  const firstName = user?.fullName.trim().split(/\s+/)[0] ?? "there";
  const greeting = greetingFor(new Date().getHours());

  const plan = (state?: PlanRideState) => {
    haptic.light();
    if (trip.target) {
      navigate(trip.target);
      return;
    }
    navigate("/c/plan", { state });
  };

  const recentre = () => {
    haptic.tick();
    if (device.fix) mapRef.current?.flyTo(device.fix, 15.5);
    else void device.locate();
  };

  const showLocationNotice = (device.status === "denied" || device.status === "unavailable") && !noticeDismissed;

  return (
    <div className="relative h-full w-full bg-ink-900">
      <MapView ref={mapRef} center={device.fix ?? DEFAULT_CENTER} zoom={13.5} padding={MAP_PADDING}>
        {device.fix && (
          <Marker position={device.fix} zIndex={3}>
            <UserDot />
          </Marker>
        )}
        <CentreOnFirstFix fix={device.fix} />
      </MapView>

      <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-ink-900/85 via-ink-900/30 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-ink-900/80 to-transparent" />

      <motion.div variants={stagger(0.08, 0.08)} initial="hidden" animate="show" className="absolute inset-0 pointer-events-none flex flex-col" style={{ paddingTop: `calc(var(--safe-top) + ${12 + bannerOffset}px)` }}>
        <motion.header variants={item.down} className="px-5 flex items-start justify-between gap-3 pointer-events-auto">
          <div className="min-w-0">
            <p className="text-[12.5px] font-bold uppercase tracking-[0.18em] text-brand-400">{greeting}</p>
            <h1 className="font-display text-[30px] font-semibold text-ink-50 leading-[1.05] truncate">{firstName}</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0 pt-0.5">
            <IconButton icon={Bell} label="Notifications" onClick={() => navigate("/notifications")} />
            <motion.button type="button" aria-label="Profile" whileTap={{ scale: 0.9 }} transition={springBouncy} onClick={() => navigate("/profile")} className="rounded-full glass p-0.5 shadow-card">
              <Avatar name={user?.fullName ?? "Rider"} src={user?.avatarUrl} size={40} />
            </motion.button>
          </div>
        </motion.header>

        <AnimatePresence>
          {showLocationNotice && (
            <motion.div key="loc" initial={{ opacity: 0, y: -12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.97 }} transition={spring} className="mx-5 mt-4 pointer-events-auto glass rounded-2xl shadow-card p-3 flex items-center gap-3 border-l-4 border-l-sky-400">
              <span className="size-9 rounded-xl bg-sky-400/15 text-sky-400 flex items-center justify-center shrink-0">
                <LocateFixed className="size-5" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-ink-50">{device.status === "denied" ? "Location is off" : "Can't find your location"}</p>
                <p className="text-[12.5px] text-ink-300 leading-snug">{device.status === "denied" ? "Allow location so drivers know where to pick you up." : "Step outside or check that GPS is on, then try again."}</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => void device.locate()}>
                {device.status === "denied" ? "Allow" : "Retry"}
              </Button>
              <IconButton icon={X} label="Dismiss" variant="ghost" size={32} onClick={() => setNoticeDismissed(true)} />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1" />

        <motion.div variants={item.right} className="self-end px-4 mb-3 pointer-events-auto">
          <IconButton icon={LocateFixed} label="Centre on my location" size={48} onClick={recentre} className={cn(device.status === "locating" && "animate-pulse")} />
        </motion.div>

        <motion.section variants={item.up} className="px-4 pointer-events-auto" style={{ paddingBottom: `calc(var(--safe-bottom) + ${TAB_BAR_CLEARANCE}px)` }}>
          <div className="glass rounded-[28px] shadow-float p-3.5 flex flex-col gap-3">
            <motion.button type="button" whileTap={{ scale: 0.98 }} transition={spring} onClick={() => plan()} className="w-full rounded-2xl bg-ink-800/90 border border-white/8 h-[60px] flex items-center gap-3 pl-3 pr-4 text-left shadow-card">
              <span className="size-10 rounded-xl bg-brand-500 text-ink-950 flex items-center justify-center shadow-glow shrink-0">
                <Search className="size-5" strokeWidth={2.4} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-display text-[17.5px] font-semibold text-ink-50 leading-tight">{trip.target ? "Back to your trip" : "Where to?"}</span>
                <span className="block text-[12.5px] text-ink-400 truncate">{trip.target ? "You have a ride in progress" : "Name your fare · drivers compete for you"}</span>
              </span>
              <ArrowRight className="size-5 text-ink-400 shrink-0" />
            </motion.button>

            <AnimatePresence initial={false}>
              {recents.places.length > 0 && (
                <motion.ul key="recents" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={spring} className="flex flex-col overflow-hidden">
                  {recents.places.slice(0, RECENTS_SHOWN).map((p, i) => (
                    <RecentRow key={`${p.lat},${p.lng}`} place={p} index={i} onClick={() => plan({ dropoff: p })} />
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>

            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-0.5">
              {VEHICLE_CATEGORIES.map((c, i) => (
                <CategoryChip key={c} category={c} index={i} onClick={() => plan({ category: c })} />
              ))}
            </div>
          </div>
        </motion.section>
      </motion.div>
    </div>
  );
}

/** Flies to the first GPS fix once the map is ready; later fixes only move the dot. */
function CentreOnFirstFix({ fix }: { fix: LocationFix | null }) {
  const map = useMap();
  useMapSurface();
  const done = useRef(false);
  useEffect(() => {
    if (!map || !fix || done.current) return;
    done.current = true;
    map.flyTo({ center: [fix.lng, fix.lat], zoom: 15, speed: 1.2, curve: 1.3, essential: true });
  }, [map, fix]);
  return null;
}

function RecentRow({ place, index, onClick }: { place: Place; index: number; onClick: () => void }) {
  return (
    <motion.li initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ ...spring, delay: 0.05 * index }} className="list-none">
      <motion.button type="button" whileTap={{ scale: 0.985 }} transition={spring} onClick={onClick} className="w-full flex items-center gap-3 rounded-2xl px-2 py-2 text-left hover:bg-white/4 transition-colors">
        <span className="size-9 rounded-xl bg-white/5 text-ink-300 flex items-center justify-center shrink-0">
          <Clock3 className="size-[18px]" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[14.5px] font-semibold text-ink-50 truncate leading-snug">{place.name ?? place.address}</span>
          {place.name && place.name !== place.address && <span className="block text-[12px] text-ink-400 truncate">{place.address}</span>}
        </span>
        <ArrowRight className="size-4 text-ink-500 shrink-0" />
      </motion.button>
    </motion.li>
  );
}

function CategoryChip({ category, index, onClick }: { category: VehicleCategory; index: number; onClick: () => void }) {
  const meta = VEHICLE_CATEGORY_META[category];
  return (
    <motion.button type="button" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.35 + index * 0.05 }} whileTap={{ scale: 0.94 }} onClick={() => {
      haptic.tick();
      onClick();
    }} className="shrink-0 inline-flex items-center gap-2 h-10 pl-2 pr-3.5 rounded-full bg-white/5 border border-white/8 text-ink-100 text-[13.5px] font-semibold">
      <span className="size-7 rounded-full bg-brand-500/15 text-brand-400 flex items-center justify-center">
        <CategoryIcon category={category} className="size-4" strokeWidth={2.2} />
      </span>
      {meta.label}
    </motion.button>
  );
}
