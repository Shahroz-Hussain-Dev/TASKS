import { z } from "zod";
import {
  CANCEL_REASONS_CUSTOMER,
  CANCEL_REASONS_DRIVER,
  DOCUMENT_TYPES,
  PASSWORD_MIN_LENGTH,
  RATING_MAX,
  RATING_MIN,
  VEHICLE_CATEGORIES,
} from "./constants";
import { normalizeCnic, normalizePkPhone, normalizePlate } from "./phone";

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

export const phoneSchema = z
  .string()
  .trim()
  .min(7, "Enter your mobile number")
  .transform((v, ctx) => {
    const n = normalizePkPhone(v);
    if (!n) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid Pakistani mobile number (03XX XXXXXXX)" });
      return z.NEVER;
    }
    return n;
  });

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(128, "Password is too long");

export const fullNameSchema = z
  .string()
  .trim()
  .min(3, "Enter your full name")
  .max(80, "Name is too long")
  .regex(/^[\p{L}\p{M} .'-]+$/u, "Name can only contain letters");

export const optionalEmailSchema = z
  .union([z.literal(""), z.string().trim().email("Enter a valid email")])
  .optional()
  .transform((v) => (v ? v.toLowerCase() : undefined));

export const cnicSchema = z.string().transform((v, ctx) => {
  const n = normalizeCnic(v);
  if (!n) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "CNIC must be 13 digits" });
    return z.NEVER;
  }
  return n;
});

export const plateSchema = z.string().transform((v, ctx) => {
  const n = normalizePlate(v);
  if (!n) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid number plate" });
    return z.NEVER;
  }
  return n;
});

export const latLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const placeSchema = latLngSchema.extend({
  address: z.string().trim().min(1).max(300),
  name: z.string().trim().max(120).optional(),
});

export const vehicleCategorySchema = z.enum(VEHICLE_CATEGORIES);
export const documentTypeSchema = z.enum(DOCUMENT_TYPES);
export const uuidSchema = z.string().uuid();
export const moneySchema = z.number().int().min(0).max(1_000_000);

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

export const customerSignupSchema = z.object({
  fullName: fullNameSchema,
  phone: phoneSchema,
  email: optionalEmailSchema,
  password: passwordSchema,
});

export const driverSignupSchema = z.object({
  fullName: fullNameSchema,
  phone: phoneSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1, "Enter your password"),
  role: z.enum(["customer", "driver"]),
});

export const adminLoginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({ refreshToken: z.string().min(20) });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export const updateProfileSchema = z.object({
  fullName: fullNameSchema.optional(),
  email: optionalEmailSchema,
  avatarFileId: uuidSchema.nullable().optional(),
});

/* ------------------------------------------------------------------ */
/* Driver onboarding                                                   */
/* ------------------------------------------------------------------ */

export const vehicleUpsertSchema = z.object({
  category: vehicleCategorySchema,
  catalogId: z.string().min(1).max(60),
  make: z.string().trim().min(1).max(40),
  model: z.string().trim().min(1).max(40),
  year: z.number().int().min(1990).max(new Date().getFullYear() + 1),
  color: z.string().trim().min(2).max(30),
  plate: plateSchema,
  /** Required only for custom (off-catalogue) vehicles. */
  kmPerLitre: z.number().min(3).max(80).optional(),
});

export const driverDetailsSchema = z.object({
  cnic: cnicSchema,
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  city: z.string().trim().min(2).max(60),
  licenseNumber: z.string().trim().min(3).max(40),
  licenseExpiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  emergencyContact: phoneSchema.optional(),
});

export const attachDocumentSchema = z.object({
  type: documentTypeSchema,
  fileId: uuidSchema,
});

export const subscriptionReceiptSchema = z.object({
  fileId: uuidSchema,
  method: z.enum(["jazzcash", "easypaisa", "bank", "other"]),
  transactionRef: z.string().trim().max(60).optional(),
  amountPkr: z.number().int().min(1).max(100_000),
});

export const driverPresenceSchema = z.object({
  online: z.boolean(),
});

export const locationPingSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  heading: z.number().min(0).max(360).nullable().optional(),
  speedKmh: z.number().min(0).max(300).nullable().optional(),
  accuracyM: z.number().min(0).max(10_000).nullable().optional(),
  recordedAt: z.string().datetime().optional(),
});

/* ------------------------------------------------------------------ */
/* Marketplace                                                         */
/* ------------------------------------------------------------------ */

export const quoteSchema = z.object({
  pickup: latLngSchema,
  dropoff: latLngSchema,
  category: vehicleCategorySchema.optional(),
});

export const createRideRequestSchema = z.object({
  pickup: placeSchema,
  dropoff: placeSchema,
  category: vehicleCategorySchema,
  offeredFarePkr: moneySchema,
  passengers: z.number().int().min(1).max(6).default(1),
  note: z.string().trim().max(200).optional(),
  /** Route metadata from the quote step, re-validated server side. */
  distanceKm: z.number().positive().max(1000),
  durationMin: z.number().positive().max(2000),
  routePolyline: z.string().max(20_000).optional(),
});

export const updateOfferSchema = z.object({
  offeredFarePkr: moneySchema,
});

export const cancelRequestSchema = z.object({
  reason: z.string().trim().max(120).optional(),
});

export const placeBidSchema = z.object({
  amountPkr: moneySchema,
  /** Minutes the driver estimates to reach the pickup. */
  etaMin: z.number().int().min(1).max(120),
  message: z.string().trim().max(120).optional(),
});

export const rideCancelSchema = z.object({
  reason: z.enum([...CANCEL_REASONS_CUSTOMER, ...CANCEL_REASONS_DRIVER]),
  details: z.string().trim().max(200).optional(),
});

export const rateRideSchema = z.object({
  stars: z.number().int().min(RATING_MIN).max(RATING_MAX),
  comment: z.string().trim().max(300).optional(),
  tags: z.array(z.string().max(30)).max(5).optional(),
});

export const sendMessageSchema = z.object({
  body: z.string().trim().min(1).max(500),
});

/* ------------------------------------------------------------------ */
/* Support                                                             */
/* ------------------------------------------------------------------ */

export const supportMessageSchema = z.object({
  body: z.string().trim().min(1).max(1000),
  /** Attach to an existing ticket; omit to continue the user's open ticket or start a new one. */
  ticketId: uuidSchema.optional(),
});

export const supportEscalateSchema = z.object({
  ticketId: uuidSchema,
});

/* ------------------------------------------------------------------ */
/* Geo services                                                        */
/* ------------------------------------------------------------------ */

export const geocodeSearchSchema = z.object({
  q: z.string().trim().min(2).max(120),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  limit: z.coerce.number().int().min(1).max(10).default(6),
});

export const reverseGeocodeSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

export const adminDriverDecisionSchema = z.object({
  decision: z.enum(["approve", "reject", "suspend", "reinstate"]),
  reason: z.string().trim().max(500).optional(),
});

export const adminDocumentDecisionSchema = z.object({
  status: z.enum(["verified", "rejected"]),
  note: z.string().trim().max(300).optional(),
});

export const adminSubscriptionDecisionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  note: z.string().trim().max(300).optional(),
});

export const adminSettingsSchema = z.object({
  petrolPricePkr: z.number().min(50).max(2000).optional(),
  driverFlatPkr: z.number().min(0).max(5000).optional(),
  perMinutePkr: z.number().min(0).max(100).optional(),
  recommendedFuelMultiplier: z.number().min(1).max(3).optional(),
  maxFareMultiplier: z.number().min(1.1).max(5).optional(),
  roundToPkr: z.number().int().min(1).max(100).optional(),
  absoluteMinimumFarePkr: z.number().int().min(0).max(5000).optional(),
  driverSubscriptionPkr: z.number().int().min(0).max(100_000).optional(),
  subscriptionDays: z.number().int().min(1).max(366).optional(),
  autoApproveSubscriptionReceipts: z.boolean().optional(),
  testMode: z.boolean().optional(),
  paymentInstructions: z
    .object({
      accountTitle: z.string().max(80),
      jazzcash: z.string().max(40),
      easypaisa: z.string().max(40),
      bankName: z.string().max(80),
      bankAccount: z.string().max(60),
      iban: z.string().max(40),
      note: z.string().max(300),
    })
    .partial()
    .optional(),
  matchRadiusKm: z.number().min(1).max(50).optional(),
  requestTtlSeconds: z.number().int().min(60).max(3600).optional(),
  bidTtlSeconds: z.number().int().min(15).max(600).optional(),
  autoVerifyConfidence: z.number().min(0.3).max(1).optional(),
  supportPhone: z.string().max(30).optional(),
  supportEmail: z.string().email().optional(),
});

export const adminUserActionSchema = z.object({
  action: z.enum(["block", "unblock"]),
  reason: z.string().trim().max(300).optional(),
});

export const adminReplySchema = z.object({
  body: z.string().trim().min(1).max(2000),
  resolve: z.boolean().optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(100).optional(),
  status: z.string().trim().max(40).optional(),
});

export type CustomerSignupInput = z.infer<typeof customerSignupSchema>;
export type DriverSignupInput = z.infer<typeof driverSignupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type VehicleUpsertInput = z.infer<typeof vehicleUpsertSchema>;
export type DriverDetailsInput = z.infer<typeof driverDetailsSchema>;
export type CreateRideRequestInput = z.infer<typeof createRideRequestSchema>;
export type PlaceBidInput = z.infer<typeof placeBidSchema>;
export type AdminSettingsInput = z.infer<typeof adminSettingsSchema>;
