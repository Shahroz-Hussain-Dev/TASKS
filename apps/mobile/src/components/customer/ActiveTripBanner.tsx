import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, Radar } from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { RIDE_STATUS_META, vehicleLine } from "@/components/shared/meta";
import { OFFLINE_BANNER_HEIGHT } from "@/hooks/customer/useBannerOffset";
import { useActiveTrip } from "@/hooks/customer/useActiveTrip";
import { useOnline } from "@/hooks/useOnline";
import { springSoft } from "@/lib/motion";
import { haptic } from "@/lib/native";
import { pkr } from "@/lib/utils";


/**
 * Global "something is happening" strip at the top of the tab screens: an open
 * request collecting offers, or a live ride. Tapping it resumes the flow.
 */
let shownOnce = false;

export function ActiveTripBanner() {
  const navigate = useNavigate();
  const trip = useActiveTrip();
  const online = useOnline();
  const animateIn = !shownOnce;
  useEffect(() => {
    if (trip.target) shownOnce = true;
  }, [trip.target]);

  let title: string | null = null;
  let sub: string | null = null;
  if (trip.ride) {
    title = RIDE_STATUS_META[trip.ride.status].headline;
    sub = [vehicleLine(trip.ride.driver.vehicle), pkr(trip.ride.farePkr)].filter(Boolean).join(" · ");
  } else if (trip.request) {
    const offers = trip.request.bids.filter((b) => b.status === "pending").length;
    title = offers > 0 ? `${offers} ${offers === 1 ? "driver has" : "drivers have"} made an offer` : "Finding drivers for you";
    sub = `Your offer ${pkr(trip.request.offeredFarePkr)} · ${trip.request.dropoff.name ?? trip.request.dropoff.address}`;
  }

  return (
    <AnimatePresence>
      {trip.target && title && (
        <motion.div
          key={trip.target}
          initial={animateIn ? { y: -40, opacity: 0, scale: 0.96 } : false}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -30, opacity: 0, scale: 0.96 }}
          transition={springSoft}
          className="fixed inset-x-0 z-30 flex justify-center px-4 pointer-events-none"
          style={{ top: `calc(var(--safe-top) + ${online ? 10 : 10 + OFFLINE_BANNER_HEIGHT}px)` }}
        >
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            transition={springSoft}
            onClick={() => {
              haptic.light();
              if (trip.target) navigate(trip.target);
            }}
            className="pointer-events-auto glass shadow-float rounded-2xl w-full max-w-sm flex items-center gap-3 pl-3 pr-2 py-2.5 text-left border-l-4 border-l-brand-500"
          >
            <span className="relative size-9 rounded-xl bg-brand-500/15 text-brand-400 flex items-center justify-center shrink-0">
              {trip.ride ? <span className="size-2.5 rounded-full bg-brand-400 radar-ring absolute" /> : null}
              {trip.ride ? <span className="size-2.5 rounded-full bg-brand-400" /> : <Radar className="size-[18px]" />}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[14px] font-semibold text-ink-50 truncate">{title}</span>
              {sub && <span className="block text-[12.5px] text-ink-300 truncate">{sub}</span>}
            </span>
            <ChevronRight className="size-5 text-ink-400 shrink-0" />
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
