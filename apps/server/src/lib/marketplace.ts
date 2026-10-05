/**
 * Marketplace service — the bidding engine.
 *
 * Lifecycle
 *   RideRequest: open → accepted | cancelled | expired
 *   Bid:         pending → accepted | rejected | withdrawn | expired
 *   Ride:        assigned → arrived → in_progress → completed | cancelled_*
 *
 * Invariants enforced here (never in the UI):
 *   - a customer has at most one open request
 *   - a driver has at most one active ride and at most one pending bid per request
 *   - every offer and bid lies within [minFare, maxFare] computed by the fare engine
 *   - a bid can only be accepted while the request is open and the bid is pending/not expired
 *   - acceptance is atomic (row lock) so two taps can never create two rides
 */
import { and, desc, eq, gt, inArray, lt, ne, or, sql } from "drizzle-orm";
import { getDb, type Db } from "@/db";
import { bids, drivers, rideLocations, rideMessages, rideRequests, rides, ratings, subscriptions, users, vehicles, type Driver, type User } from "@/db/schema";
import {
  ACTIVE_RIDE_STATUSES,
  MARKET_RULES,
  VEHICLE_CATEGORIES,
  computeFare,
  haversineKm,
  isWithinFareBounds,
  type CreateRideRequestInput,
  type DriverRequestFeedItem,
  type FareBreakdown,
  type LatLng,
  type RouteQuote,
  type VehicleCategory,
} from "@raahi/shared";
import { badRequest, conflict, forbidden, notFound } from "./errors";
import { route as routeBetween } from "./geo-services";
import { getSettings } from "./settings";
import { toBidDto, toRequestDto, toRideDto, isSubscriptionActive, type RideWithRelations } from "./mappers";
import { notify } from "./audit";

/* ------------------------------------------------------------------ */
/* Housekeeping                                                        */
/* ------------------------------------------------------------------ */

/** Expire stale requests & bids. Cheap, idempotent; called from polling endpoints. */
export async function expireStale(db?: Db) {
  const d = db ?? (await getDb());
  const now = new Date();
  await d.update(bids).set({ status: "expired", respondedAt: now }).where(and(eq(bids.status, "pending"), lt(bids.expiresAt, now)));
  await d
    .update(rideRequests)
    .set({ status: "expired", closedAt: now, updatedAt: now })
    .where(and(eq(rideRequests.status, "open"), lt(rideRequests.expiresAt, now)));
  // Drivers whose location is stale are flipped offline so passengers don't bid-wait on ghosts.
  await d
    .update(drivers)
    .set({ isOnline: false })
    .where(and(eq(drivers.isOnline, true), lt(drivers.lastLocationAt, new Date(now.getTime() - MARKET_RULES.driverStaleSeconds * 1000))));
}

/* ------------------------------------------------------------------ */
/* Quotes                                                              */
/* ------------------------------------------------------------------ */

export async function quote(pickup: LatLng, dropoff: LatLng): Promise<RouteQuote> {
  const [r, s] = await Promise.all([routeBetween(pickup, dropoff), getSettings()]);
  const fares = {} as Record<VehicleCategory, FareBreakdown>;
  for (const c of VEHICLE_CATEGORIES) fares[c] = computeFare({ distanceKm: r.distanceKm, durationMin: r.durationMin, category: c, settings: s });
  return { distanceKm: round2(r.distanceKm), durationMin: Math.round(r.durationMin), polyline: r.polyline, geometry: r.geometry, source: r.source, fares };
}

/* ------------------------------------------------------------------ */
/* Customer: requests                                                  */
/* ------------------------------------------------------------------ */

const requestWith = () => ({
  customer: true as const,
  bids: { with: { driver: { with: { user: true as const, vehicle: true as const } } }, orderBy: [desc(bids.createdAt)] },
});

export async function createRequest(customer: User, input: CreateRideRequestInput) {
  const db = await getDb();
  await expireStale(db);

  const [existing] = await db.select({ id: rideRequests.id }).from(rideRequests).where(and(eq(rideRequests.customerId, customer.id), eq(rideRequests.status, "open"))).limit(1);
  if (existing) throw conflict("You already have an open ride request", { requestId: existing.id });

  const [activeRide] = await db
    .select({ id: rides.id })
    .from(rides)
    .where(and(eq(rides.customerId, customer.id), inArray(rides.status, [...ACTIVE_RIDE_STATUSES])))
    .limit(1);
  if (activeRide) throw conflict("Finish your current ride before requesting another", { rideId: activeRide.id });

  if (haversineKm(input.pickup, input.dropoff) < 0.2) throw badRequest("Pickup and drop-off are too close together");

  // Never trust client distance — recompute (cached) and allow a small drift.
  const [r, s] = await Promise.all([routeBetween(input.pickup, input.dropoff), getSettings()]);
  const distanceKm = Math.abs(r.distanceKm - input.distanceKm) / r.distanceKm < 0.15 ? input.distanceKm : r.distanceKm;
  const durationMin = Math.abs(r.durationMin - input.durationMin) / r.durationMin < 0.25 ? input.durationMin : r.durationMin;
  const fare = computeFare({ distanceKm, durationMin, category: input.category, settings: s });
  if (!isWithinFareBounds(input.offeredFarePkr, fare.minimumFarePkr, fare.maximumFarePkr)) {
    throw badRequest(`Offer must be between PKR ${fare.minimumFarePkr} and PKR ${fare.maximumFarePkr}`, { min: fare.minimumFarePkr, max: fare.maximumFarePkr });
  }

  const [row] = await db
    .insert(rideRequests)
    .values({
      customerId: customer.id,
      category: input.category,
      pickupLat: input.pickup.lat,
      pickupLng: input.pickup.lng,
      pickupAddress: input.pickup.address,
      pickupName: input.pickup.name ?? null,
      dropoffLat: input.dropoff.lat,
      dropoffLng: input.dropoff.lng,
      dropoffAddress: input.dropoff.address,
      dropoffName: input.dropoff.name ?? null,
      distanceKm: round2(distanceKm),
      durationMin: Math.round(durationMin),
      routePolyline: input.routePolyline ?? r.polyline,
      offeredFarePkr: input.offeredFarePkr,
      minFarePkr: fare.minimumFarePkr,
      maxFarePkr: fare.maximumFarePkr,
      recommendedFarePkr: fare.recommendedFarePkr,
      fareBreakdown: fare,
      passengers: input.passengers,
      note: input.note ?? null,
      expiresAt: new Date(Date.now() + s.requestTtlSeconds * 1000),
    })
    .returning();
  return getRequestById(row!.id);
}

export async function getRequestById(id: string) {
  const db = await getDb();
  const r = await db.query.rideRequests.findFirst({ where: eq(rideRequests.id, id), with: requestWith() });
  if (!r) throw notFound("Ride request not found");
  return toRequestDto({ ...r, bids: r.bids.filter((b) => b.status === "pending" || b.status === "accepted") });
}

export async function getCustomerRequest(customer: User, id: string) {
  const db = await getDb();
  await expireStale(db);
  const r = await db.query.rideRequests.findFirst({ where: and(eq(rideRequests.id, id), eq(rideRequests.customerId, customer.id)), with: requestWith() });
  if (!r) throw notFound("Ride request not found");
  return toRequestDto({ ...r, bids: r.bids.filter((b) => b.status === "pending" || b.status === "accepted") });
}

export async function getCustomerActiveRequest(customer: User) {
  const db = await getDb();
  await expireStale(db);
  const r = await db.query.rideRequests.findFirst({
    where: and(eq(rideRequests.customerId, customer.id), eq(rideRequests.status, "open")),
    with: requestWith(),
    orderBy: [desc(rideRequests.createdAt)],
  });
  return r ? toRequestDto({ ...r, bids: r.bids.filter((b) => b.status === "pending") }) : null;
}

export async function updateOffer(customer: User, id: string, offeredFarePkr: number) {
  const db = await getDb();
  const [r] = await db.select().from(rideRequests).where(and(eq(rideRequests.id, id), eq(rideRequests.customerId, customer.id))).limit(1);
  if (!r) throw notFound("Ride request not found");
  if (r.status !== "open") throw conflict("This request is no longer open");
  if (!isWithinFareBounds(offeredFarePkr, r.minFarePkr, r.maxFarePkr)) throw badRequest(`Offer must be between PKR ${r.minFarePkr} and PKR ${r.maxFarePkr}`);
  const s = await getSettings();
  const updated = await db
    .update(rideRequests)
    .set({ offeredFarePkr, updatedAt: new Date(), expiresAt: new Date(Date.now() + s.requestTtlSeconds * 1000) })
    .where(and(eq(rideRequests.id, id), eq(rideRequests.status, "open")))
    .returning({ id: rideRequests.id });
  if (updated.length === 0) throw conflict("This request is no longer open");
  return getRequestById(id);
}

export async function cancelRequest(customer: User, id: string, reason?: string) {
  const db = await getDb();
  const [r] = await db.select().from(rideRequests).where(and(eq(rideRequests.id, id), eq(rideRequests.customerId, customer.id))).limit(1);
  if (!r) throw notFound("Ride request not found");
  if (r.status !== "open") throw conflict("This request is no longer open");
  const now = new Date();
  await db.transaction(async (tx) => {
    const cancelled = await tx
      .update(rideRequests)
      .set({ status: "cancelled", cancelReason: reason ?? null, closedAt: now, updatedAt: now })
      .where(and(eq(rideRequests.id, id), eq(rideRequests.status, "open")))
      .returning({ id: rideRequests.id });
    if (cancelled.length === 0) throw conflict("This request is no longer open");
    const pending = await tx.update(bids).set({ status: "rejected", respondedAt: now }).where(and(eq(bids.requestId, id), eq(bids.status, "pending"))).returning({ driverId: bids.driverId });
    for (const b of pending) {
      const [d] = await tx.select({ userId: drivers.userId }).from(drivers).where(eq(drivers.id, b.driverId)).limit(1);
      if (d) await notify(d.userId, { type: "request_cancelled", title: "Request cancelled", body: "The passenger cancelled their request.", data: { requestId: id } });
    }
  });
  return getRequestById(id);
}

export async function acceptBid(customer: User, requestId: string, bidId: string) {
  const db = await getDb();
  const s = await getSettings();
  const rideId = await db.transaction(async (tx) => {
    // Lock the request row — this is what makes double-accept impossible.
    const [r] = await tx.select().from(rideRequests).where(and(eq(rideRequests.id, requestId), eq(rideRequests.customerId, customer.id))).for("update").limit(1);
    if (!r) throw notFound("Ride request not found");
    if (r.status !== "open") throw conflict("This request is no longer open");
    const now = new Date();
    const [b] = await tx.select().from(bids).where(and(eq(bids.id, bidId), eq(bids.requestId, requestId))).for("update").limit(1);
    if (!b) throw notFound("Bid not found");
    if (b.status !== "pending" || b.expiresAt.getTime() < now.getTime()) throw conflict("This offer has expired. Pick another driver.");
    const [drv] = await tx.select().from(drivers).where(eq(drivers.id, b.driverId)).for("update").limit(1);
    if (!drv || drv.status !== "approved") throw conflict("This driver is no longer available");
    const [busy] = await tx.select({ id: rides.id }).from(rides).where(and(eq(rides.driverId, drv.id), inArray(rides.status, [...ACTIVE_RIDE_STATUSES]))).limit(1);
    if (busy) throw conflict("This driver just took another ride. Pick another driver.");

    const [ride] = await tx
      .insert(rides)
      .values({
        requestId,
        bidId,
        customerId: customer.id,
        driverId: drv.id,
        status: "assigned",
        category: r.category,
        farePkr: b.amountPkr,
        commissionPkr: Math.round((b.amountPkr * s.commissionPercent) / 100),
        pickupLat: r.pickupLat,
        pickupLng: r.pickupLng,
        pickupAddress: r.pickupAddress,
        pickupName: r.pickupName,
        dropoffLat: r.dropoffLat,
        dropoffLng: r.dropoffLng,
        dropoffAddress: r.dropoffAddress,
        dropoffName: r.dropoffName,
        distanceKm: r.distanceKm,
        durationMin: r.durationMin,
        routePolyline: r.routePolyline,
      })
      .returning({ id: rides.id });

    await tx.update(bids).set({ status: "accepted", respondedAt: now }).where(eq(bids.id, bidId));
    const losers = await tx
      .update(bids)
      .set({ status: "rejected", respondedAt: now })
      .where(and(eq(bids.requestId, requestId), eq(bids.status, "pending"), ne(bids.id, bidId)))
      .returning({ driverId: bids.driverId });
    await tx.update(rideRequests).set({ status: "accepted", rideId: ride!.id, closedAt: now, updatedAt: now }).where(eq(rideRequests.id, requestId));
    await tx.update(drivers).set({ bidsWon: sql`${drivers.bidsWon} + 1` }).where(eq(drivers.id, drv.id));

    await notify(drv.userId, { type: "bid_accepted", title: "You got the ride! 🎉", body: `Head to ${r.pickupName ?? r.pickupAddress}. Fare PKR ${b.amountPkr}.`, data: { rideId: ride!.id } });
    for (const l of losers) {
      const [ld] = await tx.select({ userId: drivers.userId }).from(drivers).where(eq(drivers.id, l.driverId)).limit(1);
      if (ld) await notify(ld.userId, { type: "bid_rejected", title: "Passenger chose another driver", body: "Keep an eye out — more requests are coming.", data: { requestId } });
    }
    return ride!.id;
  });
  return getRideForUser(rideId, customer.id);
}

/* ------------------------------------------------------------------ */
/* Driver: feed & bids                                                 */
/* ------------------------------------------------------------------ */

/** Which request categories a vehicle of a given category may serve. */
export function servableCategories(vehicleCategory: VehicleCategory): VehicleCategory[] {
  switch (vehicleCategory) {
    case "car_premium":
      return ["car_premium", "car_ac", "car"];
    case "car_ac":
      return ["car_ac", "car"];
    default:
      return [vehicleCategory];
  }
}

export async function assertDriverOperational(driver: Driver) {
  const db = await getDb();
  if (driver.status !== "approved") throw forbidden("Your driver account is not approved yet");
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.driverId, driver.id), eq(subscriptions.status, "active"), gt(subscriptions.endsAt, new Date())))
    .limit(1);
  if (!isSubscriptionActive(sub)) throw forbidden("Your monthly subscription has expired. Renew to continue.");
}

export async function driverFeed(driver: Driver): Promise<DriverRequestFeedItem[]> {
  const db = await getDb();
  await expireStale(db);
  if (driver.lastLat == null || driver.lastLng == null) return [];
  const vehicle = await db.query.vehicles.findFirst({ where: eq(vehicles.driverId, driver.id) });
  if (!vehicle) return [];
  const s = await getSettings();
  const here = { lat: driver.lastLat, lng: driver.lastLng };
  const dLat = s.matchRadiusKm / 111.32;
  const dLng = s.matchRadiusKm / (111.32 * Math.cos((here.lat * Math.PI) / 180));
  const cats = servableCategories(vehicle.category);

  const rows = await db.query.rideRequests.findMany({
    where: and(
      eq(rideRequests.status, "open"),
      gt(rideRequests.expiresAt, new Date()),
      inArray(rideRequests.category, cats),
      sql`${rideRequests.pickupLat} between ${here.lat - dLat} and ${here.lat + dLat}`,
      sql`${rideRequests.pickupLng} between ${here.lng - dLng} and ${here.lng + dLng}`,
    ),
    with: { customer: true, bids: { where: eq(bids.driverId, driver.id), with: { driver: { with: { user: true, vehicle: true } } } } },
    orderBy: [desc(rideRequests.updatedAt)],
    limit: 30,
  });

  return rows
    .map((r) => {
      const distanceToPickupKm = haversineKm(here, { lat: r.pickupLat, lng: r.pickupLng }) * 1.3;
      if (distanceToPickupKm > s.matchRadiusKm * 1.3) return null;
      const economics = computeFare({ distanceKm: r.distanceKm, durationMin: r.durationMin, category: r.category, kmPerLitre: vehicle.kmPerLitre, settings: s });
      const myBid = r.bids.find((b) => b.status === "pending") ?? r.bids[0] ?? null;
      const dto = toRequestDto({ ...r, bids: [] });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { bids: _omit, ...request } = dto;
      return {
        request,
        distanceToPickupKm: round2(distanceToPickupKm),
        etaToPickupMin: Math.max(1, Math.round((distanceToPickupKm / 22) * 60)),
        economics,
        myBid: myBid ? toBidDto(myBid) : null,
      } satisfies DriverRequestFeedItem;
    })
    .filter((x): x is DriverRequestFeedItem => x !== null)
    .sort((a, b) => a.distanceToPickupKm - b.distanceToPickupKm);
}

export async function placeBid(driver: Driver, requestId: string, input: { amountPkr: number; etaMin: number; message?: string }) {
  const db = await getDb();
  await assertDriverOperational(driver);
  await expireStale(db);
  if (!driver.isOnline) throw forbidden("Go online to send offers");

  const [busy] = await db.select({ id: rides.id }).from(rides).where(and(eq(rides.driverId, driver.id), inArray(rides.status, [...ACTIVE_RIDE_STATUSES]))).limit(1);
  if (busy) throw conflict("Finish your current ride first", { rideId: busy.id });

  const [r] = await db.select().from(rideRequests).where(eq(rideRequests.id, requestId)).limit(1);
  if (!r) throw notFound("Ride request not found");
  if (r.status !== "open" || r.expiresAt.getTime() < Date.now()) throw conflict("This request is no longer open");
  if (!isWithinFareBounds(input.amountPkr, r.minFarePkr, r.maxFarePkr)) throw badRequest(`Offer must be between PKR ${r.minFarePkr} and PKR ${r.maxFarePkr}`);

  const vehicle = await db.query.vehicles.findFirst({ where: eq(vehicles.driverId, driver.id) });
  if (!vehicle || !servableCategories(vehicle.category).includes(r.category)) throw forbidden("Your vehicle cannot serve this ride category");

  const pendingCount = await db.select({ n: sql<number>`count(*)` }).from(bids).where(and(eq(bids.driverId, driver.id), eq(bids.status, "pending")));
  const s = await getSettings();
  const expiresAt = new Date(Math.min(Date.now() + s.bidTtlSeconds * 1000, r.expiresAt.getTime()));
  const here = driver.lastLat != null && driver.lastLng != null ? { lat: driver.lastLat, lng: driver.lastLng } : null;
  const distanceToPickupKm = here ? round2(haversineKm(here, { lat: r.pickupLat, lng: r.pickupLng }) * 1.3) : null;

  const [existing] = await db.select().from(bids).where(and(eq(bids.requestId, requestId), eq(bids.driverId, driver.id), eq(bids.status, "pending"))).limit(1);
  let bidId: string;
  if (existing) {
    await db
      .update(bids)
      .set({ amountPkr: input.amountPkr, etaMin: input.etaMin, message: input.message ?? null, expiresAt, driverLat: here?.lat ?? null, driverLng: here?.lng ?? null, distanceToPickupKm, updatedAt: new Date() })
      .where(eq(bids.id, existing.id));
    bidId = existing.id;
  } else {
    if (Number(pendingCount[0]?.n ?? 0) >= MARKET_RULES.maxPendingBidsPerDriver) throw conflict("You have too many open offers. Wait for a response first.");
    const [b] = await db
      .insert(bids)
      .values({ requestId, driverId: driver.id, amountPkr: input.amountPkr, etaMin: input.etaMin, message: input.message ?? null, expiresAt, driverLat: here?.lat ?? null, driverLng: here?.lng ?? null, distanceToPickupKm })
      .returning({ id: bids.id });
    bidId = b!.id;
    await db.update(drivers).set({ bidsPlaced: sql`${drivers.bidsPlaced} + 1` }).where(eq(drivers.id, driver.id));
  }
  await db.update(rideRequests).set({ updatedAt: new Date() }).where(eq(rideRequests.id, requestId));
  const [drvUser] = await db.select({ fullName: users.fullName }).from(users).where(eq(users.id, driver.userId)).limit(1);
  await notify(r.customerId, {
    type: "new_bid",
    title: input.amountPkr === r.offeredFarePkr ? "A driver accepted your price" : "New offer received",
    body: `${drvUser?.fullName ?? "A driver"} — PKR ${input.amountPkr}, ${input.etaMin} min away`,
    data: { requestId, bidId },
  });
  const full = await db.query.bids.findFirst({ where: eq(bids.id, bidId), with: { driver: { with: { user: true, vehicle: true } } } });
  return toBidDto(full!);
}

export async function withdrawBid(driver: Driver, bidId: string) {
  const db = await getDb();
  const [b] = await db.select().from(bids).where(and(eq(bids.id, bidId), eq(bids.driverId, driver.id))).limit(1);
  if (!b) throw notFound("Offer not found");
  if (b.status !== "pending") throw conflict("This offer is no longer pending");
  const withdrawn = await db
    .update(bids)
    .set({ status: "withdrawn", respondedAt: new Date() })
    .where(and(eq(bids.id, bidId), eq(bids.status, "pending")))
    .returning({ id: bids.id });
  if (withdrawn.length === 0) throw conflict("This offer is no longer pending");
  await db.update(rideRequests).set({ updatedAt: new Date() }).where(eq(rideRequests.id, b.requestId));
  return { ok: true };
}

export async function driverPendingBids(driver: Driver) {
  const db = await getDb();
  await expireStale(db);
  const rows = await db.query.bids.findMany({
    where: and(eq(bids.driverId, driver.id), eq(bids.status, "pending")),
    with: { driver: { with: { user: true, vehicle: true } } },
    orderBy: [desc(bids.createdAt)],
  });
  return rows.map(toBidDto);
}

/* ------------------------------------------------------------------ */
/* Rides                                                               */
/* ------------------------------------------------------------------ */

const rideWith = { customer: true, driver: { with: { user: true, vehicle: true } }, ratings: true } as const;

export async function getRideForUser(rideId: string, userId: string) {
  const db = await getDb();
  const r = await db.query.rides.findFirst({ where: eq(rides.id, rideId), with: rideWith });
  if (!r) throw notFound("Ride not found");
  const isCustomer = r.customerId === userId;
  const isDriver = r.driver.userId === userId;
  if (!isCustomer && !isDriver) throw forbidden();
  const lastRead = isCustomer ? r.customerLastReadAt : r.driverLastReadAt;
  const [unread] = await db
    .select({ n: sql<number>`count(*)` })
    .from(rideMessages)
    .where(and(eq(rideMessages.rideId, rideId), ne(rideMessages.senderId, userId), lastRead ? gt(rideMessages.createdAt, lastRead) : sql`true`));
  return toRideDto(r as RideWithRelations, userId, Number(unread?.n ?? 0));
}

export async function getActiveRideForUser(userId: string, role: "customer" | "driver") {
  const db = await getDb();
  let r;
  if (role === "customer") {
    r = await db.query.rides.findFirst({ where: and(eq(rides.customerId, userId), inArray(rides.status, [...ACTIVE_RIDE_STATUSES])), with: rideWith, orderBy: [desc(rides.createdAt)] });
  } else {
    const d = await db.query.drivers.findFirst({ where: eq(drivers.userId, userId) });
    if (!d) return null;
    r = await db.query.rides.findFirst({ where: and(eq(rides.driverId, d.id), inArray(rides.status, [...ACTIVE_RIDE_STATUSES])), with: rideWith, orderBy: [desc(rides.createdAt)] });
  }
  return r ? toRideDto(r as RideWithRelations, userId) : null;
}

export async function listRidesForUser(userId: string, role: "customer" | "driver", page: number, pageSize: number) {
  const db = await getDb();
  let where;
  if (role === "customer") where = eq(rides.customerId, userId);
  else {
    const d = await db.query.drivers.findFirst({ where: eq(drivers.userId, userId) });
    if (!d) return { items: [], page, pageSize, total: 0 };
    where = eq(rides.driverId, d.id);
  }
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(rides).where(where);
  const rows = await db.query.rides.findMany({ where, with: rideWith, orderBy: [desc(rides.createdAt)], limit: pageSize, offset: (page - 1) * pageSize });
  return { items: rows.map((r) => toRideDto(r as RideWithRelations, userId)), page, pageSize, total: Number(n) };
}

async function loadRideForDriver(driver: Driver, rideId: string) {
  const db = await getDb();
  const [r] = await db.select().from(rides).where(and(eq(rides.id, rideId), eq(rides.driverId, driver.id))).limit(1);
  if (!r) throw notFound("Ride not found");
  return r;
}

export async function driverArrived(driver: Driver, rideId: string) {
  const db = await getDb();
  const r = await loadRideForDriver(driver, rideId);
  if (r.status !== "assigned") throw conflict("Ride is not in the heading-to-pickup state");
  await db.update(rides).set({ status: "arrived", arrivedAt: new Date(), updatedAt: new Date() }).where(eq(rides.id, rideId));
  await notify(r.customerId, { type: "driver_arrived", title: "Your driver has arrived", body: "Look for the vehicle at your pickup point.", data: { rideId } });
  return getRideForUser(rideId, driver.userId);
}

export async function startRide(driver: Driver, rideId: string) {
  const db = await getDb();
  const r = await loadRideForDriver(driver, rideId);
  if (r.status !== "arrived" && r.status !== "assigned") throw conflict("Ride cannot be started from its current state");
  await db.update(rides).set({ status: "in_progress", startedAt: new Date(), arrivedAt: r.arrivedAt ?? new Date(), updatedAt: new Date() }).where(eq(rides.id, rideId));
  await notify(r.customerId, { type: "ride_started", title: "Ride started", body: "Enjoy your trip. Share your live location with family from the ride screen.", data: { rideId } });
  return getRideForUser(rideId, driver.userId);
}

export async function completeRide(driver: Driver, rideId: string) {
  const db = await getDb();
  const r = await loadRideForDriver(driver, rideId);
  if (r.status !== "in_progress") throw conflict("Only a ride in progress can be completed");
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.update(rides).set({ status: "completed", completedAt: now, updatedAt: now }).where(eq(rides.id, rideId));
    // 100% of the fare goes to the driver — commission is always 0.
    await tx
      .update(drivers)
      .set({ totalRides: sql`${drivers.totalRides} + 1`, totalEarningsPkr: sql`${drivers.totalEarningsPkr} + ${r.farePkr - r.commissionPkr}` })
      .where(eq(drivers.id, driver.id));
  });
  await notify(r.customerId, { type: "ride_completed", title: `Ride complete — PKR ${r.farePkr}`, body: "Please pay the driver in cash and rate your trip.", data: { rideId } });
  return getRideForUser(rideId, driver.userId);
}

export async function cancelRide(userId: string, role: "customer" | "driver", rideId: string, reason: string, details?: string) {
  const db = await getDb();
  const r = await db.query.rides.findFirst({ where: eq(rides.id, rideId), with: { driver: true } });
  if (!r) throw notFound("Ride not found");
  const allowed = role === "customer" ? r.customerId === userId : r.driver.userId === userId;
  if (!allowed) throw forbidden();
  if (!ACTIVE_RIDE_STATUSES.includes(r.status)) throw conflict("This ride can no longer be cancelled");
  if (r.status === "in_progress" && role === "customer") throw conflict("You cannot cancel a ride that is already in progress. Ask the driver to end the trip.");
  const now = new Date();
  await db
    .update(rides)
    .set({ status: role === "customer" ? "cancelled_by_customer" : "cancelled_by_driver", cancelledAt: now, cancelledBy: role, cancelReason: reason, cancelDetails: details ?? null, updatedAt: now })
    .where(eq(rides.id, rideId));
  const target = role === "customer" ? r.driver.userId : r.customerId;
  await notify(target, { type: "ride_cancelled", title: "Ride cancelled", body: `${role === "customer" ? "The passenger" : "The driver"} cancelled: ${reason}`, data: { rideId } });
  return getRideForUser(rideId, userId);
}

export async function rateRide(userId: string, rideId: string, stars: number, comment?: string, tags?: string[]) {
  const db = await getDb();
  const r = await db.query.rides.findFirst({ where: eq(rides.id, rideId), with: { driver: true } });
  if (!r) throw notFound("Ride not found");
  if (r.status !== "completed") throw conflict("You can only rate completed rides");
  const isCustomer = r.customerId === userId;
  const isDriver = r.driver.userId === userId;
  if (!isCustomer && !isDriver) throw forbidden();
  const rateeId = isCustomer ? r.driver.userId : r.customerId;
  await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(ratings)
      .values({ rideId, raterId: userId, rateeId, stars, comment: comment ?? null, tags: tags ?? null })
      .onConflictDoNothing()
      .returning({ id: ratings.id });
    if (inserted.length === 0) throw conflict("You already rated this ride");
    await tx.update(users).set({ ratingSum: sql`${users.ratingSum} + ${stars}`, ratingCount: sql`${users.ratingCount} + 1` }).where(eq(users.id, rateeId));
  });
  return getRideForUser(rideId, userId);
}

/* ------------------------------------------------------------------ */
/* Driver presence & tracking                                          */
/* ------------------------------------------------------------------ */

export async function setDriverOnline(driver: Driver, online: boolean) {
  const db = await getDb();
  if (online) await assertDriverOperational(driver);
  await db.update(drivers).set({ isOnline: online, updatedAt: new Date() }).where(eq(drivers.id, driver.id));
  if (!online) {
    // Going offline withdraws pending offers so passengers aren't left waiting.
    await db.update(bids).set({ status: "withdrawn", respondedAt: new Date() }).where(and(eq(bids.driverId, driver.id), eq(bids.status, "pending")));
  }
  return { online };
}

export async function recordDriverLocation(driver: Driver, p: { lat: number; lng: number; heading?: number | null; speedKmh?: number | null; recordedAt?: string }) {
  const db = await getDb();
  const now = new Date();
  const reported = p.recordedAt ? new Date(p.recordedAt) : null;
  // A client-supplied timestamp may only be in the past: a future one would keep a ghost driver "online" forever.
  const at = reported && Number.isFinite(reported.getTime()) && reported.getTime() <= now.getTime() ? reported : now;
  await db
    .update(drivers)
    .set({ lastLat: p.lat, lastLng: p.lng, lastHeading: p.heading ?? null, lastSpeedKmh: p.speedKmh ?? null, lastLocationAt: at })
    .where(eq(drivers.id, driver.id));
  const [active] = await db.select({ id: rides.id }).from(rides).where(and(eq(rides.driverId, driver.id), inArray(rides.status, [...ACTIVE_RIDE_STATUSES]))).limit(1);
  if (active) {
    await db.insert(rideLocations).values({ rideId: active.id, lat: p.lat, lng: p.lng, heading: p.heading ?? null, speedKmh: p.speedKmh ?? null, recordedAt: at });
  }
  return { activeRideId: active?.id ?? null };
}

export async function rideTrail(rideId: string, userId: string) {
  const db = await getDb();
  await getRideForUser(rideId, userId); // authorisation
  const pts = await db
    .select({ lat: rideLocations.lat, lng: rideLocations.lng, heading: rideLocations.heading, recordedAt: rideLocations.recordedAt })
    .from(rideLocations)
    .where(eq(rideLocations.rideId, rideId))
    .orderBy(rideLocations.recordedAt)
    .limit(2000);
  return pts.map((p) => ({ lat: p.lat, lng: p.lng, heading: p.heading, recordedAt: p.recordedAt.toISOString() }));
}

/* ------------------------------------------------------------------ */
/* Ride chat                                                           */
/* ------------------------------------------------------------------ */

export async function listMessages(rideId: string, userId: string, role: "customer" | "driver") {
  const db = await getDb();
  await getRideForUser(rideId, userId);
  const rows = await db.select().from(rideMessages).where(eq(rideMessages.rideId, rideId)).orderBy(rideMessages.createdAt).limit(500);
  await db
    .update(rides)
    .set(role === "customer" ? { customerLastReadAt: new Date() } : { driverLastReadAt: new Date() })
    .where(eq(rides.id, rideId));
  return rows;
}

export async function sendMessage(rideId: string, userId: string, role: "customer" | "driver", body: string) {
  const db = await getDb();
  const ride = await getRideForUser(rideId, userId);
  if (!ACTIVE_RIDE_STATUSES.includes(ride.status)) throw conflict("Chat is only available during an active ride");
  const [m] = await db.insert(rideMessages).values({ rideId, senderId: userId, senderRole: role, body }).returning();
  const r = await db.query.rides.findFirst({ where: eq(rides.id, rideId), with: { driver: true } });
  if (r) {
    const target = role === "customer" ? r.driver.userId : r.customerId;
    await notify(target, { type: "chat", title: role === "customer" ? "Message from passenger" : "Message from driver", body: body.slice(0, 120), data: { rideId } });
  }
  return m!;
}

/* ------------------------------------------------------------------ */

export async function driverEarnings(driver: Driver) {
  const db = await getDb();
  const since = new Date();
  since.setDate(since.getDate() - 29);
  since.setHours(0, 0, 0, 0);
  const rows = await db
    .select({ day: sql<string>`to_char(${rides.completedAt} at time zone 'Asia/Karachi', 'YYYY-MM-DD')`, earnings: sql<number>`coalesce(sum(${rides.farePkr} - ${rides.commissionPkr}),0)`, n: sql<number>`count(*)` })
    .from(rides)
    .where(and(eq(rides.driverId, driver.id), eq(rides.status, "completed"), gt(rides.completedAt, since)))
    .groupBy(sql`1`)
    .orderBy(sql`1`);
  const byDay = new Map(rows.map((r) => [r.day, { earningsPkr: Number(r.earnings), rides: Number(r.n) }]));
  const daily: { date: string; earningsPkr: number; rides: number }[] = [];
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" });
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = fmt.format(d);
    const v = byDay.get(key) ?? { earningsPkr: 0, rides: 0 };
    daily.push({ date: key, ...v });
  }
  const today = daily[daily.length - 1]!;
  const week = daily.slice(-7);
  const sum = (xs: typeof daily, k: "earningsPkr" | "rides") => xs.reduce((a, b) => a + b[k], 0);
  return {
    todayPkr: today.earningsPkr,
    weekPkr: sum(week, "earningsPkr"),
    monthPkr: sum(daily, "earningsPkr"),
    totalPkr: driver.totalEarningsPkr,
    ridesToday: today.rides,
    ridesWeek: sum(week, "rides"),
    ridesTotal: driver.totalRides,
    acceptanceRate: driver.bidsPlaced > 0 ? Math.round((driver.bidsWon / driver.bidsPlaced) * 100) : 0,
    daily,
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
export { or };
