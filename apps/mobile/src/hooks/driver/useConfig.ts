import { useQuery } from "@tanstack/react-query";
import { DEFAULT_SETTINGS, type PublicConfigDto } from "@raahi/shared";
import { qk } from "@/hooks/queryKeys";
import { api } from "@/lib/api";

const FALLBACK: PublicConfigDto["settings"] = {
  petrolPricePkr: DEFAULT_SETTINGS.petrolPricePkr,
  driverFlatPkr: DEFAULT_SETTINGS.driverFlatPkr,
  driverSubscriptionPkr: DEFAULT_SETTINGS.driverSubscriptionPkr,
  subscriptionDays: DEFAULT_SETTINGS.subscriptionDays,
  paymentInstructions: DEFAULT_SETTINGS.paymentInstructions,
  bidTtlSeconds: DEFAULT_SETTINGS.bidTtlSeconds,
  requestTtlSeconds: DEFAULT_SETTINGS.requestTtlSeconds,
  supportPhone: DEFAULT_SETTINGS.supportPhone,
  supportEmail: DEFAULT_SETTINGS.supportEmail,
  commissionPercent: DEFAULT_SETTINGS.commissionPercent,
  testMode: DEFAULT_SETTINGS.testMode,
};

/** Public platform settings (petrol price, subscription price, payment accounts). Falls back to the shared defaults offline. */
export function useConfig() {
  const query = useQuery({ queryKey: qk.config, queryFn: () => api.config(), staleTime: 5 * 60_000 });
  return { settings: query.data?.settings ?? FALLBACK, isLoading: query.isLoading, isFallback: !query.data, refetch: query.refetch };
}
