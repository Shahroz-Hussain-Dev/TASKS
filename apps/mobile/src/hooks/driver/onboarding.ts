/**
 * Pure helpers for the driver onboarding wizard and status views. No React so
 * it can be imported from components and screens alike.
 */
import {
  DOCUMENT_META,
  DOCUMENT_TYPES,
  VEHICLE_CATEGORY_META,
  type DocumentDto,
  type DocumentType,
  type DocumentVerificationStatus,
  type DriverDto,
  type DriverStatus,
  type SubscriptionStatus,
  type VehicleCategory,
} from "@raahi/shared";

export type WizardStep = "details" | "vehicle" | "documents" | "subscription" | "review";
export type WizardRoute = WizardStep | "status";

export interface WizardStepMeta {
  id: WizardStep;
  /** Short label under the progress rail. */
  label: string;
  /** Screen heading. */
  title: string;
  subtitle: string;
}

export const WIZARD_STEPS: readonly WizardStepMeta[] = [
  { id: "details", label: "Details", title: "Personal details", subtitle: "Your identity as it appears on your CNIC and license." },
  { id: "vehicle", label: "Vehicle", title: "Your vehicle", subtitle: "Fuel economy sets your personal break-even for every bid." },
  { id: "documents", label: "Documents", title: "Documents & KYC", subtitle: "Clear photos verify in seconds. Blurry ones get flagged." },
  { id: "subscription", label: "Payment", title: "Monthly subscription", subtitle: "One flat fee. Every rupee of every fare is yours." },
  { id: "review", label: "Review", title: "Review & submit", subtitle: "Check everything once, then send it for approval." },
] as const;

export const stepIndex = (step: WizardStep): number => WIZARD_STEPS.findIndex((s) => s.id === step);

export function stepComplete(driver: DriverDto | null, step: WizardStep): boolean {
  if (!driver) return false;
  switch (step) {
    case "details":
      return driver.onboarding.details;
    case "vehicle":
      return driver.onboarding.vehicle;
    case "documents":
      return driver.onboarding.documents;
    case "subscription":
      return driver.onboarding.subscription || driver.subscriptionActive;
    case "review":
      return driver.onboarding.submitted;
  }
}

export function completedSteps(driver: DriverDto | null): Set<WizardStep> {
  return new Set(WIZARD_STEPS.map((s) => s.id).filter((id) => stepComplete(driver, id)));
}

/** First step the driver still has to finish, or "review" when everything is in. */
export function firstIncompleteStep(driver: DriverDto | null): WizardStep {
  for (const s of WIZARD_STEPS) if (s.id !== "review" && !stepComplete(driver, s.id)) return s.id;
  return "review";
}

/** Where `/d/onboarding` should land. */
export function wizardEntry(driver: DriverDto | null): WizardRoute {
  if (!driver) return "details";
  if (driver.status !== "onboarding") return "status";
  return firstIncompleteStep(driver);
}

export function nextStep(step: WizardStep): WizardStep | null {
  const i = stepIndex(step);
  const next = WIZARD_STEPS[i + 1];
  return next ? next.id : null;
}

export function prevStep(step: WizardStep): WizardStep | null {
  const i = stepIndex(step);
  const prev = WIZARD_STEPS[i - 1];
  return prev ? prev.id : null;
}

/* ------------------------------------------------------------------ */
/* Documents                                                           */
/* ------------------------------------------------------------------ */

export type Tone = "neutral" | "brand" | "amber" | "rose" | "sky" | "violet";

export const DOC_STATUS_META: Record<DocumentVerificationStatus, { label: string; tone: Tone; blurb: string }> = {
  pending: { label: "Checking", tone: "sky", blurb: "Waiting for verification." },
  verified: { label: "Verified", tone: "brand", blurb: "Looks good. Nothing else to do here." },
  flagged: { label: "Needs review", tone: "amber", blurb: "Our team will take a look. You can retake it now to speed things up." },
  rejected: { label: "Rejected", tone: "rose", blurb: "Retake this photo before you submit." },
};

export function docFor(driver: DriverDto | null, type: DocumentType): DocumentDto | null {
  if (!driver) return null;
  const docs = driver.documents.filter((d) => d.type === type);
  if (docs.length === 0) return null;
  return docs.reduce((latest, d) => (new Date(d.uploadedAt).getTime() > new Date(latest.uploadedAt).getTime() ? d : latest));
}

export interface DocumentProgress {
  uploaded: number;
  required: number;
  verified: number;
  rejected: DocumentType[];
  flagged: DocumentType[];
  missing: DocumentType[];
  /** Every required document is present and none is rejected. */
  ready: boolean;
}

export function documentProgress(driver: DriverDto | null): DocumentProgress {
  const required = DOCUMENT_TYPES.filter((t) => DOCUMENT_META[t].required);
  const missing: DocumentType[] = [];
  const rejected: DocumentType[] = [];
  const flagged: DocumentType[] = [];
  let uploaded = 0;
  let verified = 0;
  for (const t of required) {
    const d = docFor(driver, t);
    if (!d) {
      missing.push(t);
      continue;
    }
    uploaded += 1;
    if (d.status === "verified") verified += 1;
    else if (d.status === "rejected") rejected.push(t);
    else if (d.status === "flagged") flagged.push(t);
  }
  const ready = Boolean(driver?.onboarding.documents) || (missing.length === 0 && rejected.length === 0);
  return { uploaded, required: required.length, verified, rejected, flagged, missing, ready };
}

/* ------------------------------------------------------------------ */
/* Status                                                              */
/* ------------------------------------------------------------------ */

export const DRIVER_STATUS_META: Record<DriverStatus, { label: string; tone: Tone }> = {
  onboarding: { label: "Onboarding", tone: "neutral" },
  under_review: { label: "Under review", tone: "amber" },
  approved: { label: "Approved", tone: "brand" },
  rejected: { label: "Rejected", tone: "rose" },
  suspended: { label: "Suspended", tone: "rose" },
};

export const SUBSCRIPTION_STATUS_META: Record<SubscriptionStatus, { label: string; tone: Tone }> = {
  pending: { label: "Under review", tone: "amber" },
  active: { label: "Active", tone: "brand" },
  expired: { label: "Expired", tone: "rose" },
  rejected: { label: "Rejected", tone: "rose" },
};

export const SUBSCRIPTION_METHODS = [
  { value: "jazzcash", label: "JazzCash" },
  { value: "easypaisa", label: "EasyPaisa" },
  { value: "bank", label: "Bank" },
  { value: "other", label: "Other" },
] as const;
export type SubscriptionMethod = (typeof SUBSCRIPTION_METHODS)[number]["value"];

/** Days left on the current subscription; null when there is none. Negative when expired. */
export function subscriptionDaysLeft(driver: DriverDto | null, now = Date.now()): number | null {
  const ends = driver?.subscription?.endsAt;
  if (!ends) return null;
  return Math.ceil((new Date(ends).getTime() - now) / 86_400_000);
}

/** Banner threshold from the design spec. */
export const SUBSCRIPTION_WARN_DAYS = 5;

/* ------------------------------------------------------------------ */
/* Reference data                                                      */
/* ------------------------------------------------------------------ */

export const PK_CITIES = ["Lahore", "Karachi", "Islamabad", "Rawalpindi", "Faisalabad", "Multan", "Peshawar", "Quetta", "Hyderabad", "Gujranwala", "Sialkot", "Sargodha", "Bahawalpur", "Sukkur", "Abbottabad"] as const;

export const VEHICLE_COLORS = ["White", "Silver", "Grey", "Black", "Blue", "Red", "Green", "Maroon", "Gold", "Beige"] as const;

export const CATEGORY_ORDER: readonly VehicleCategory[] = ["bike", "rickshaw", "car", "car_ac", "car_premium"];

export const categoryLabel = (c: VehicleCategory): string => VEHICLE_CATEGORY_META[c].label;

export const formatDay = (iso: string): string => new Date(iso).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" });
export const formatShortDay = (iso: string): string => new Date(iso).toLocaleDateString("en-PK", { day: "numeric", month: "short" });

/** Date input value (YYYY-MM-DD) from an ISO string or null. */
export const toDateInput = (iso: string | null | undefined): string => (iso ? iso.slice(0, 10) : "");

/** Google Maps / geo: intent for turn-by-turn navigation. */
export function navigationUrl(lat: number, lng: number, label: string, native: boolean): string {
  if (native) return `geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(label)})`;
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}
