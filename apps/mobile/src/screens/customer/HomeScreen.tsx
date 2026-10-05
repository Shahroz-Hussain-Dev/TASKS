import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Bell, Clock, GpsFix, MagnifyingGlass, Microphone, X } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { VEHICLE_CATEGORIES, VEHICLE_CATEGORY_META, type Place, type VehicleCategory } from "@raahi/shared";
import { AssistantSheet, BuddyBubble } from "@/components/buddy";
import { CategoryIcon } from "@/components/customer/CategoryIcon";
import { CATEGORY_TONE } from "@/components/customer/categoryTone";
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
/** Buddy floats bottom-right above the tab bar; the panel leaves this much room for him. */
const BUDDY_CLEARANCE = 72;

function greetingFor(hour: number): string {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * Passenger home: light map centred on the device, a cream greeting card from
 * the top, the "Where to?" sticker card lifting in from the bottom with recent
 * destinations and quick category shortcuts, and Buddy waiting bottom-right.
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
  const [assistantOpen, setAssistantOpen] = useState(false);

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
    <div className="relative h-full w-full bg-paper-50">
      <MapView ref={mapRef} center={device.fix ?? DEFAULT_CENTER} zoom={13.5} padding={MAP_PADDING}>
        {device.fix && (
          <Marker position={device.fix} zIndex={3}>
            <UserDot />
          </Marker>
        )}
        <CentreOnFirstFix fix={device.fix} />
      </MapView>

      {/* Soft cream vignette so the floating cards sit on the map comfortably */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-paper-50/90 via-paper-50/40 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-paper-50/95 via-paper-50/50 to-transparent" />

      <motion.div variants={stagger(0.08, 0.08)} initial="hidden" animate="show" className="absolute inset-0 pointer-events-none flex flex-col" style={{ paddingTop: `calc(var(--safe-top) + ${12 + bannerOffset}px)` }}>
        <motion.header variants={item.down} className="px-4 pointer-events-auto">
          <div className="pillow bg-paper-100/95 border border-white rounded-[28px] pl-4 pr-3 py-3 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-extrabold uppercase tracking-[0.16em] text-coral-600">{greeting},</p>
              <h1 className="font-display text-[28px] font-semibold text-ink-900 leading-[1.05] truncate">{firstName}</h1>
            </div>
            <IconButton icon={Bell} label="Notifications" variant="solid" size={44} className="text-coral-600" onClick={() => navigate("/notifications")} />
            <motion.button type="button" aria-label="Profile" whileTap={{ scale: 0.9 }} transition={springBouncy} onClick={() => navigate("/profile")} className="rounded-full">
              <Avatar name={user?.fullName ?? "Rider"} src={user?.avatarUrl} size={44} ring />
            </motion.button>
          </div>
        </motion.header>

        <AnimatePresence>
          {showLocationNotice && (
            <motion.div key="loc" initial={{ opacity: 0, y: -12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.97 }} transition={spring} className="mx-4 mt-3 pointer-events-auto pillow rounded-[22px] p-3 flex items-center gap-3 border-l-[6px] border-l-sky-500">
              <span className="size-10 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
                <GpsFix className="size-[22px]" weight="duotone" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-extrabold text-ink-900">{device.status === "denied" ? "Location is off" : "Can't find your location"}</p>
                <p className="text-[12.5px] text-ink-500 leading-snug font-medium">{device.status === "denied" ? "Allow location so drivers know where to pick you up." : "Step outside or check that GPS is on, then try again."}</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => void device.locate()}>
                {device.status === "denied" ? "Allow" : "Retry"}
              </Button>
              <IconButton icon={X} label="Dismiss" variant="ghost" size={32} weight="bold" onClick={() => setNoticeDismissed(true)} />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1" />

        <motion.div variants={item.right} className="self-end px-4 mb-3 pointer-events-auto">
          <IconButton icon={GpsFix} label="Centre on my location" variant="solid" size={48} className={cn("text-sky-600", device.status === "locating" && "animate-pulse")} onClick={recentre} />
        </motion.div>

        <motion.section variants={item.up} className="px-4 pointer-events-auto" style={{ paddingBottom: `calc(var(--safe-bottom) + ${TAB_BAR_CLEARANCE + BUDDY_CLEARANCE}px)` }}>
          <div className="glass rounded-[32px] p-3 flex flex-col gap-3 overflow-hidden">
            <div className="relative px-1 pt-1">
              <span aria-hidden className="blob bg-coral-100 -left-2 -top-3 w-[55%] h-[130%] opacity-80" />
              <span aria-hidden className="blob bg-sun-100 right-0 -bottom-4 w-[40%] h-[110%] opacity-80" style={{ animationDelay: "-6s" }} />
              <div className="relative sticker sticker-tilt-l bg-white rounded-[24px] p-2 flex items-center gap-2">
                <motion.button type="button" whileTap={{ scale: 0.98, y: 2 }} transition={spring} onClick={() => plan()} className="flex-1 min-w-0 flex items-center gap-3 text-left rounded-[20px] py-1.5 pl-1">
                  <span className="jelly jelly-coral size-11 rounded-full flex items-center justify-center shrink-0">
                    <MagnifyingGlass className="size-[22px]" weight="bold" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-display text-[20px] font-semibold text-ink-900 leading-tight">{trip.target ? "Back to your trip" : "Where to?"}</span>
                    <span className="block text-[12.5px] text-ink-500 truncate font-semibold">{trip.target ? "You have a ride in progress" : "Name your fare, drivers compete"}</span>
                  </span>
                  <ArrowRight className="size-5 text-ink-300 shrink-0" weight="bold" />
                </motion.button>
                <IconButton icon={Microphone} label="Voice booking" variant="solid" size={44} className="text-coral-600 shrink-0" onClick={() => {
                  haptic.light();
                  setAssistantOpen(true);
                }} />
              </div>
            </div>

            <AnimatePresence initial={false}>
              {recents.places.length > 0 && (
                <motion.ul key="recents" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={spring} className="flex flex-col overflow-hidden pt-1">
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

      <BuddyBubble hint="Say where you want to go" />
      <AssistantSheet open={assistantOpen} autoVoice onClose={() => setAssistantOpen(false)} />
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
      <motion.button type="button" whileTap={{ scale: 0.985 }} transition={spring} onClick={onClick} className="w-full flex items-center gap-3 rounded-2xl px-2 py-2 text-left hover:bg-white/70 transition-colors">
        <span className="size-9 rounded-full bg-white text-ink-500 flex items-center justify-center shrink-0 shadow-pillow">
          <Clock className="size-[20px]" weight="duotone" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[14.5px] font-extrabold text-ink-900 truncate leading-snug">{place.name ?? place.address}</span>
          {place.name && place.name !== place.address && <span className="block text-[12px] text-ink-500 truncate font-medium">{place.address}</span>}
        </span>
        <ArrowRight className="size-4 text-ink-300 shrink-0" weight="bold" />
      </motion.button>
    </motion.li>
  );
}

function CategoryChip({ category, index, onClick }: { category: VehicleCategory; index: number; onClick: () => void }) {
  const meta = VEHICLE_CATEGORY_META[category];
  const tone = CATEGORY_TONE[category];
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ ...springBouncy, delay: 0.35 + index * 0.05 }}
      whileTap={{ scale: 0.92 }}
      onClick={() => {
        haptic.tick();
        onClick();
      }}
      className={cn("shrink-0 inline-flex items-center gap-2 h-10 pl-1.5 pr-3.5 rounded-full text-[13.5px] font-extrabold", tone.tint)}
    >
      <span className="size-7 rounded-full bg-white flex items-center justify-center">
        <CategoryIcon category={category} className="size-[18px]" />
      </span>
      {meta.label}
    </motion.button>
  );
}
