import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { api } from "@/lib/api";
import { dk, FEED_POLL_MS } from "./keys";
import { presence } from "./presence";

/**
 * Incoming requests near the driver, polled every 3 s while online. The
 * response also carries the server's view of `online`, which reconciles the
 * local presence flag (e.g. the server marked us stale after a long sleep).
 */
export function useDriverFeed(enabled: boolean) {
  const query = useQuery({
    queryKey: dk.feed,
    queryFn: ({ signal }) => api.driver.feed(signal),
    enabled,
    refetchInterval: enabled ? FEED_POLL_MS : false,
    refetchIntervalInBackground: false,
    staleTime: 1_000,
    placeholderData: keepPreviousData,
  });

  const serverOnline = query.data?.online;
  const readAt = query.dataUpdatedAt;
  useEffect(() => {
    if (serverOnline === undefined || !readAt) return;
    presence.reconcile(serverOnline, readAt);
  }, [serverOnline, readAt]);

  return query;
}
