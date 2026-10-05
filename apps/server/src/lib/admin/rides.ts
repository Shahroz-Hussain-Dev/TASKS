/**
 * Admin views over the marketplace: ride history, open requests and the live
 * operations board (who is online, what is open, what is moving).
 */
import { and, desc, eq, gt, ilike, inArray, isNotNull, like, or, type SQL } from "drizzle-orm";
import {
  ACTIVE_RIDE_STATUSES,
  MARKET_RULES,
  RIDE_REQUEST_STATUSES,
  RIDE_STATUSES,
  normalizePkPhone,
  type Paginated,
  type RideDto,
  type RideRequestDto,
  type VehicleCategory,
} from "@raahi/shared";
import { getDb, type Db } from "@/db";
import { bids, drivers, rideRequests, rides, users, vehicles } from "@/db/schema";
import { toRequestDto, toRideDto, type RideWithRelations } from "@/lib/mappers";
import { expireStale } from "@/lib/marketplace";
import { countAll, likePattern, paginated, statusFilter, UUID_RE, type PageParams } from "./common";

export interface LiveDriver {
  id: string;
  fullName: string;
  lat: number;
  lng: number;
  heading: number | null;
  category: VehicleCategory | null;
  plate: string | null;
  isOnline: boolean;
  updatedAt: string;
  rideId: string | null;
}

export interface LiveBoard {
  rides: RideDto[];
  drivers: LiveDriver[];
  requests: RideRequestDto[];
  serverTime: string;
}

const rideWith = { customer: true, driver: { with: { user: true, vehicle: true } }, ratings: true } as const;
const requestWith = () => ({
  customer: true as const,
  bids: { with: { driver: { with: { user: true as const, vehicle: true as const } } }, orderBy: [desc(bids.createdAt)] },
});

/** Ids of users whose name or phone matches — reused for both parties of a ride. */
function matchingUsers(db: Db, q: string) {
  const phone = normalizePkPhone(q);
  const digits = q.replace(/\D/g, "");
  const cond = phone ? eq(users.phone, phone) : digits.length >= 4 ? or(ilike(users.fullName, likePattern(q)), like(users.phone, `%${digits}%`)) : ilike(users.fullName, likePattern(q));
  return db.select({ id: users.id }).from(users).where(cond);
}

export async function listRides(p: PageParams): Promise<Paginated<RideDto>> {
  const db = await getDb();
  const status = statusFilter(p.status, RIDE_STATUSES);
  const conditions: SQL[] = [];
  if (status) conditions.push(eq(rides.status, status));
  if (p.q) {
    const people = matchingUsers(db, p.q);
    const driverIds = db.select({ id: drivers.id }).from(drivers).where(inArray(drivers.userId, people));
    const parts: SQL[] = [inArray(rides.customerId, people), inArray(rides.driverId, driverIds), ilike(rides.pickupAddress, likePattern(p.q)), ilike(rides.dropoffAddress, likePattern(p.q))];
    if (UUID_RE.test(p.q)) parts.push(eq(rides.id, p.q), eq(rides.requestId, p.q), eq(rides.driverId, p.q), eq(rides.customerId, p.q));
    conditions.push(or(...parts)!);
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [rows, [total]] = await Promise.all([
    db.query.rides.findMany({ where, with: rideWith, orderBy: [desc(rides.createdAt)], limit: p.pageSize, offset: p.offset }),
    db.select({ n: countAll }).from(rides).where(where),
  ]);
  return paginated(
    rows.map((r) => toRideDto(r as RideWithRelations, r.customerId)),
    total?.n,
    p,
  );
}

export async function listRequests(p: PageParams): Promise<Paginated<RideRequestDto>> {
  const db = await getDb();
  const status = statusFilter(p.status, RIDE_REQUEST_STATUSES);
  const conditions: SQL[] = [];
  if (status) conditions.push(eq(rideRequests.status, status));
  if (p.q) {
    const parts: SQL[] = [inArray(rideRequests.customerId, matchingUsers(db, p.q)), ilike(rideRequests.pickupAddress, likePattern(p.q)), ilike(rideRequests.dropoffAddress, likePattern(p.q))];
    if (UUID_RE.test(p.q)) parts.push(eq(rideRequests.id, p.q), eq(rideRequests.customerId, p.q));
    conditions.push(or(...parts)!);
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [rows, [total]] = await Promise.all([
    db.query.rideRequests.findMany({ where, with: requestWith(), orderBy: [desc(rideRequests.createdAt)], limit: p.pageSize, offset: p.offset }),
    db.select({ n: countAll }).from(rideRequests).where(where),
  ]);
  return paginated(rows.map((r) => toRequestDto(r)), total?.n, p);
}

/** Everything moving right now. Stale requests/bids are expired first so the board never shows ghosts. */
export async function liveBoard(): Promise<LiveBoard> {
  const db = await getDb();
  await expireStale(db);
  const now = new Date();
  const staleCutoff = new Date(now.getTime() - MARKET_RULES.driverStaleSeconds * 1000);

  const [activeRides, openRequests, onlineDrivers] = await Promise.all([
    db.query.rides.findMany({ where: inArray(rides.status, [...ACTIVE_RIDE_STATUSES]), with: rideWith, orderBy: [desc(rides.createdAt)], limit: 200 }),
    db.query.rideRequests.findMany({ where: and(eq(rideRequests.status, "open"), gt(rideRequests.expiresAt, now)), with: requestWith(), orderBy: [desc(rideRequests.createdAt)], limit: 200 }),
    db
      .select({
        id: drivers.id,
        fullName: users.fullName,
        lat: drivers.lastLat,
        lng: drivers.lastLng,
        heading: drivers.lastHeading,
        updatedAt: drivers.lastLocationAt,
        category: vehicles.category,
        plate: vehicles.plate,
      })
      .from(drivers)
      .innerJoin(users, eq(users.id, drivers.userId))
      .leftJoin(vehicles, eq(vehicles.driverId, drivers.id))
      .where(and(eq(drivers.isOnline, true), gt(drivers.lastLocationAt, staleCutoff), isNotNull(drivers.lastLat), isNotNull(drivers.lastLng)))
      .limit(500),
  ]);

  const rideByDriver = new Map(activeRides.map((r) => [r.driverId, r.id]));
  return {
    rides: activeRides.map((r) => toRideDto(r as RideWithRelations, r.customerId)),
    requests: openRequests.map((r) => toRequestDto(r)),
    drivers: onlineDrivers
      .filter((d) => d.lat != null && d.lng != null && d.updatedAt != null)
      .map((d) => ({
        id: d.id,
        fullName: d.fullName,
        lat: d.lat!,
        lng: d.lng!,
        heading: d.heading,
        category: d.category,
        plate: d.plate,
        isOnline: true,
        updatedAt: d.updatedAt!.toISOString(),
        rideId: rideByDriver.get(d.id) ?? null,
      })),
    serverTime: now.toISOString(),
  };
}
