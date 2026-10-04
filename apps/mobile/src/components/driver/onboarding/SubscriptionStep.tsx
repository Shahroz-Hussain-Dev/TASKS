import type { DriverDto } from "@raahi/shared";
import { SubscriptionForm } from "@/components/driver/SubscriptionForm";
import { useApplyDriver } from "@/hooks/driver/useDriver";

/** Step 4 — pay the monthly subscription and upload the receipt. */
export function SubscriptionStep({ driver, onNext }: { driver: DriverDto; onNext: () => void }) {
  const apply = useApplyDriver();
  return <SubscriptionForm driver={driver} mode="onboarding" onSaved={apply} onContinue={onNext} className="pb-4" />;
}
