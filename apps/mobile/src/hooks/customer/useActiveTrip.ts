import { useQuery } from "@tanstack/react-query";
import type { RideDto, RideRequestDto } from "@raahi/shared";
import { isActiveRide } from "@/components/shared/meta";
import { api } from "@/lib/api";
import { ck } from "./keys";

export const ACTIVE_TRIP_POLL_MS = 6_000;

export interface ActiveTrip {
  /** Live ride (assigned / arrived / in progress), if any. */
  ride: RideDto | null;
  /** Open request still collecting offers, if any (and no live ride). */
  request: RideRequestDto | null;
  /** Where the banner should take the passenger, or null when nothing is going on. */
  target: string | null;
  active: boolean;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

/**
 * Polls the passenger's current marketplace state every 6 s. Shared by the
 * shell banner and the home screen; react-query dedupes the requests.
 */
export function useActiveTrip(enabled = true): ActiveTrip {
  const query = useQuery({
    queryKey: ck.activeTrip,
    queryFn: ({ signal }) => api.requests.active(signal),
    enabled,
    refetchInterval: ACTIVE_TRIP_POLL_MS,
    refetchIntervalInBackground: false,
    staleTime: 2_000,
  });

  const data = query.data;
  const ride = data?.ride && isActiveRide(data.ride.status) ? data.ride : null;
  const request = !ride && data?.request && data.request.status === "open" ? data.request : null;

  let target: string | null = null;
  if (ride) target = `/c/ride/${ride.id}`;
  else if (request) target = `/c/request/${request.id}`;
  else if (data?.request?.status === "accepted" && data.request.rideId) target = `/c/ride/${data.request.rideId}`;

  return {
    ride,
    request,
    target,
    active: target !== null,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => void query.refetch(),
  };
}
