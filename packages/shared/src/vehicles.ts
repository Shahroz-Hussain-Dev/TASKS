import type { VehicleCategory } from "./constants";

/**
 * Catalogue of vehicles common on Pakistani roads with real-world fuel economy
 * (km per litre, mixed city driving). Used by the fare engine so a driver can
 * see their personal break-even for every bid. Drivers may also enter a custom
 * model with their own km/L, which is flagged for admin review.
 */
export interface VehicleModel {
  id: string;
  make: string;
  model: string;
  kmPerLitre: number;
  /** Categories this vehicle is allowed to serve. */
  categories: VehicleCategory[];
  fuel: "petrol" | "hybrid" | "cng";
}

const car = (
  id: string,
  make: string,
  model: string,
  kmPerLitre: number,
  categories: VehicleCategory[] = ["car", "car_ac"],
  fuel: VehicleModel["fuel"] = "petrol",
): VehicleModel => ({ id, make, model, kmPerLitre, categories, fuel });

const bike = (id: string, make: string, model: string, kmPerLitre: number): VehicleModel => ({
  id,
  make,
  model,
  kmPerLitre,
  categories: ["bike"],
  fuel: "petrol",
});

const rickshaw = (id: string, make: string, model: string, kmPerLitre: number): VehicleModel => ({
  id,
  make,
  model,
  kmPerLitre,
  categories: ["rickshaw"],
  fuel: "cng",
});

export const VEHICLE_CATALOG: VehicleModel[] = [
  // ——— Suzuki ———
  car("suzuki-mehran", "Suzuki", "Mehran", 14),
  car("suzuki-alto", "Suzuki", "Alto", 18),
  car("suzuki-cultus", "Suzuki", "Cultus", 16),
  car("suzuki-wagonr", "Suzuki", "WagonR", 16),
  car("suzuki-swift", "Suzuki", "Swift", 14, ["car", "car_ac", "car_premium"]),
  car("suzuki-bolan", "Suzuki", "Bolan", 12, ["car"]),
  car("suzuki-every", "Suzuki", "Every", 14, ["car", "car_ac"]),
  car("suzuki-ciaz", "Suzuki", "Ciaz", 13, ["car", "car_ac", "car_premium"]),
  // ——— Toyota ———
  car("toyota-corolla", "Toyota", "Corolla", 12, ["car", "car_ac", "car_premium"]),
  car("toyota-yaris", "Toyota", "Yaris", 14, ["car", "car_ac", "car_premium"]),
  car("toyota-vitz", "Toyota", "Vitz", 17),
  car("toyota-passo", "Toyota", "Passo", 18),
  car("toyota-prius", "Toyota", "Prius", 22, ["car", "car_ac", "car_premium"], "hybrid"),
  car("toyota-aqua", "Toyota", "Aqua", 24, ["car", "car_ac", "car_premium"], "hybrid"),
  car("toyota-fortuner", "Toyota", "Fortuner", 8, ["car_premium"]),
  car("toyota-hilux", "Toyota", "Hilux", 9, ["car_premium"]),
  // ——— Honda ———
  car("honda-city", "Honda", "City", 13, ["car", "car_ac", "car_premium"]),
  car("honda-civic", "Honda", "Civic", 11, ["car_ac", "car_premium"]),
  car("honda-brv", "Honda", "BR-V", 11, ["car_ac", "car_premium"]),
  car("honda-vezel", "Honda", "Vezel", 18, ["car_ac", "car_premium"], "hybrid"),
  car("honda-fit", "Honda", "Fit", 20, ["car", "car_ac"], "hybrid"),
  // ——— Daihatsu ———
  car("daihatsu-mira", "Daihatsu", "Mira", 20),
  car("daihatsu-cuore", "Daihatsu", "Cuore", 16),
  car("daihatsu-move", "Daihatsu", "Move", 18),
  // ——— KIA / Hyundai ———
  car("kia-picanto", "KIA", "Picanto", 15),
  car("kia-sportage", "KIA", "Sportage", 10, ["car_ac", "car_premium"]),
  car("kia-stonic", "KIA", "Stonic", 13, ["car_ac", "car_premium"]),
  car("hyundai-elantra", "Hyundai", "Elantra", 12, ["car_ac", "car_premium"]),
  car("hyundai-sonata", "Hyundai", "Sonata", 10, ["car_premium"]),
  car("hyundai-tucson", "Hyundai", "Tucson", 10, ["car_ac", "car_premium"]),
  // ——— Chinese & others ———
  car("changan-alsvin", "Changan", "Alsvin", 14, ["car", "car_ac", "car_premium"]),
  car("changan-karvaan", "Changan", "Karvaan", 12, ["car"]),
  car("mg-zs", "MG", "ZS", 11, ["car_ac", "car_premium"]),
  car("mg-hs", "MG", "HS", 10, ["car_ac", "car_premium"]),
  car("proton-saga", "Proton", "Saga", 14, ["car", "car_ac"]),
  car("nissan-dayz", "Nissan", "Dayz", 18),
  car("mitsubishi-mirage", "Mitsubishi", "Mirage", 18),
  car("united-bravo", "United", "Bravo", 16),
  car("prince-pearl", "Prince", "Pearl", 16),
  car("faw-v2", "FAW", "V2", 14),
  car("dfsk-glory", "DFSK", "Glory 580", 10, ["car_ac", "car_premium"]),
  car("haval-h6", "Haval", "H6", 10, ["car_ac", "car_premium"]),
  // ——— Motorbikes ———
  bike("honda-cd70", "Honda", "CD 70", 55),
  bike("honda-pridor", "Honda", "Pridor", 50),
  bike("honda-cg125", "Honda", "CG 125", 45),
  bike("honda-cb150f", "Honda", "CB 150F", 35),
  bike("yamaha-ybr125", "Yamaha", "YBR 125", 45),
  bike("yamaha-yb125z", "Yamaha", "YB 125Z", 45),
  bike("suzuki-gs150", "Suzuki", "GS 150", 38),
  bike("suzuki-gd110", "Suzuki", "GD 110", 45),
  bike("united-us70", "United", "US 70", 55),
  bike("united-us125", "United", "US 125", 42),
  bike("road-prince-70", "Road Prince", "RP 70", 55),
  bike("super-power-70", "Super Power", "SP 70", 55),
  bike("unique-ud70", "Unique", "UD 70", 55),
  bike("metro-mr70", "Metro", "MR 70", 55),
  // ——— Rickshaws ———
  rickshaw("sazgar-rickshaw", "Sazgar", "Auto Rickshaw", 25),
  rickshaw("siwa-rickshaw", "Siwa", "Auto Rickshaw", 24),
  rickshaw("rozgar-rickshaw", "Rozgar", "Auto Rickshaw", 24),
  rickshaw("new-asia-rickshaw", "New Asia", "Auto Rickshaw", 24),
  rickshaw("tez-raftar-rickshaw", "Tez Raftar", "Auto Rickshaw", 23),
];

export const CUSTOM_VEHICLE_ID = "custom";

export function findVehicleModel(id: string): VehicleModel | undefined {
  return VEHICLE_CATALOG.find((v) => v.id === id);
}

export function vehiclesForCategory(category: VehicleCategory): VehicleModel[] {
  return VEHICLE_CATALOG.filter((v) => v.categories.includes(category));
}

export function searchVehicles(query: string): VehicleModel[] {
  const q = query.trim().toLowerCase();
  if (!q) return VEHICLE_CATALOG;
  return VEHICLE_CATALOG.filter((v) => `${v.make} ${v.model}`.toLowerCase().includes(q));
}
