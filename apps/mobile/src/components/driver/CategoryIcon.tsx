import { Car, Crown, Motorcycle, Snowflake, Taxi } from "@phosphor-icons/react";
import type { VehicleCategory } from "@raahi/shared";
import type { IconComponent } from "@/components/ui";

const ICONS: Record<VehicleCategory, IconComponent> = {
  bike: Motorcycle,
  rickshaw: Taxi,
  car: Car,
  car_ac: Snowflake,
  car_premium: Crown,
};

export function CategoryIcon({ category, className, weight = "duotone" }: { category: VehicleCategory; className?: string; weight?: "duotone" | "fill" }) {
  const Icon = ICONS[category];
  return <Icon className={className} weight={weight} />;
}
