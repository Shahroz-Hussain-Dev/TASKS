/**
 * Driver onboarding service.
 *
 * Steps (mirrors the mobile wizard):
 *   1. details      — CNIC, city, licence (KYC identity)
 *   2. vehicle      — catalogue model → fuel economy, or a custom model
 *   3. documents    — 7 photos, each verified by Gemini the moment it lands
 *                     (test mode: accepted as-is, no AI call)
 *   4. subscription — PKR 1,000 / month receipt (test mode: one-tap payment)
 *   5. submit       — goes under review; auto-approved when every required
 *                     document is verified AND the subscription is active
 *                     (test mode: documents only need to be present)
 *
 * Status transitions handled here:
 *   onboarding → under_review → approved
 *   rejected   → onboarding   (the moment a rejected driver fixes anything)
 *   approved   → under_review (vehicle plate / category changed after approval)
 * Suspension and admin decisions live in the admin routes.
 */
import { and, desc, eq, gt, ne } from "drizzle-orm";
import { z } from "zod";
import {
  CUSTOM_VEHICLE_ID,
  DOCUMENT_META,
  DOCUMENT_TYPES,
  VEHICLE_CATEGORY_META,
  attachDocumentSchema,
  findVehicleModel,
  subscriptionReceiptSchema,
  type DocumentAiVerdict,
  type DocumentType,
  type DriverDetailsInput,
  type DriverDto,
  type PlatformSettings,
  type VehicleUpsertInput,
} from "@raahi/shared";
import { getDb } from "@/db";
import { bids, driverDocuments, drivers, subscriptions, users, vehicles, type Driver, type DriverDocument, type Subscription, type User, type Vehicle } from "@/db/schema";
import { audit, notify } from "@/lib/audit";
import { ApiError, badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { decideStatus, verifyDocument } from "@/lib/kyc";
import { isSubscriptionActive, toDriverDto } from "@/lib/mappers";
import { getSettings } from "@/lib/settings";
import { deleteFile, getFileMeta, readFileBytes } from "@/lib/storage";

export type AttachDocumentInput = z.infer<typeof attachDocumentSchema>;
export type SubscriptionReceiptInput = z.infer<typeof subscriptionReceiptSchema>;

/** The authenticated driver performing the action. */
export interface DriverActor {
  user: User;
  driver: Driver;
  ip?: string;
}

type DriverWithRelations = Driver & { vehicle: Vehicle | null; documents: DriverDocument[]; subscriptions: Subscription[] };
type DriverPatch = Partial<typeof drivers.$inferInsert>;

const REQUIRED_DOCS: readonly DocumentType[] = DOCUMENT_TYPES.filter((t) => DOCUMENT_META[t].required);
const DAY_MS = 86_400_000;

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

export async function loadDriver(driverId: string): Promise<DriverWithRelations> {
  const db = await getDb();
  const row = await db.query.drivers.findFirst({
    where: eq(drivers.id, driverId),
    with: { vehicle: true, documents: true, subscriptions: { orderBy: [desc(subscriptions.createdAt)] } },
  });
  if (!row) throw notFound("Driver profile not found");
  return row;
}

export async function getDriverDto(driverId: string): Promise<DriverDto> {
  return toDriverDto(await loadDriver(driverId));
}

/* ------------------------------------------------------------------ */
/* Step 1 — personal details                                           */
/* ------------------------------------------------------------------ */

export async function updateDetails(actor: DriverActor, input: DriverDetailsInput): Promise<DriverDto> {
  const { driver } = actor;
  assertNotSuspended(driver);
  if (driver.status === "approved" && driver.cnic && driver.cnic !== input.cnic) {
    throw forbidden("Your CNIC has been verified and can no longer be changed. Contact support if it is incorrect.");
  }
  if (input.licenseExpiry) {
    const expiry = parseIsoDate(input.licenseExpiry);
    if (!expiry) throw badRequest("licenseExpiry: Enter a valid date");
    if (expiry.getTime() < startOfToday().getTime()) throw badRequest("Your driving licence has expired. Renew it before registering as a driver.");
  }
  if (input.dateOfBirth) {
    const dob = parseIsoDate(input.dateOfBirth);
    if (!dob) throw badRequest("dateOfBirth: Enter a valid date");
    if (yearsSince(dob) < 18) throw badRequest("Drivers must be at least 18 years old");
    if (yearsSince(dob) > 90) throw badRequest("dateOfBirth: Enter a valid date of birth");
  }

  const db = await getDb();
  const [duplicate] = await db
    .select({ id: drivers.id })
    .from(drivers)
    .where(and(eq(drivers.cnic, input.cnic), ne(drivers.id, driver.id)))
    .limit(1);
  if (duplicate) throw conflict("This CNIC is already registered with another driver account");

  try {
    await db
      .update(drivers)
      .set({
        cnic: input.cnic,
        dateOfBirth: input.dateOfBirth ?? null,
        city: input.city,
        licenseNumber: input.licenseNumber,
        licenseExpiry: input.licenseExpiry ?? null,
        emergencyContact: input.emergencyContact ?? null,
        ...reopenIfRejected(driver),
        updatedAt: new Date(),
      })
      .where(eq(drivers.id, driver.id));
  } catch (err) {
    if (isUniqueViolation(err)) throw conflict("This CNIC is already registered with another driver account");
    throw err;
  }

  await audit({ actorId: actor.user.id, actorRole: "driver", action: "driver.details.update", targetType: "driver", targetId: driver.id, ip: actor.ip, meta: { city: input.city } });
  return getDriverDto(driver.id);
}

/* ------------------------------------------------------------------ */
/* Step 2 — vehicle                                                    */
/* ------------------------------------------------------------------ */

export async function upsertVehicle(actor: DriverActor, input: VehicleUpsertInput): Promise<DriverDto> {
  const { driver } = actor;
  assertNotSuspended(driver);

  let kmPerLitre: number;
  let isCustom: boolean;
  let make: string;
  let model: string;
  if (input.catalogId === CUSTOM_VEHICLE_ID) {
    if (input.kmPerLitre === undefined) throw badRequest("Enter your vehicle's average fuel economy (km per litre) for a custom model");
    kmPerLitre = input.kmPerLitre;
    isCustom = true;
    make = input.make;
    model = input.model;
  } else {
    const entry = findVehicleModel(input.catalogId);
    if (!entry) throw badRequest("We couldn't find that vehicle model. Pick one from the list or choose 'Other model'.");
    if (!entry.categories.includes(input.category)) {
      const allowed = entry.categories.map((c) => VEHICLE_CATEGORY_META[c].label).join(", ");
      throw badRequest(`${entry.make} ${entry.model} can't be registered as ${VEHICLE_CATEGORY_META[input.category].label}. It can serve: ${allowed}.`);
    }
    kmPerLitre = entry.kmPerLitre;
    isCustom = false;
    make = entry.make;
    model = entry.model;
  }

  const db = await getDb();
  const existing = await db.query.vehicles.findFirst({ where: eq(vehicles.driverId, driver.id) });
  const now = new Date();
  const values = { category: input.category, catalogId: input.catalogId, make, model, year: input.year, color: input.color, plate: input.plate, kmPerLitre, isCustom };
  await db
    .insert(vehicles)
    .values({ driverId: driver.id, ...values })
    .onConflictDoUpdate({ target: vehicles.driverId, set: { ...values, updatedAt: now } });

  // A verified driver who changes plate or category must be re-verified — the
  // vehicle documents on file no longer describe what they drive.
  const identityChanged = Boolean(existing && (existing.plate !== input.plate || existing.category !== input.category));
  const patch: DriverPatch = { ...reopenIfRejected(driver), updatedAt: now };
  if (driver.status === "approved" && identityChanged) {
    Object.assign(patch, { status: "under_review", statusReason: "Vehicle details changed — re-verification required", isOnline: false, reviewedAt: null, reviewedBy: null } satisfies DriverPatch);
  }
  await db.update(drivers).set(patch).where(eq(drivers.id, driver.id));
  if (patch.status === "under_review") {
    // Taken off the road until re-verified: open offers are withdrawn so passengers aren't left waiting.
    await db.update(bids).set({ status: "withdrawn", respondedAt: now }).where(and(eq(bids.driverId, driver.id), eq(bids.status, "pending")));
    await notify(driver.userId, {
      type: "driver_under_review",
      title: "Vehicle update under review",
      body: "You changed your vehicle's plate or category, so we need to re-verify it. Please re-upload the vehicle documents and photo.",
    });
  }

  await audit({
    actorId: actor.user.id,
    actorRole: "driver",
    action: existing ? "driver.vehicle.update" : "driver.vehicle.create",
    targetType: "driver",
    targetId: driver.id,
    ip: actor.ip,
    meta: { ...values, previousPlate: existing?.plate ?? null, previousCategory: existing?.category ?? null, reverification: patch.status === "under_review" },
  });
  return getDriverDto(driver.id);
}

/* ------------------------------------------------------------------ */
/* Step 3 — documents (Gemini KYC)                                     */
/* ------------------------------------------------------------------ */

export async function attachDocument(actor: DriverActor, input: AttachDocumentInput): Promise<DriverDto> {
  const { driver, user } = actor;
  assertNotSuspended(driver);

  const file = await getFileMeta(input.fileId);
  if (file.ownerId !== user.id) throw forbidden("That file doesn't belong to your account");
  if (file.kind !== "document") throw badRequest("This image was not uploaded as a document. Please upload it again from the documents step.");

  const db = await getDb();
  const s = await getSettings();

  let verdict: DocumentAiVerdict;
  let status: DriverDocument["status"];
  if (s.testMode) {
    // Test mode: any picture is accepted instantly, no AI round-trip.
    verdict = testModeVerdict(input.type);
    status = "verified";
  } else {
    const vehicle = await db.query.vehicles.findFirst({ where: eq(vehicles.driverId, driver.id) });
    const bytes = await readFileBytes(file);
    try {
      verdict = await verifyDocument(input.type, bytes, file.mime, {
        fullName: user.fullName,
        cnic: driver.cnic,
        licenseNumber: driver.licenseNumber,
        plate: vehicle?.plate ?? null,
      });
    } catch (err) {
      // The upload must never be lost because the AI was busy — park it for manual review instead.
      if (!(err instanceof ApiError) || err.status < 500) throw err;
      verdict = unavailableVerdict(err.message);
    }
    status = decideStatus(verdict, s.autoVerifyConfidence);
  }

  const previous = await db.query.driverDocuments.findFirst({ where: and(eq(driverDocuments.driverId, driver.id), eq(driverDocuments.type, input.type)) });
  const now = new Date();
  await db
    .insert(driverDocuments)
    .values({ driverId: driver.id, type: input.type, fileId: input.fileId, status, aiVerdict: verdict })
    .onConflictDoUpdate({
      target: [driverDocuments.driverId, driverDocuments.type],
      set: { fileId: input.fileId, status, aiVerdict: verdict, reviewerNote: null, reviewedBy: null, reviewedAt: null, updatedAt: now },
    });
  await db.update(drivers).set({ ...reopenIfRejected(driver), updatedAt: now }).where(eq(drivers.id, driver.id));

  // The replaced image is unreachable from every DTO now; free the storage.
  if (previous && previous.fileId !== input.fileId) await deleteFile(previous.fileId).catch(() => undefined);

  await audit({
    actorId: user.id,
    actorRole: "driver",
    action: "driver.document.attach",
    targetType: "driver",
    targetId: driver.id,
    ip: actor.ip,
    meta: { type: input.type, fileId: input.fileId, status, confidence: verdict.confidence, detectedType: verdict.detectedType, issues: verdict.issues, model: verdict.model },
  });
  return getDriverDto(driver.id);
}

/* ------------------------------------------------------------------ */
/* Step 4 — subscription receipt                                       */
/* ------------------------------------------------------------------ */

/**
 * Test mode: one tap = paid. No receipt, no review; the subscription starts now
 * (or extends the current one) and the driver is auto-approved if everything
 * else is in. Refused when test mode is off.
 */
export async function paySubscriptionTestMode(actor: DriverActor): Promise<DriverDto> {
  const { driver, user } = actor;
  assertNotSuspended(driver);
  const s = await getSettings();
  if (!s.testMode) throw badRequest("One-tap payment is only available in test mode. Please pay and upload your receipt.");

  const db = await getDb();
  const now = new Date();
  const result = await db.transaction(async (tx) => {
    const active = await tx
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.driverId, driver.id), eq(subscriptions.status, "active"), gt(subscriptions.endsAt, now)))
      .orderBy(desc(subscriptions.endsAt));
    const [pending] = await tx
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.driverId, driver.id), eq(subscriptions.status, "pending")))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);
    const base = active.reduce((latest, sub) => (sub.endsAt && sub.endsAt.getTime() > latest.getTime() ? sub.endsAt : latest), now);
    const endsAt = new Date(base.getTime() + s.subscriptionDays * DAY_MS);
    if (active.length > 0) {
      await tx
        .update(subscriptions)
        .set({ status: "expired", reviewerNote: "Rolled into a renewal", updatedAt: now })
        .where(and(eq(subscriptions.driverId, driver.id), eq(subscriptions.status, "active")));
    }
    const values = {
      amountPkr: s.driverSubscriptionPkr,
      method: "test",
      transactionRef: `TEST-${now.getTime().toString(36).toUpperCase()}`,
      receiptFileId: null,
      status: "active" as const,
      startsAt: now,
      endsAt,
      reviewerNote: "Paid with one tap (test mode)",
      reviewedAt: now,
      reviewedBy: null,
      updatedAt: now,
    };
    const [row] = pending
      ? await tx.update(subscriptions).set(values).where(eq(subscriptions.id, pending.id)).returning()
      : await tx.insert(subscriptions).values({ driverId: driver.id, ...values }).returning();
    return row!;
  });

  await notify(driver.userId, {
    type: "subscription_active",
    title: "Payment received",
    body: `Your Raahi driver subscription is active until ${formatDate(result.endsAt!)}. 100% of every fare is yours.`,
    data: { subscriptionId: result.id },
  });
  if (driver.status === "under_review") await tryAutoApprove(actor, "subscription");
  await audit({
    actorId: user.id,
    actorRole: "driver",
    action: "driver.subscription.activate",
    targetType: "subscription",
    targetId: result.id,
    ip: actor.ip,
    meta: { amountPkr: s.driverSubscriptionPkr, method: "test", testMode: true, endsAt: result.endsAt?.toISOString() ?? null },
  });
  return getDriverDto(driver.id);
}

export async function submitSubscription(actor: DriverActor, input: SubscriptionReceiptInput): Promise<DriverDto> {
  const { driver, user } = actor;
  assertNotSuspended(driver);

  const file = await getFileMeta(input.fileId);
  if (file.ownerId !== user.id) throw forbidden("That file doesn't belong to your account");
  if (file.kind !== "receipt") throw badRequest("This image was not uploaded as a receipt. Please upload the payment screenshot again.");

  const db = await getDb();
  const s = await getSettings();
  const now = new Date();

  const result = await db.transaction(async (tx) => {
    const active = await tx
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.driverId, driver.id), eq(subscriptions.status, "active"), gt(subscriptions.endsAt, now)))
      .orderBy(desc(subscriptions.endsAt));
    const [pending] = await tx
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.driverId, driver.id), eq(subscriptions.status, "pending")))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);

    const receipt = { amountPkr: input.amountPkr, method: input.method, transactionRef: input.transactionRef ?? null, receiptFileId: input.fileId };

    if (s.autoApproveSubscriptionReceipts || s.testMode) {
      // Renewing early never loses days: the new period starts where the current one ends.
      const base = active.reduce((latest, sub) => (sub.endsAt && sub.endsAt.getTime() > latest.getTime() ? sub.endsAt : latest), now);
      const endsAt = new Date(base.getTime() + s.subscriptionDays * DAY_MS);
      if (active.length > 0) {
        await tx
          .update(subscriptions)
          .set({ status: "expired", reviewerNote: "Rolled into a renewal", updatedAt: now })
          .where(and(eq(subscriptions.driverId, driver.id), eq(subscriptions.status, "active")));
      }
      const activeValues = { ...receipt, status: "active" as const, startsAt: now, endsAt, reviewerNote: "Auto-approved (test mode)", reviewedAt: now, updatedAt: now };
      const [row] = pending
        ? await tx.update(subscriptions).set(activeValues).where(eq(subscriptions.id, pending.id)).returning()
        : await tx.insert(subscriptions).values({ driverId: driver.id, ...activeValues }).returning();
      return { row: row!, activated: true, replacedPending: Boolean(pending) };
    }

    const pendingValues = { ...receipt, status: "pending" as const, startsAt: null, endsAt: null, reviewerNote: null, reviewedAt: null, reviewedBy: null, updatedAt: now };
    const [row] = pending
      ? await tx.update(subscriptions).set(pendingValues).where(eq(subscriptions.id, pending.id)).returning()
      : await tx.insert(subscriptions).values({ driverId: driver.id, ...pendingValues }).returning();
    return { row: row!, activated: false, replacedPending: Boolean(pending) };
  });

  if (result.activated) {
    await notify(driver.userId, {
      type: "subscription_active",
      title: "Subscription active",
      body: `Your Raahi driver subscription is active until ${formatDate(result.row.endsAt!)}. 100% of every fare is yours.`,
      data: { subscriptionId: result.row.id },
    });
    // A driver already waiting on review may now qualify for automatic approval.
    if (driver.status === "under_review") await tryAutoApprove(actor, "subscription");
  } else {
    await notify(driver.userId, {
      type: "subscription_pending",
      title: "Receipt received",
      body: "We're checking your payment. Your subscription activates as soon as it's confirmed, usually within a few hours.",
      data: { subscriptionId: result.row.id },
    });
    await notifyAdmins({
      type: "admin_subscription_review",
      title: "Subscription receipt to review",
      body: `${user.fullName} sent PKR ${input.amountPkr.toLocaleString("en-PK")} via ${input.method}.`,
      data: { subscriptionId: result.row.id, driverId: driver.id },
    });
  }

  await audit({
    actorId: user.id,
    actorRole: "driver",
    action: result.activated ? "driver.subscription.activate" : "driver.subscription.submit",
    targetType: "subscription",
    targetId: result.row.id,
    ip: actor.ip,
    meta: { amountPkr: input.amountPkr, method: input.method, transactionRef: input.transactionRef ?? null, expected: s.driverSubscriptionPkr, replacedPending: result.replacedPending, endsAt: result.row.endsAt?.toISOString() ?? null },
  });
  return getDriverDto(driver.id);
}

/* ------------------------------------------------------------------ */
/* Step 5 — submit for review                                          */
/* ------------------------------------------------------------------ */

export async function submitForReview(actor: DriverActor): Promise<DriverDto> {
  const { driver, user } = actor;
  assertNotSuspended(driver);
  const full = await loadDriver(driver.id);
  if (full.status === "approved") return toDriverDto(full);

  if (!(full.cnic && full.city && full.licenseNumber)) throw badRequest("Complete your personal details before submitting", { step: "details" });
  if (!full.vehicle) throw badRequest("Add your vehicle before submitting", { step: "vehicle" });
  const missing = REQUIRED_DOCS.filter((t) => !full.documents.some((d) => d.type === t && d.status !== "rejected"));
  if (missing.length > 0) {
    const labels = missing.map((t) => DOCUMENT_META[t].label).join(", ");
    throw badRequest(`Upload the remaining documents before submitting: ${labels}`, { step: "documents", missing });
  }

  const db = await getDb();
  const now = new Date();
  const submittedAt = full.submittedAt ?? now;
  const approve = qualifiesForAutoApproval(full, await getSettings());
  await db
    .update(drivers)
    .set(
      approve
        ? { status: "approved", statusReason: null, submittedAt, reviewedAt: now, reviewedBy: null, updatedAt: now }
        : { status: "under_review", statusReason: null, submittedAt, updatedAt: now },
    )
    .where(eq(drivers.id, driver.id));

  if (approve) {
    await notify(driver.userId, {
      type: "driver_approved",
      title: "You're approved 🎉",
      body: "Every document checked out and your subscription is active. Go online and start earning — 100% of each fare is yours.",
    });
  } else if (full.status !== "under_review") {
    await notify(driver.userId, {
      type: "driver_under_review",
      title: "Under review",
      body: "Thanks for submitting. Our team is checking your documents — this usually takes less than 24 hours.",
    });
  }
  await audit({
    actorId: user.id,
    actorRole: "driver",
    action: approve ? "driver.auto_approve" : "driver.submit",
    targetType: "driver",
    targetId: driver.id,
    ip: actor.ip,
    meta: { resubmission: Boolean(full.submittedAt), documents: full.documents.map((d) => ({ type: d.type, status: d.status })), subscriptionActive: full.subscriptions.some((sub) => isSubscriptionActive(sub)) },
  });
  return getDriverDto(driver.id);
}

/* ------------------------------------------------------------------ */
/* Internals                                                           */
/* ------------------------------------------------------------------ */

/**
 * Every required document verified AND an active subscription → no human needed.
 * In test mode a document only has to be present (any picture counts).
 */
function qualifiesForAutoApproval(d: DriverWithRelations, s: PlatformSettings): boolean {
  const docsOk = REQUIRED_DOCS.every((t) => d.documents.some((doc) => doc.type === t && (s.testMode ? doc.status !== "rejected" : doc.status === "verified")));
  const subscriptionActive = d.subscriptions.some((sub) => isSubscriptionActive(sub));
  return docsOk && subscriptionActive;
}

async function tryAutoApprove(actor: DriverActor, trigger: string): Promise<void> {
  const full = await loadDriver(actor.driver.id);
  if (full.status !== "under_review" || !qualifiesForAutoApproval(full, await getSettings())) return;
  const db = await getDb();
  const now = new Date();
  await db.update(drivers).set({ status: "approved", statusReason: null, reviewedAt: now, reviewedBy: null, updatedAt: now }).where(eq(drivers.id, full.id));
  await notify(full.userId, {
    type: "driver_approved",
    title: "You're approved 🎉",
    body: "Every document checked out and your subscription is active. Go online and start earning — 100% of each fare is yours.",
  });
  await audit({ actorId: actor.user.id, actorRole: "driver", action: "driver.auto_approve", targetType: "driver", targetId: full.id, ip: actor.ip, meta: { trigger } });
}

/** A rejected driver who fixes anything goes back to onboarding so they can resubmit. */
function reopenIfRejected(driver: Driver): DriverPatch {
  return driver.status === "rejected" ? { status: "onboarding", statusReason: null, submittedAt: null, reviewedAt: null, reviewedBy: null } : {};
}

function assertNotSuspended(driver: Driver): void {
  if (driver.status === "suspended") throw forbidden("Your driver account is suspended. Contact support to resolve this before making changes.");
}

function testModeVerdict(type: DocumentType): DocumentAiVerdict {
  return {
    detectedType: type,
    matchesExpectedType: true,
    legible: true,
    confidence: 1,
    extracted: {},
    nameMatchesProfile: null,
    issues: [],
    summary: "Accepted without AI verification (test mode).",
    model: "none",
    verifiedAt: new Date().toISOString(),
  };
}

function unavailableVerdict(reason: string): DocumentAiVerdict {
  return {
    detectedType: "unknown",
    matchesExpectedType: false,
    legible: false,
    confidence: 0,
    extracted: {},
    nameMatchesProfile: null,
    issues: [`Automatic verification unavailable: ${reason}`, "Manual review required"],
    summary: "Automatic verification could not run. An admin will review this document.",
    model: "none",
    verifiedAt: new Date().toISOString(),
  };
}

async function notifyAdmins(n: { type: string; title: string; body: string; data?: Record<string, unknown> }): Promise<void> {
  const db = await getDb();
  const admins = await db.select({ id: users.id }).from(users).where(and(eq(users.role, "admin"), eq(users.isBlocked, false)));
  await Promise.all(admins.map((a) => notify(a.id, n)));
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: unknown }).code === "23505";
}

function parseIsoDate(value: string): Date | null {
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10) === value ? d : null;
}

function startOfToday(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function yearsSince(d: Date): number {
  return (Date.now() - d.getTime()) / (365.25 * DAY_MS);
}

const dateFormatter = new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Karachi" });
function formatDate(d: Date): string {
  return dateFormatter.format(d);
}
