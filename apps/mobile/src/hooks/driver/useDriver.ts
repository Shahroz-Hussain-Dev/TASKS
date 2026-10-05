import { useMutation, useQuery, useQueryClient, type UseMutationOptions } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import type { DriverDto } from "@raahi/shared";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { dk } from "./keys";

/**
 * The driver profile, kept in sync between react-query (fresh from the server)
 * and the auth context (persisted, available offline and to other screens).
 */
export function useDriver(options: { refetchInterval?: number | false } = {}) {
  const { driver: cached, setDriver } = useAuth();
  const query = useQuery({
    queryKey: dk.driver,
    queryFn: () => api.driver.get(),
    staleTime: 15_000,
    refetchInterval: options.refetchInterval ?? false,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    if (query.data && query.data !== cached) setDriver(query.data);
  }, [query.data, cached, setDriver]);

  return { driver: query.data ?? cached, query, setDriver };
}

/** Writes an updated DriverDto into both caches after an onboarding mutation. */
export function useApplyDriver() {
  const { setDriver } = useAuth();
  const queryClient = useQueryClient();
  return useCallback(
    (d: DriverDto) => {
      setDriver(d);
      queryClient.setQueryData(dk.driver, d);
    },
    [setDriver, queryClient],
  );
}

/** useMutation for any `api.driver.*` call that returns the DriverDto; applies the result to both caches. */
export function useDriverMutation<TVariables>(
  mutationFn: (vars: TVariables) => Promise<DriverDto>,
  options: Omit<UseMutationOptions<DriverDto, Error, TVariables>, "mutationFn"> = {},
) {
  const apply = useApplyDriver();
  return useMutation<DriverDto, Error, TVariables>({
    ...options,
    mutationFn,
    onSuccess: (data, vars, ctx, mutation) => {
      apply(data);
      options.onSuccess?.(data, vars, ctx, mutation);
    },
  });
}
