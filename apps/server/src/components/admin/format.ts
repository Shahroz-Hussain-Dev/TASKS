import {
  DOCUMENT_META,
  VEHICLE_CATEGORY_META,
  type DocumentType,
  type DocumentVerificationStatus,
  type DriverStatus,
  type RideRequestStatus,
  type RideStatus,
  type SubscriptionStatus,
  type SupportTicketStatus,
  type VehicleCategory,
} from "@raahi/shared";

export function pkr(amount: number | null | undefined, opts: { compact?: boolean } = {}): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return "PKR —";
  if (opts.compact && Math.abs(amount) >= 1_000_000) return `PKR ${(amount / 1_000_000).toFixed(1)}M`;
  if (opts.compact && Math.abs(amount) >= 1000) return `PKR ${(amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1)}k`;
  return `PKR ${Math.round(amount).toLocaleString("en-PK")}`;
}

export const num = (n: number | null | undefined) => (n === null || n === undefined ? "—" : n.toLocaleString("en-PK"));

export function km(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${n < 10 ? n.toFixed(1) : Math.round(n)} km`;
}

export function minutes(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  if (n < 60) return `${Math.round(n)} min`;
  const h = Math.floor(n / 60);
  const m = Math.round(n % 60);
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

const TZ = "Asia/Karachi";
const dateTimeFmt = new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TZ });
const dateFmt = new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "short", year: "numeric", timeZone: TZ });
const timeFmt = new Intl.DateTimeFormat("en-PK", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: TZ });
const shortDayFmt = new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "short", timeZone: TZ });

function parseDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const fmtDateTime = (v: string | Date | null | undefined) => {
  const d = parseDate(v);
  return d ? dateTimeFmt.format(d) : "—";
};
export const fmtDate = (v: string | Date | null | undefined) => {
  const d = parseDate(v);
  return d ? dateFmt.format(d) : "—";
};
export const fmtTime = (v: string | Date | null | undefined) => {
  const d = parseDate(v);
  return d ? timeFmt.format(d) : "—";
};
/** "4 Oct" from a YYYY-MM-DD key (series axis). */
export const fmtDayKey = (key: string) => {
  const d = parseDate(`${key}T12:00:00Z`);
  return d ? shortDayFmt.format(d) : key;
};

export function timeAgo(v: string | Date | null | undefined, now = Date.now()): string {
  const d = parseDate(v);
  if (!d) return "—";
  const diff = Math.max(0, now - d.getTime());
  const s = Math.floor(diff / 1000);
  if (s < 45) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days} d ago`;
  return fmtDate(d);
}

export function daysUntil(v: string | null | undefined, now = Date.now()): number | null {
  const d = parseDate(v);
  if (!d) return null;
  return Math.ceil((d.getTime() - now) / 86_400_000);
}

export const categoryLabel = (c: VehicleCategory | null | undefined) => (c ? VEHICLE_CATEGORY_META[c].label : "—");
export const documentLabel = (t: DocumentType) => DOCUMENT_META[t].label;

export const initials = (name: string | null | undefined) =>
  (name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";

export const shortId = (id: string | null | undefined) => (id ? id.slice(0, 8) : "—");

/* ---- Status vocab (labels + tones) ---- */

export type Tone = "neutral" | "brand" | "amber" | "rose" | "sky" | "violet";

export const DRIVER_STATUS_LABEL: Record<DriverStatus, string> = {
  onboarding: "Onboarding",
  under_review: "Under review",
  approved: "Approved",
  rejected: "Rejected",
  suspended: "Suspended",
};
export const DRIVER_STATUS_TONE: Record<DriverStatus, Tone> = {
  onboarding: "neutral",
  under_review: "amber",
  approved: "brand",
  rejected: "rose",
  suspended: "violet",
};

export const RIDE_STATUS_LABEL: Record<RideStatus, string> = {
  assigned: "Driver en route",
  arrived: "Driver arrived",
  in_progress: "In progress",
  completed: "Completed",
  cancelled_by_customer: "Cancelled by passenger",
  cancelled_by_driver: "Cancelled by driver",
};
export const RIDE_STATUS_TONE: Record<RideStatus, Tone> = {
  assigned: "sky",
  arrived: "violet",
  in_progress: "amber",
  completed: "brand",
  cancelled_by_customer: "rose",
  cancelled_by_driver: "rose",
};

export const REQUEST_STATUS_LABEL: Record<RideRequestStatus, string> = {
  open: "Open",
  accepted: "Accepted",
  cancelled: "Cancelled",
  expired: "Expired",
};

export const DOC_STATUS_LABEL: Record<DocumentVerificationStatus, string> = {
  pending: "Pending",
  verified: "Verified",
  flagged: "Needs review",
  rejected: "Rejected",
};
export const DOC_STATUS_TONE: Record<DocumentVerificationStatus, Tone> = {
  pending: "neutral",
  verified: "brand",
  flagged: "amber",
  rejected: "rose",
};

export const SUB_STATUS_LABEL: Record<SubscriptionStatus, string> = {
  pending: "Pending",
  active: "Active",
  expired: "Expired",
  rejected: "Rejected",
};
export const SUB_STATUS_TONE: Record<SubscriptionStatus, Tone> = {
  pending: "amber",
  active: "brand",
  expired: "neutral",
  rejected: "rose",
};

export const TICKET_STATUS_LABEL: Record<SupportTicketStatus, string> = {
  open: "Open",
  awaiting_user: "Awaiting user",
  resolved: "Resolved",
};
export const TICKET_STATUS_TONE: Record<SupportTicketStatus, Tone> = {
  open: "amber",
  awaiting_user: "sky",
  resolved: "brand",
};

/** Validated categorical palette for the category mix (fixed order, never cycled). */
export const CATEGORY_COLORS: Record<VehicleCategory, string> = {
  bike: "#059669",
  rickshaw: "#d97706",
  car: "#0284c7",
  car_ac: "#e11d48",
  car_premium: "#8b5cf6",
};

export const cn = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");
