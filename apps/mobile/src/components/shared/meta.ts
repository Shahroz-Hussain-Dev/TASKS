/**
 * Pure presentation metadata for the shared screens: ride status labels,
 * notification deep-links, rating tags, quick replies and support prompts.
 * No React here so it can be imported from anywhere without refresh warnings.
 */
import { ACTIVE_RIDE_STATUSES, DEFAULT_SETTINGS, computeFare, type FareBreakdown, type NotificationDto, type PublicConfigDto, type RideDto, type RideStatus, type UserRole } from "@raahi/shared";

export type BadgeTone = "neutral" | "brand" | "amber" | "rose" | "sky" | "violet";

export interface RideStatusMeta {
  label: string;
  tone: BadgeTone;
  /** Sentence used as a headline on detail screens. */
  headline: string;
}

export const RIDE_STATUS_META: Record<RideStatus, RideStatusMeta> = {
  assigned: { label: "On the way", tone: "brand", headline: "Driver is on the way" },
  arrived: { label: "Arrived", tone: "brand", headline: "Driver has arrived" },
  in_progress: { label: "In progress", tone: "sky", headline: "Trip in progress" },
  completed: { label: "Completed", tone: "neutral", headline: "Trip completed" },
  cancelled_by_customer: { label: "Cancelled", tone: "rose", headline: "Cancelled by the passenger" },
  cancelled_by_driver: { label: "Cancelled", tone: "rose", headline: "Cancelled by the driver" },
};

export const isActiveRide = (status: RideStatus): boolean => ACTIVE_RIDE_STATUSES.includes(status);

/** Where the live ride screen lives for the viewer's role. */
export const liveRidePath = (role: UserRole, rideId: string): string => (role === "driver" ? `/d/ride/${rideId}` : `/c/ride/${rideId}`);

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

/** Resolve the screen a notification should open, or null when it is informational. */
export function notificationTarget(n: NotificationDto, role: UserRole): string | null {
  const data = n.data ?? {};
  const rideId = str(data.rideId);
  const requestId = str(data.requestId);
  const ticketId = str(data.ticketId);
  switch (n.type) {
    case "new_bid":
      return requestId ? `/c/request/${requestId}` : null;
    case "bid_accepted":
    case "driver_arrived":
    case "ride_started":
      return rideId ? liveRidePath(role, rideId) : null;
    case "chat":
      return rideId ? `/rides/${rideId}/chat` : null;
    case "ride_completed":
    case "ride_cancelled":
      return rideId ? `/rides/${rideId}` : null;
    case "bid_rejected":
    case "request_cancelled":
      return role === "driver" ? "/d/home" : "/c/home";
    case "driver_approved":
    case "driver_under_review":
    case "driver_rejected":
      return "/d";
    case "subscription_active":
    case "subscription_pending":
    case "subscription_rejected":
    case "subscription_expiring":
      return "/d/subscription";
    case "support_reply":
      return "/support";
    default:
      if (ticketId) return "/support";
      if (rideId) return `/rides/${rideId}`;
      if (requestId) return role === "customer" ? `/c/request/${requestId}` : "/d/home";
      return null;
  }
}

export type NotificationIcon = "bid" | "ride" | "chat" | "shield" | "receipt" | "support" | "bell";

export function notificationIcon(type: string): NotificationIcon {
  if (type === "new_bid" || type === "bid_accepted" || type === "bid_rejected") return "bid";
  if (type.startsWith("ride_") || type === "driver_arrived" || type === "request_cancelled") return "ride";
  if (type === "chat") return "chat";
  if (type.startsWith("driver_")) return "shield";
  if (type.startsWith("subscription_")) return "receipt";
  if (type.startsWith("support")) return "support";
  return "bell";
}

/* ------------------------------------------------------------------ */
/* Ratings                                                             */
/* ------------------------------------------------------------------ */

export const RATING_TAGS: Record<"customer" | "driver", { positive: readonly string[]; negative: readonly string[] }> = {
  customer: {
    positive: ["Polite", "Clean car", "Safe driving", "On time", "Good route", "Fair price"],
    negative: ["Late", "Rude", "Unsafe driving", "Dirty car", "Long route", "Asked for more"],
  },
  driver: {
    positive: ["On time", "Friendly", "Clear pickup", "Paid promptly", "Respectful"],
    negative: ["Late to pickup", "Rude", "Wrong location", "Extra passengers", "Didn't pay fully"],
  },
};

export const STAR_LABELS: Record<number, string> = {
  1: "Poor",
  2: "Fair",
  3: "Okay",
  4: "Good",
  5: "Excellent",
};

/* ------------------------------------------------------------------ */
/* Chat                                                                */
/* ------------------------------------------------------------------ */

export const QUICK_REPLIES: Record<"customer" | "driver", readonly string[]> = {
  customer: ["I'm here", "2 minutes", "Call me", "Where are you?", "Waiting at the gate"],
  driver: ["I'm here", "2 minutes away", "Call me", "Stuck in traffic", "Please come to the road"],
};

export const SUPPORT_SUGGESTIONS: Record<"customer" | "driver" | "admin", readonly string[]> = {
  customer: ["How does bidding work?", "How do I pay the driver?", "I left something in the car", "My driver cancelled on me", "How do I become a driver?"],
  driver: ["When will my documents be approved?", "How do I renew my subscription?", "Passenger didn't show up", "How is the fare range calculated?", "How do I go online?"],
  admin: ["How does bidding work?", "How do I pay the driver?"],
};

/* ------------------------------------------------------------------ */
/* Fare                                                                */
/* ------------------------------------------------------------------ */

/**
 * Re-run the fare engine for a finished ride so the detail screen can show
 * what the fare covered (fuel, driver flat, time). Uses live petrol price and
 * driver flat from the public config when available, platform defaults otherwise.
 */
export function estimateRideBreakdown(ride: Pick<RideDto, "distanceKm" | "durationMin" | "category">, config?: PublicConfigDto | null): FareBreakdown {
  return computeFare({
    distanceKm: ride.distanceKm,
    durationMin: ride.durationMin,
    category: ride.category,
    settings: {
      ...DEFAULT_SETTINGS,
      petrolPricePkr: config?.settings.petrolPricePkr ?? DEFAULT_SETTINGS.petrolPricePkr,
      driverFlatPkr: config?.settings.driverFlatPkr ?? DEFAULT_SETTINGS.driverFlatPkr,
    },
  });
}

/** Short "Suzuki Alto · White · LEA 1234" line for a driver's vehicle. */
export function vehicleLine(v: { make: string; model: string; color?: string; plate?: string } | null | undefined): string | null {
  if (!v) return null;
  return [`${v.make} ${v.model}`.trim(), v.color, v.plate].filter((x): x is string => Boolean(x && x.length)).join(" · ");
}

/** Day bucket for grouped lists. */
export function dayLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const t = d.getTime();
  if (t >= startOfToday) return "Today";
  if (t >= startOfToday - 86_400_000) return "Yesterday";
  return d.toLocaleDateString("en-PK", { weekday: "short", day: "numeric", month: "short" });
}

export function timeOfDay(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-PK", { hour: "numeric", minute: "2-digit" });
}

/** Mask all but the last 4 characters of an id for human-friendly references. */
export const shortId = (id: string): string => id.replace(/-/g, "").slice(-6).toUpperCase();
