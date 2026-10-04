import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { isActiveRide } from "@/components/shared/meta";
import { qk } from "@/hooks/queryKeys";
import { api } from "@/lib/api";
import { ACTIVE_RIDE_POLL_MS, dk } from "./keys";
import { useDriverPresence } from "./presence";

/**
 * Sends the driver to the live ride screen the moment a passenger accepts one
 * of their offers. Two signals feed it: `/api/rides/active` (polled every 5 s
 * while `poll` is true, fetched once otherwise) and the `activeRideId` echoed
 * by location pings, which triggers an immediate confirmation fetch.
 */
export function useActiveRideRedirect(poll: boolean) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const queryClient = useQueryClient();
  const { activeRideId: pingedRideId } = useDriverPresence();

  const query = useQuery({
    queryKey: dk.activeRide,
    queryFn: () => api.rides.active(),
    refetchInterval: poll ? ACTIVE_RIDE_POLL_MS : false,
    refetchIntervalInBackground: false,
    staleTime: 2_000,
  });

  useEffect(() => {
    if (pingedRideId) void queryClient.invalidateQueries({ queryKey: dk.activeRide });
  }, [pingedRideId, queryClient]);

  const ride = query.data?.ride && isActiveRide(query.data.ride.status) ? query.data.ride : null;
  const rideId = ride?.id ?? (query.data ? null : pingedRideId);

  useEffect(() => {
    if (ride) queryClient.setQueryData(qk.ride(ride.id), ride);
  }, [ride, queryClient]);

  useEffect(() => {
    if (!rideId) return;
    const target = `/d/ride/${rideId}`;
    if (pathname !== target) navigate(target, { replace: true });
  }, [rideId, pathname, navigate]);

  return { ride, isLoading: query.isLoading };
}
