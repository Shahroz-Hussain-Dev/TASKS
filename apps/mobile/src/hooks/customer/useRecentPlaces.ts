import { Preferences } from "@capacitor/preferences";
import { useCallback, useEffect, useState } from "react";
import { isValidLatLng, type Place } from "@raahi/shared";

const KEY = "raahi.recentPlaces";
export const MAX_RECENT_PLACES = 5;

function sanitise(value: unknown): Place[] {
  if (!Array.isArray(value)) return [];
  const out: Place[] = [];
  for (const v of value) {
    if (!v || typeof v !== "object") continue;
    const p = v as Partial<Place>;
    if (!isValidLatLng({ lat: p.lat, lng: p.lng }) || typeof p.lat !== "number" || typeof p.lng !== "number") continue;
    if (typeof p.address !== "string" || !p.address) continue;
    out.push({ lat: p.lat, lng: p.lng, address: p.address, name: typeof p.name === "string" && p.name ? p.name : undefined });
  }
  return out.slice(0, MAX_RECENT_PLACES);
}

/** Two places are "the same" when they sit within ~20 m of each other. */
const samePlace = (a: Place, b: Place) => Math.abs(a.lat - b.lat) < 0.0002 && Math.abs(a.lng - b.lng) < 0.0002;

export async function readRecentPlaces(): Promise<Place[]> {
  try {
    const { value } = await Preferences.get({ key: KEY });
    return value ? sanitise(JSON.parse(value)) : [];
  } catch {
    return [];
  }
}

async function write(places: Place[]): Promise<void> {
  try {
    await Preferences.set({ key: KEY, value: JSON.stringify(places) });
  } catch {
    /* storage unavailable: recents are a convenience only */
  }
}

/** Put a destination at the top of the recents, most recent first, max five. */
export async function pushRecentPlace(place: Place): Promise<Place[]> {
  const current = await readRecentPlaces();
  const next = [place, ...current.filter((p) => !samePlace(p, place))].slice(0, MAX_RECENT_PLACES);
  await write(next);
  return next;
}

export async function removeRecentPlace(place: Place): Promise<Place[]> {
  const current = await readRecentPlaces();
  const next = current.filter((p) => !samePlace(p, place));
  await write(next);
  return next;
}

/** Recent destinations persisted on the device (last five). */
export function useRecentPlaces() {
  const [places, setPlaces] = useState<Place[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void readRecentPlaces().then((p) => {
      if (!cancelled) setPlaces(p);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const add = useCallback(async (place: Place) => setPlaces(await pushRecentPlace(place)), []);
  const remove = useCallback(async (place: Place) => setPlaces(await removeRecentPlace(place)), []);

  return { places: places ?? [], loading: places === null, add, remove };
}
