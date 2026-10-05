/**
 * Raahi domain constants shared by the API, the admin panel and the mobile app.
 * Everything that describes "what the product is" lives here so the three
 * surfaces can never drift apart.
 */

export const APP_NAME = "Raahi";
export const APP_TAGLINE = "Your ride. Your price.";
export const CURRENCY = "PKR";
export const COUNTRY_CODE = "PK";
export const DEFAULT_DIAL_CODE = "+92";

/** Vehicle categories a passenger can request (mirrors inDrive Pakistan). */
export const VEHICLE_CATEGORIES = ["bike", "rickshaw", "car", "car_ac", "car_premium"] as const;
export type VehicleCategory = (typeof VEHICLE_CATEGORIES)[number];

export interface VehicleCategoryMeta {
  id: VehicleCategory;
  label: string;
  shortLabel: string;
  description: string;
  seats: number;
  /** Category-average fuel economy used for the passenger-side fare range. */
  avgKmPerLitre: number;
  /** Extra multiplier applied on top of the base fare for comfort tiers. */
  comfortMultiplier: number;
  icon: "bike" | "rickshaw" | "car" | "car-ac" | "car-premium";
}

export const VEHICLE_CATEGORY_META: Record<VehicleCategory, VehicleCategoryMeta> = {
  bike: {
    id: "bike",
    label: "Moto",
    shortLabel: "Bike",
    description: "Fastest in traffic. One passenger, helmet provided.",
    seats: 1,
    avgKmPerLitre: 45,
    comfortMultiplier: 1,
    icon: "bike",
  },
  rickshaw: {
    id: "rickshaw",
    label: "Rickshaw",
    shortLabel: "Rickshaw",
    description: "Classic auto-rickshaw. Up to 3 passengers.",
    seats: 3,
    avgKmPerLitre: 25,
    comfortMultiplier: 1,
    icon: "rickshaw",
  },
  car: {
    id: "car",
    label: "Ride",
    shortLabel: "Car",
    description: "Economy car. Up to 4 passengers.",
    seats: 4,
    avgKmPerLitre: 14,
    comfortMultiplier: 1,
    icon: "car",
  },
  car_ac: {
    id: "car_ac",
    label: "Ride AC",
    shortLabel: "AC Car",
    description: "Economy car with AC guaranteed.",
    seats: 4,
    avgKmPerLitre: 12,
    comfortMultiplier: 1.15,
    icon: "car-ac",
  },
  car_premium: {
    id: "car_premium",
    label: "Comfort",
    shortLabel: "Comfort",
    description: "Newer sedans & SUVs, top-rated drivers.",
    seats: 4,
    avgKmPerLitre: 10,
    comfortMultiplier: 1.4,
    icon: "car-premium",
  },
};

export const USER_ROLES = ["customer", "driver", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const DRIVER_STATUSES = [
  "onboarding", // account created, documents not yet complete
  "under_review", // documents submitted, awaiting AI/admin verification
  "approved",
  "rejected",
  "suspended",
] as const;
export type DriverStatus = (typeof DRIVER_STATUSES)[number];

export const DOCUMENT_TYPES = [
  "selfie",
  "cnic_front",
  "cnic_back",
  "driving_license",
  "route_permit",
  "vehicle_registration",
  "vehicle_photo",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_META: Record<DocumentType, { label: string; hint: string; required: boolean }> = {
  selfie: { label: "Live selfie", hint: "Face clearly visible, no sunglasses or cap.", required: true },
  cnic_front: { label: "CNIC — front", hint: "Government ID card, front side, all 13 digits readable.", required: true },
  cnic_back: { label: "CNIC — back", hint: "Back side with address and expiry.", required: true },
  driving_license: { label: "Driving license", hint: "Valid license matching your CNIC name.", required: true },
  route_permit: { label: "Route permit", hint: "Commercial route permit / fitness certificate.", required: true },
  vehicle_registration: { label: "Vehicle documents", hint: "Registration book or smart card, both sides if possible.", required: true },
  vehicle_photo: { label: "Vehicle photo", hint: "Front of the vehicle with number plate visible.", required: true },
};

export const DOCUMENT_VERIFICATION_STATUSES = ["pending", "verified", "flagged", "rejected"] as const;
export type DocumentVerificationStatus = (typeof DOCUMENT_VERIFICATION_STATUSES)[number];

export const SUBSCRIPTION_STATUSES = ["pending", "active", "expired", "rejected"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const RIDE_REQUEST_STATUSES = ["open", "accepted", "cancelled", "expired"] as const;
export type RideRequestStatus = (typeof RIDE_REQUEST_STATUSES)[number];

export const BID_STATUSES = ["pending", "accepted", "rejected", "withdrawn", "expired"] as const;
export type BidStatus = (typeof BID_STATUSES)[number];

export const RIDE_STATUSES = [
  "assigned", // driver heading to pickup
  "arrived", // driver at pickup
  "in_progress", // passenger on board
  "completed",
  "cancelled_by_customer",
  "cancelled_by_driver",
] as const;
export type RideStatus = (typeof RIDE_STATUSES)[number];

export const ACTIVE_RIDE_STATUSES: readonly RideStatus[] = ["assigned", "arrived", "in_progress"];

export const PAYMENT_METHODS = ["cash"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const CANCEL_REASONS_CUSTOMER = [
  "Driver is taking too long",
  "Driver asked to cancel",
  "Changed my plans",
  "Found another ride",
  "Wrong pickup location",
  "Other",
] as const;

export const CANCEL_REASONS_DRIVER = [
  "Passenger not at pickup",
  "Passenger asked to cancel",
  "Too many passengers / luggage",
  "Vehicle problem",
  "Unsafe pickup location",
  "Other",
] as const;

export const SUPPORT_TICKET_STATUSES = ["open", "awaiting_user", "resolved"] as const;
export type SupportTicketStatus = (typeof SUPPORT_TICKET_STATUSES)[number];

/** Timing rules of the marketplace (seconds unless stated). */
export const MARKET_RULES = {
  /** How long a ride request stays open before it expires. */
  requestTtlSeconds: 10 * 60,
  /** How long a driver's bid stays valid for the passenger to accept. */
  bidTtlSeconds: 60,
  /** Radius (km) around pickup in which drivers see the request. */
  matchRadiusKm: 8,
  /** A driver location older than this is treated as offline. */
  driverStaleSeconds: 90,
  /** Allowed bid increments shown as quick chips to the driver (fractions of the offer). */
  bidChipSteps: [0, 0.1, 0.2, 0.3] as const,
  /** Allowed quick raises shown to the passenger (absolute PKR). */
  raiseChipsPkr: [20, 50, 100] as const,
  /** Max number of concurrent pending bids per driver. */
  maxPendingBidsPerDriver: 5,
} as const;

/** Platform settings editable from the admin panel. Values here are defaults. */
export interface PlatformSettings {
  /** Current retail petrol price in PKR per litre (OGRA). */
  petrolPricePkr: number;
  /** Flat amount every ride must earn the driver on top of fuel (PKR). */
  driverFlatPkr: number;
  /** Per-minute component for the recommended fare (PKR / min). */
  perMinutePkr: number;
  /** Multiplier applied to fuel cost for the recommended fare. */
  recommendedFuelMultiplier: number;
  /** Max fare = recommended × this. */
  maxFareMultiplier: number;
  /** Fares are rounded to this step (PKR). */
  roundToPkr: number;
  /** Absolute minimum fare regardless of distance (PKR). */
  absoluteMinimumFarePkr: number;
  /** Monthly driver subscription (PKR). */
  driverSubscriptionPkr: number;
  /** Subscription length in days. */
  subscriptionDays: number;
  /** When true every uploaded receipt is accepted automatically (test mode). */
  autoApproveSubscriptionReceipts: boolean;
  /**
   * Test mode: drivers pay with a single tap (no receipt), documents are
   * accepted without the AI check, and drivers are approved the moment they
   * submit. Turn off before real launch.
   */
  testMode: boolean;
  /** Platform commission on rides. Raahi takes 0 — 100% goes to the driver. */
  commissionPercent: number;
  /** Where drivers send the subscription payment. */
  paymentInstructions: {
    accountTitle: string;
    jazzcash: string;
    easypaisa: string;
    bankName: string;
    bankAccount: string;
    iban: string;
    note: string;
  };
  matchRadiusKm: number;
  requestTtlSeconds: number;
  bidTtlSeconds: number;
  /** Minimum Gemini confidence (0-1) for a document to auto-verify. */
  autoVerifyConfidence: number;
  supportPhone: string;
  supportEmail: string;
}

export const DEFAULT_SETTINGS: PlatformSettings = {
  petrolPricePkr: 392.76, // OGRA notification effective 3 Oct 2026
  driverFlatPkr: 100,
  perMinutePkr: 2,
  recommendedFuelMultiplier: 1.15,
  maxFareMultiplier: 1.6,
  roundToPkr: 10,
  absoluteMinimumFarePkr: 100,
  driverSubscriptionPkr: 1000,
  subscriptionDays: 30,
  autoApproveSubscriptionReceipts: true,
  testMode: true,
  commissionPercent: 0,
  paymentInstructions: {
    accountTitle: "Raahi Technologies",
    jazzcash: "0300-0000000",
    easypaisa: "0300-0000000",
    bankName: "Meezan Bank",
    bankAccount: "0000-0000000000",
    iban: "PK00MEZN0000000000000000",
    note: "Send PKR 1,000 and upload a clear screenshot of the receipt. Your subscription activates instantly.",
  },
  matchRadiusKm: MARKET_RULES.matchRadiusKm,
  requestTtlSeconds: MARKET_RULES.requestTtlSeconds,
  bidTtlSeconds: MARKET_RULES.bidTtlSeconds,
  autoVerifyConfidence: 0.8,
  supportPhone: "+92 300 0000000",
  supportEmail: "support@raahi.pk",
};

/** Upload limits. Images are compressed client-side before upload. */
export const UPLOAD_LIMITS = {
  maxBytes: 1_500_000,
  maxDimension: 1280,
  allowedMime: ["image/jpeg", "image/png", "image/webp"] as const,
};

export const PASSWORD_MIN_LENGTH = 8;
export const RATING_MIN = 1;
export const RATING_MAX = 5;
