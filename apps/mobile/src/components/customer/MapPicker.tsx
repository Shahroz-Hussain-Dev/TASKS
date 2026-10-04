import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Check, LocateFixed, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { LatLng, Place } from "@raahi/shared";
import { MapView, type MapHandle } from "@/components/Map";
import { Button, IconButton, Skeleton } from "@/components/ui";
import { ck } from "@/hooks/customer/keys";
import "@/hooks/customer/mapRuntime";
import { MapSurfaceGuard } from "./MapSurfaceGuard";
import { api } from "@/lib/api";
import { DEFAULT_CENTER } from "@/lib/config";
import { item, spring, springSoft, stagger } from "@/lib/motion";
import { getCurrentLocation, haptic } from "@/lib/native";

/**
 * "Choose on map": a full-screen map with a pin fixed at the centre. The pin
 * lifts while the map moves and settles when it stops; the address under it is
 * reverse-geocoded once the camera is still.
 */
export function MapPicker({ open, target, initial, onClose, onConfirm }: { open: boolean; target: "pickup" | "dropoff"; initial: LatLng | null; onClose: () => void; onConfirm: (place: Place) => void }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div key="picker" initial={{ y: "8%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "6%", opacity: 0, transition: { duration: 0.2 } }} transition={springSoft} className="fixed inset-0 z-50 bg-ink-900">
          <PickerBody target={target} initial={initial ?? DEFAULT_CENTER} onClose={onClose} onConfirm={onConfirm} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PickerBody({ target, initial, onClose, onConfirm }: { target: "pickup" | "dropoff"; initial: LatLng; onClose: () => void; onConfirm: (place: Place) => void }) {
  const mapRef = useRef<MapHandle>(null);
  const [center, setCenter] = useState<LatLng>(initial);
  const [moving, setMoving] = useState(false);
  const [locating, setLocating] = useState(false);
  const colour = target === "pickup" ? "#34d399" : "#fbbf24";

  const reverse = useQuery({
    queryKey: ck.reverse(center),
    queryFn: () => api.geo.reverse(center),
    enabled: !moving,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  useEffect(() => {
    if (!moving && reverse.data) haptic.tick();
  }, [moving, reverse.data]);

  const locateMe = async () => {
    setLocating(true);
    const fix = await getCurrentLocation();
    setLocating(false);
    if (fix) mapRef.current?.flyTo(fix, 16.5);
  };

  const confirm = () => {
    const fallback = `Dropped pin (${center.lat.toFixed(5)}, ${center.lng.toFixed(5)})`;
    haptic.success();
    onConfirm({ lat: center.lat, lng: center.lng, address: reverse.data?.address ?? fallback, name: reverse.data?.name ?? undefined });
  };

  const addressReady = !moving && !!reverse.data;

  return (
    <div className="relative h-full w-full">
      <MapView ref={mapRef} center={initial} zoom={16} onMoveStart={() => setMoving(true)} onMoveEnd={(c) => {
        setCenter(c);
        setMoving(false);
      }}>
        <MapSurfaceGuard />
      </MapView>

      {/* Centre pin — tip sits exactly on the map centre */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 flex flex-col items-center" style={{ marginTop: -44 }} aria-hidden>
        <motion.div animate={{ y: moving ? -14 : 0 }} transition={spring} className="flex flex-col items-center">
          <div className="size-6 rounded-full border-[3px] border-ink-950 shadow-float" style={{ background: colour }} />
          <div className="w-[3px] h-5 rounded-full -mt-0.5" style={{ background: colour }} />
        </motion.div>
        <motion.div animate={{ scale: moving ? 0.5 : 1, opacity: moving ? 0.35 : 0.7 }} transition={spring} className="size-2.5 rounded-full bg-ink-950 blur-[1.5px] -mt-0.5" />
      </div>

      <motion.div variants={stagger(0.07)} initial="hidden" animate="show" className="absolute inset-0 pointer-events-none flex flex-col" style={{ paddingTop: "calc(var(--safe-top) + 12px)", paddingBottom: "calc(var(--safe-bottom) + 16px)" }}>
        <motion.div variants={item.down} className="flex items-center justify-between px-4 pointer-events-auto">
          <IconButton icon={X} label="Close" onClick={onClose} />
          <span className="glass rounded-full px-4 h-10 inline-flex items-center text-[14px] font-semibold text-ink-50 shadow-card">{target === "pickup" ? "Set pickup point" : "Set destination"}</span>
          <IconButton icon={LocateFixed} label="My location" onClick={() => void locateMe()} className={locating ? "animate-pulse" : undefined} />
        </motion.div>

        <motion.div variants={item.up} className="mt-auto px-4 pointer-events-auto">
          <div className="glass rounded-3xl shadow-float p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ background: colour }} />
              <span className="text-[11.5px] font-bold uppercase tracking-[0.16em] text-ink-400">{target === "pickup" ? "Pickup" : "Destination"}</span>
              <span className="ml-auto text-[11.5px] text-ink-500 tabular-nums">
                {center.lat.toFixed(5)}, {center.lng.toFixed(5)}
              </span>
            </div>
            <div className="min-h-[44px]">
              <AnimatePresence mode="wait" initial={false}>
                {moving || reverse.isLoading ? (
                  <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-1.5 pt-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </motion.div>
                ) : reverse.data ? (
                  <motion.div key={`${center.lat}-${center.lng}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={spring}>
                    <p className="font-display text-[17px] font-semibold text-ink-50 leading-snug">{reverse.data.name || reverse.data.address}</p>
                    {reverse.data.name && reverse.data.name !== reverse.data.address && <p className="text-[13px] text-ink-300 mt-0.5 leading-snug">{reverse.data.address}</p>}
                  </motion.div>
                ) : (
                  <motion.div key="fallback" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <p className="font-display text-[16px] font-semibold text-ink-50">Dropped pin</p>
                    <p className="text-[13px] text-ink-400 mt-0.5">We couldn't look up this address, but you can still use the spot.</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <p className="text-[12.5px] text-ink-400">Drag the map until the pin sits exactly where you'll {target === "pickup" ? "wait" : "get off"}.</p>
            <Button full size="xl" icon={Check} disabled={moving} variant={target === "pickup" ? "primary" : "amber"} onClick={confirm}>
              {addressReady ? (target === "pickup" ? "Confirm pickup" : "Confirm destination") : "Use this spot"}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
