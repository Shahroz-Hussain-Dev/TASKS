import type {
  BidDto,
  CustomerPublicDto,
  DocumentDto,
  DriverDto,
  DriverPublicDto,
  RideDto,
  RideRequestDto,
  SubscriptionDto,
  UserDto,
  VehicleDto,
  DocumentAiVerdict,
  Place,
  SupportTicketDto,
  SupportMessageDto,
  ChatMessageDto,
  NotificationDto,
} from "@raahi/shared";
import { DOCUMENT_META, DOCUMENT_TYPES } from "@raahi/shared";
import type {
  Bid,
  Driver,
  DriverDocument,
  Ride,
  RideRequest,
  Subscription,
  User,
  Vehicle,
  SupportTicket,
  SupportMessage,
} from "@/db/schema";
import { fileUrl, fileUrlRequired } from "./storage";

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const isoReq = (d: Date) => d.toISOString();

export const ratingAvg = (sum: number, count: number) => (count > 0 ? Math.round((sum / count) * 10) / 10 : 5);

export function toUserDto(u: User): UserDto {
  return {
    id: u.id,
    role: u.role,
    fullName: u.fullName,
    phone: u.phone,
    email: u.email,
    avatarUrl: fileUrl(u.avatarFileId),
    ratingAvg: ratingAvg(u.ratingSum, u.ratingCount),
    ratingCount: u.ratingCount,
    isBlocked: u.isBlocked,
    createdAt: isoReq(u.createdAt),
  };
}

export function toCustomerPublic(u: User): CustomerPublicDto {
  return { id: u.id, fullName: u.fullName, avatarUrl: fileUrl(u.avatarFileId), ratingAvg: ratingAvg(u.ratingSum, u.ratingCount), ratingCount: u.ratingCount };
}

export function toVehicleDto(v: Vehicle): VehicleDto {
  return { id: v.id, category: v.category, catalogId: v.catalogId, make: v.make, model: v.model, year: v.year, color: v.color, plate: v.plate, kmPerLitre: v.kmPerLitre, isCustom: v.isCustom };
}

export function toDriverPublic(d: Driver & { user: User; vehicle: Vehicle | null }): DriverPublicDto {
  return {
    id: d.id,
    fullName: d.user.fullName,
    avatarUrl: fileUrl(d.user.avatarFileId),
    ratingAvg: ratingAvg(d.user.ratingSum, d.user.ratingCount),
    ratingCount: d.user.ratingCount,
    totalRides: d.totalRides,
    vehicle: d.vehicle ? { category: d.vehicle.category, make: d.vehicle.make, model: d.vehicle.model, color: d.vehicle.color, plate: d.vehicle.plate, year: d.vehicle.year } : null,
    joinedAt: isoReq(d.createdAt),
  };
}

export function toDocumentDto(doc: DriverDocument): DocumentDto {
  return {
    id: doc.id,
    type: doc.type,
    fileId: doc.fileId,
    url: fileUrlRequired(doc.fileId),
    status: doc.status,
    aiVerdict: (doc.aiVerdict as DocumentAiVerdict | null) ?? null,
    reviewerNote: doc.reviewerNote,
    uploadedAt: isoReq(doc.updatedAt),
  };
}

export function toSubscriptionDto(s: Subscription): SubscriptionDto {
  return {
    id: s.id,
    status: s.status,
    amountPkr: s.amountPkr,
    method: s.method,
    transactionRef: s.transactionRef,
    receiptFileId: s.receiptFileId,
    receiptUrl: fileUrlRequired(s.receiptFileId),
    startsAt: iso(s.startsAt),
    endsAt: iso(s.endsAt),
    reviewerNote: s.reviewerNote,
    createdAt: isoReq(s.createdAt),
  };
}

export function isSubscriptionActive(s: Subscription | null | undefined, now = new Date()): boolean {
  return Boolean(s && s.status === "active" && s.endsAt && s.endsAt.getTime() > now.getTime());
}

export function toDriverDto(
  d: Driver & { vehicle: Vehicle | null; documents: DriverDocument[]; subscriptions: Subscription[] },
): DriverDto {
  const latestSub = [...d.subscriptions].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null;
  const activeSub = d.subscriptions.find((s) => isSubscriptionActive(s)) ?? null;
  const requiredDocs = DOCUMENT_TYPES.filter((t) => DOCUMENT_META[t].required);
  const docsComplete = requiredDocs.every((t) => d.documents.some((doc) => doc.type === t && doc.status !== "rejected"));
  return {
    id: d.id,
    userId: d.userId,
    status: d.status,
    statusReason: d.statusReason,
    cnic: d.cnic,
    city: d.city,
    licenseNumber: d.licenseNumber,
    licenseExpiry: d.licenseExpiry,
    isOnline: d.isOnline,
    lastLocation:
      d.lastLat != null && d.lastLng != null && d.lastLocationAt
        ? { lat: d.lastLat, lng: d.lastLng, heading: d.lastHeading, updatedAt: isoReq(d.lastLocationAt) }
        : null,
    vehicle: d.vehicle ? toVehicleDto(d.vehicle) : null,
    documents: d.documents.map(toDocumentDto),
    subscription: activeSub ? toSubscriptionDto(activeSub) : latestSub ? toSubscriptionDto(latestSub) : null,
    subscriptionActive: Boolean(activeSub),
    onboarding: {
      details: Boolean(d.cnic && d.city && d.licenseNumber),
      vehicle: Boolean(d.vehicle),
      documents: docsComplete,
      subscription: Boolean(activeSub || (latestSub && latestSub.status === "pending")),
      submitted: Boolean(d.submittedAt),
    },
    totalRides: d.totalRides,
    totalEarningsPkr: d.totalEarningsPkr,
    createdAt: isoReq(d.createdAt),
  };
}

export const placeFrom = (lat: number, lng: number, address: string, name: string | null): Place => ({ lat, lng, address, ...(name ? { name } : {}) });

export function toBidDto(b: Bid & { driver: Driver & { user: User; vehicle: Vehicle | null } }): BidDto {
  return {
    id: b.id,
    requestId: b.requestId,
    status: b.status,
    amountPkr: b.amountPkr,
    etaMin: b.etaMin,
    message: b.message,
    driver: toDriverPublic(b.driver),
    driverLocation: b.driverLat != null && b.driverLng != null ? { lat: b.driverLat, lng: b.driverLng } : null,
    distanceToPickupKm: b.distanceToPickupKm,
    expiresAt: isoReq(b.expiresAt),
    createdAt: isoReq(b.createdAt),
  };
}

export function toRequestDto(
  r: RideRequest & { customer: User; bids?: (Bid & { driver: Driver & { user: User; vehicle: Vehicle | null } })[] },
): RideRequestDto {
  return {
    id: r.id,
    status: r.status,
    customer: toCustomerPublic(r.customer),
    pickup: placeFrom(r.pickupLat, r.pickupLng, r.pickupAddress, r.pickupName),
    dropoff: placeFrom(r.dropoffLat, r.dropoffLng, r.dropoffAddress, r.dropoffName),
    category: r.category,
    offeredFarePkr: r.offeredFarePkr,
    minFarePkr: r.minFarePkr,
    maxFarePkr: r.maxFarePkr,
    recommendedFarePkr: r.recommendedFarePkr,
    distanceKm: r.distanceKm,
    durationMin: r.durationMin,
    routePolyline: r.routePolyline,
    passengers: r.passengers,
    note: r.note,
    bids: (r.bids ?? []).map(toBidDto),
    rideId: r.rideId,
    expiresAt: isoReq(r.expiresAt),
    createdAt: isoReq(r.createdAt),
    updatedAt: isoReq(r.updatedAt),
  };
}

export interface RideWithRelations extends Ride {
  customer: User;
  driver: Driver & { user: User; vehicle: Vehicle | null };
  ratings?: { raterId: string; stars: number; comment: string | null }[];
}

export function toRideDto(r: RideWithRelations, viewerUserId: string, unreadMessages = 0): RideDto {
  const mine = r.ratings?.find((x) => x.raterId === viewerUserId) ?? null;
  const theirs = r.ratings?.find((x) => x.raterId !== viewerUserId) ?? null;
  const d = r.driver;
  return {
    id: r.id,
    status: r.status,
    requestId: r.requestId,
    customer: toCustomerPublic(r.customer),
    driver: toDriverPublic(d),
    pickup: placeFrom(r.pickupLat, r.pickupLng, r.pickupAddress, r.pickupName),
    dropoff: placeFrom(r.dropoffLat, r.dropoffLng, r.dropoffAddress, r.dropoffName),
    category: r.category,
    farePkr: r.farePkr,
    distanceKm: r.distanceKm,
    durationMin: r.durationMin,
    routePolyline: r.routePolyline,
    paymentMethod: "cash",
    driverLocation:
      d.lastLat != null && d.lastLng != null && d.lastLocationAt
        ? { lat: d.lastLat, lng: d.lastLng, heading: d.lastHeading, updatedAt: isoReq(d.lastLocationAt) }
        : null,
    startedAt: iso(r.startedAt),
    arrivedAt: iso(r.arrivedAt),
    completedAt: iso(r.completedAt),
    cancelledAt: iso(r.cancelledAt),
    cancelReason: r.cancelReason,
    cancelledBy: (r.cancelledBy as "customer" | "driver" | null) ?? null,
    myRating: mine ? { stars: mine.stars, comment: mine.comment } : null,
    theirRating: theirs ? { stars: theirs.stars, comment: theirs.comment } : null,
    unreadMessages,
    createdAt: isoReq(r.createdAt),
  };
}

export function toChatMessageDto(m: { id: string; rideId: string; senderId: string; senderRole: string; body: string; createdAt: Date }): ChatMessageDto {
  return { id: m.id, rideId: m.rideId, senderId: m.senderId, senderRole: m.senderRole as "customer" | "driver", body: m.body, createdAt: isoReq(m.createdAt) };
}

export function toSupportMessageDto(m: SupportMessage): SupportMessageDto {
  return { id: m.id, ticketId: m.ticketId, sender: m.sender, body: m.body, createdAt: isoReq(m.createdAt) };
}

export function toSupportTicketDto(t: SupportTicket & { messages: SupportMessage[]; user?: User }): SupportTicketDto {
  return {
    id: t.id,
    status: t.status,
    subject: t.subject,
    escalated: t.escalated,
    messages: t.messages.map(toSupportMessageDto),
    ...(t.user ? { user: toUserDto(t.user) } : {}),
    createdAt: isoReq(t.createdAt),
    updatedAt: isoReq(t.updatedAt),
  };
}

export function toNotificationDto(n: { id: string; type: string; title: string; body: string; data: unknown; readAt: Date | null; createdAt: Date }): NotificationDto {
  return { id: n.id, type: n.type, title: n.title, body: n.body, data: (n.data as Record<string, unknown> | null) ?? null, readAt: iso(n.readAt), createdAt: isoReq(n.createdAt) };
}
