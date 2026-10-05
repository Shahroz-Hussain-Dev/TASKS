import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Clock, GpsFix, MagnifyingGlass, MapPin, MapPinLine, MapTrifold, X } from "@phosphor-icons/react";
import { useEffect, useState, type ReactNode } from "react";
import type { LatLng, Place } from "@raahi/shared";
import { Button, EmptyState, Input, Sheet, Skeleton, useToast } from "@/components/ui";
import { useRecentPlaces } from "@/hooks/customer/useRecentPlaces";
import { api } from "@/lib/api";
import { item, spring, stagger } from "@/lib/motion";
import { getCurrentLocation, haptic } from "@/lib/native";
import { cn, errorMessage } from "@/lib/utils";

export interface PlaceSearchProps {
  open: boolean;
  onClose: () => void;
  /** Which field is being edited — affects the title and pin colour. */
  target: "pickup" | "dropoff";
  initialQuery?: string;
  near?: { lat: number; lng: number } | null;
  onPick: (place: Place) => void;
  /** Lets the user drop a pin on the map instead of searching. */
  onPickOnMap?: () => void;
}

const DEBOUNCE_MS = 350;
const MIN_QUERY = 2;

/** Coarse (~100 m) key so the search cache is not busted by GPS jitter. */
const nearKey = (p: LatLng | null | undefined) => (p ? `${p.lat.toFixed(3)},${p.lng.toFixed(3)}` : "none");

/**
 * Cream bottom sheet for picking a place: debounced Photon autocomplete, the
 * device's current location, recent destinations and a hand-off to the map
 * picker. Results stagger in from below as they arrive.
 */
export default function PlaceSearch({ open, onClose, target, initialQuery, near, onPick, onPickOnMap }: PlaceSearchProps) {
  const toast = useToast();
  const recents = useRecentPlaces();
  const [query, setQuery] = useState(initialQuery ?? "");
  const [debounced, setDebounced] = useState((initialQuery ?? "").trim());
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuery(initialQuery ?? "");
    setDebounced((initialQuery ?? "").trim());
  }, [open, initialQuery]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [query]);

  const searching = debounced.length >= MIN_QUERY;
  const results = useQuery({
    queryKey: ["geo", "search", debounced, nearKey(near)],
    queryFn: ({ signal }) => api.geo.search(debounced, near ?? null, signal),
    enabled: open && searching,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    retry: 1,
  });

  const pick = (place: Place) => {
    haptic.light();
    onPick(place);
  };

  const pickCurrentLocation = async () => {
    setLocating(true);
    try {
      const fix = (await getCurrentLocation()) ?? near ?? null;
      if (!fix) {
        toast({ title: "Location unavailable", body: "Turn on GPS or search for your pickup point instead.", tone: "error" });
        return;
      }
      let address = "Current location";
      let name: string | undefined = "Current location";
      try {
        const r = await api.geo.reverse(fix);
        address = r.address;
        name = r.name || undefined;
      } catch {
        /* keep the generic label; coordinates are what matter */
      }
      pick({ lat: fix.lat, lng: fix.lng, address, name });
    } finally {
      setLocating(false);
    }
  };

  const title = target === "pickup" ? "Pickup location" : "Where to?";
  const accent = target === "pickup" ? "text-teal-600 bg-teal-100" : "text-coral-600 bg-coral-100";
  const items = results.data?.items ?? [];
  const showResultSkeleton = searching && results.isLoading && items.length === 0;

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-3 pb-2 min-h-[56vh]">
        <Input
          autoFocus
          icon={MagnifyingGlass}
          placeholder={target === "pickup" ? "Search a landmark, road or area" : "Search your destination"}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          right={
            query ? (
              <motion.button type="button" aria-label="Clear" initial={{ scale: 0 }} animate={{ scale: 1 }} whileTap={{ scale: 0.8 }} transition={spring} onClick={() => setQuery("")} className="size-7 rounded-full bg-paper-200 text-ink-600 flex items-center justify-center">
                <X className="size-4" weight="bold" />
              </motion.button>
            ) : undefined
          }
        />

        <AnimatePresence mode="wait" initial={false}>
          {searching ? (
            <motion.div key="results" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={spring} className="flex flex-col gap-1">
              {showResultSkeleton ? (
                <RowSkeletons />
              ) : results.isError && items.length === 0 ? (
                <EmptyState icon={MapPinLine} tone="coral" title="Search isn't available right now" body={errorMessage(results.error, "Check your connection and try again.")} action={<Button variant="secondary" size="md" onClick={() => void results.refetch()}>Try again</Button>} />
              ) : items.length === 0 && !results.isFetching ? (
                <EmptyState icon={MapPinLine} tone="sun" title="No places found" body="Try a well-known landmark, a road name or an area." action={onPickOnMap ? <Button variant="secondary" size="md" icon={MapTrifold} onClick={onPickOnMap}>Choose on map instead</Button> : undefined} />
              ) : (
                <motion.ul variants={stagger(0.045, 0)} initial="hidden" animate="show" className={cn("flex flex-col gap-1", results.isFetching && "opacity-70 transition-opacity")}>
                  <AnimatePresence initial={false}>
                    {items.map((r, i) => (
                      <PlaceRow key={`${r.lat},${r.lng},${i}`} icon={<MapPin className="size-[22px]" weight="duotone" />} iconClass={accent} title={r.name || r.address} sub={r.name && r.name !== r.address ? r.address : r.type ? humanType(r.type) : undefined} onClick={() => pick({ lat: r.lat, lng: r.lng, address: r.address || r.name, name: r.name || undefined })} />
                    ))}
                  </AnimatePresence>
                  {onPickOnMap && <PlaceRow key="map" icon={<MapTrifold className="size-[22px]" weight="duotone" />} iconClass="text-lavender-600 bg-lavender-100" title="Choose on map" sub="Drop a pin exactly where you want" onClick={onPickOnMap} />}
                </motion.ul>
              )}
            </motion.div>
          ) : (
            <motion.div key="idle" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={spring} className="flex flex-col gap-3">
              <motion.ul variants={stagger(0.06)} initial="hidden" animate="show" className="flex flex-col gap-1">
                {(near || target === "pickup") && <PlaceRow icon={<GpsFix className={cn("size-[22px]", locating && "animate-pulse")} weight="duotone" />} iconClass="text-sky-600 bg-sky-100" title={locating ? "Finding you…" : "Use my current location"} sub="Pinpointed by GPS" onClick={() => void pickCurrentLocation()} disabled={locating} />}
                {onPickOnMap && <PlaceRow icon={<MapTrifold className="size-[22px]" weight="duotone" />} iconClass="text-lavender-600 bg-lavender-100" title="Choose on map" sub="Drop a pin exactly where you want" onClick={onPickOnMap} />}
              </motion.ul>

              {recents.loading ? (
                <RowSkeletons count={2} />
              ) : recents.places.length > 0 ? (
                <div className="flex flex-col gap-1">
                  <p className="px-1 text-[11.5px] font-extrabold uppercase tracking-[0.16em] text-ink-400 mt-1">Recent</p>
                  <motion.ul variants={stagger(0.05, 0.1)} initial="hidden" animate="show" className="flex flex-col gap-1">
                    <AnimatePresence initial={false}>
                      {recents.places.map((p) => (
                        <PlaceRow key={`${p.lat},${p.lng}`} icon={<Clock className="size-[22px]" weight="duotone" />} iconClass="text-ink-500 bg-paper-100" title={p.name ?? p.address} sub={p.name && p.name !== p.address ? p.address : undefined} onClick={() => pick(p)} onRemove={() => void recents.remove(p)} />
                      ))}
                    </AnimatePresence>
                  </motion.ul>
                </div>
              ) : (
                <motion.p variants={item.fade} initial="hidden" animate="show" className="px-1 pt-2 text-[13.5px] text-ink-500 leading-relaxed font-medium">
                  Type at least two letters to search. Places you travel to will show up here for one-tap booking.
                </motion.p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Sheet>
  );
}

/** Photon feature types → friendly captions. */
function humanType(type: string): string | undefined {
  switch (type) {
    case "house":
      return "Address";
    case "street":
      return "Road";
    case "district":
    case "locality":
      return "Area";
    case "city":
      return "City";
    default:
      return undefined;
  }
}

function PlaceRow({ icon, iconClass, title, sub, onClick, onRemove, disabled }: { icon: ReactNode; iconClass: string; title: string; sub?: string; onClick: () => void; onRemove?: () => void; disabled?: boolean }) {
  return (
    <motion.li layout variants={item.up} exit={{ opacity: 0, x: -24, height: 0, transition: { duration: 0.18 } }} className="list-none flex items-center gap-1">
      <motion.button type="button" whileTap={{ scale: 0.985 }} transition={spring} onClick={onClick} disabled={disabled} className="flex-1 min-w-0 flex items-center gap-3 rounded-2xl px-2 py-2.5 text-left hover:bg-white transition-colors disabled:opacity-60">
        <span className={cn("size-11 rounded-full flex items-center justify-center shrink-0", iconClass)}>{icon}</span>
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] font-extrabold text-ink-900 truncate leading-snug">{title}</span>
          {sub && <span className="block text-[12.5px] text-ink-500 truncate font-medium">{sub}</span>}
        </span>
      </motion.button>
      {onRemove && (
        <motion.button type="button" aria-label="Remove from recent" whileTap={{ scale: 0.8 }} transition={spring} onClick={onRemove} className="size-9 rounded-full flex items-center justify-center text-ink-300 hover:text-ink-600">
          <X className="size-4" weight="bold" />
        </motion.button>
      )}
    </motion.li>
  );
}

function RowSkeletons({ count = 4 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2 px-1 py-1">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-1.5">
          <Skeleton className="size-11 rounded-full" />
          <div className="flex-1 flex flex-col gap-1.5">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
