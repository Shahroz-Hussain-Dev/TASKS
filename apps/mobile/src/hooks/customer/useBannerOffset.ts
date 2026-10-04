import { useOnline } from "@/hooks/useOnline";
import { useActiveTrip } from "./useActiveTrip";

/** Height the active-trip banner occupies when visible. */
export const ACTIVE_TRIP_BANNER_HEIGHT = 66;
/** Height of the shared offline strip, which stacks above the trip banner. */
export const OFFLINE_BANNER_HEIGHT = 54;

/**
 * Extra top inset (px) the tab screens add under the safe area so their
 * greeting / title never sits beneath the offline strip or the trip banner.
 */
export function useBannerOffset(): number {
  const online = useOnline();
  const trip = useActiveTrip();
  return (online ? 0 : OFFLINE_BANNER_HEIGHT) + (trip.active ? ACTIVE_TRIP_BANNER_HEIGHT : 0);
}
