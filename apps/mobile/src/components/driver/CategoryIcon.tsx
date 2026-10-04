import { Bike, CarFront, CarTaxiFront, Crown, Snowflake, type LucideIcon } from "lucide-react";
import type { VehicleCategory } from "@raahi/shared";

const ICONS: Record<VehicleCategory, LucideIcon> = {
  bike: Bike,
  rickshaw: CarTaxiFront,
  car: CarFront,
  car_ac: Snowflake,
  car_premium: Crown,
};

export function CategoryIcon({ category, className }: { category: VehicleCategory; className?: string }) {
  const Icon = ICONS[category];
  return <Icon className={className} strokeWidth={2.1} />;
}
