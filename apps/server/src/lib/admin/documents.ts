/**
 * Admin document review: manual verdicts and AI re-verification.
 * A rejected document on an approved driver sends the driver back to review —
 * "approved" always means every required document is in order.
 */
import { eq } from "drizzle-orm";
import { DOCUMENT_META, type DocumentDto } from "@raahi/shared";
import { getDb } from "@/db";
import { driverDocuments, drivers } from "@/db/schema";
import { audit, notify } from "@/lib/audit";
import { conflict, notFound } from "@/lib/errors";
import { decideStatus, verifyDocument } from "@/lib/kyc";
import { toDocumentDto } from "@/lib/mappers";
import { getSettings } from "@/lib/settings";
import { getFileMeta, readFileBytes } from "@/lib/storage";
import { type AdminActor } from "./common";
import { maybeAutoApprove, takeOffTheRoad } from "./drivers";

export interface DocumentDecisionInput {
  status: "verified" | "rejected";
  note?: string;
}

async function loadDocument(documentId: string) {
  const db = await getDb();
  const row = await db.query.driverDocuments.findFirst({
    where: eq(driverDocuments.id, documentId),
    with: { driver: { with: { user: true, vehicle: true } } },
  });
  if (!row) throw notFound("Document not found");
  return row;
}

export async function decideDocument(actor: AdminActor, documentId: string, input: DocumentDecisionInput): Promise<DocumentDto> {
  const db = await getDb();
  const doc = await loadDocument(documentId);
  const now = new Date();
  const note = input.note?.trim() || null;
  const label = DOCUMENT_META[doc.type].label;

  const [updated] = await db
    .update(driverDocuments)
    .set({ status: input.status, reviewerNote: note, reviewedBy: actor.user.id, reviewedAt: now, updatedAt: now })
    .where(eq(driverDocuments.id, documentId))
    .returning();

  if (input.status === "rejected") {
    if (doc.driver.status === "approved") {
      await takeOffTheRoad(doc.driver.id, now);
      await db
        .update(drivers)
        .set({ status: "under_review", statusReason: `${label} was rejected — please upload it again.`, isOnline: false, reviewedAt: now, reviewedBy: actor.user.id, updatedAt: now })
        .where(eq(drivers.id, doc.driver.id));
    }
    await notify(doc.driver.userId, {
      type: "document_rejected",
      title: `${label} needs another photo`,
      body: note ?? `Your ${label.toLowerCase()} could not be verified. Retake the photo in good light with the whole document visible and upload it again.`,
      data: { documentId, type: doc.type },
    });
  } else {
    await notify(doc.driver.userId, {
      type: "document_verified",
      title: `${label} verified`,
      body: note ?? `Your ${label.toLowerCase()} has been checked and approved.`,
      data: { documentId, type: doc.type },
    });
  }

  await audit({
    actorId: actor.user.id,
    actorRole: "admin",
    action: `admin.document.${input.status}`,
    targetType: "document",
    targetId: documentId,
    ip: actor.ip,
    meta: { driverId: doc.driver.id, type: doc.type, previousStatus: doc.status, note, driverSentBackToReview: input.status === "rejected" && doc.driver.status === "approved" },
  });
  if (input.status === "verified") await maybeAutoApprove(actor, doc.driver.id, `document:${doc.type}`);
  return toDocumentDto(updated!);
}

/** Run the Gemini check again (new model, fixed profile data, or a flaky first attempt). */
export async function reverifyDocument(actor: AdminActor, documentId: string): Promise<DocumentDto> {
  const db = await getDb();
  const doc = await loadDocument(documentId);
  const file = await getFileMeta(doc.fileId);
  const [bytes, settings] = await Promise.all([readFileBytes(file), getSettings()]);
  const verdict = await verifyDocument(doc.type, bytes, file.mime, {
    fullName: doc.driver.user.fullName,
    cnic: doc.driver.cnic,
    licenseNumber: doc.driver.licenseNumber,
    plate: doc.driver.vehicle?.plate ?? null,
  });
  if (verdict.model === "none") throw conflict("AI verification is not configured on this server, so the document cannot be re-verified automatically. Decide it manually instead.");
  const status = decideStatus(verdict, settings.autoVerifyConfidence);
  const now = new Date();
  const [updated] = await db
    .update(driverDocuments)
    .set({ status, aiVerdict: verdict, reviewerNote: null, reviewedBy: null, reviewedAt: null, updatedAt: now })
    .where(eq(driverDocuments.id, documentId))
    .returning();
  await audit({
    actorId: actor.user.id,
    actorRole: "admin",
    action: "admin.document.reverify",
    targetType: "document",
    targetId: documentId,
    ip: actor.ip,
    meta: { driverId: doc.driver.id, type: doc.type, previousStatus: doc.status, status, confidence: verdict.confidence, detectedType: verdict.detectedType, issues: verdict.issues, model: verdict.model },
  });
  if (status === "verified") await maybeAutoApprove(actor, doc.driver.id, `reverify:${doc.type}`);
  return toDocumentDto(updated!);
}
