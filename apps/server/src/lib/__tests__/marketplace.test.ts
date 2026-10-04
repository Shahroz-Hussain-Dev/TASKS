/**
 * Integration tests for the bidding engine against a real Postgres
 * (TEST_DATABASE_URL, default local raahi_test). Skipped automatically when the
 * database is unreachable so CI without Postgres still passes.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, type Db } from "@/db";
import { drivers, subscriptions, users, vehicles, files } from "@/db/schema";
import * as mp from "@/lib/marketplace";
import { hashPassword } from "@/lib/auth";
import { computeFare, DEFAULT_SETTINGS } from "@raahi/shared";

let db: Db;
let dbOk = false;

const LHR = { lat: 31.5204, lng: 74.3587, address: "Liberty Market, Gulberg, Lahore", name: "Liberty Market" };
const JT = { lat: 31.4697, lng: 74.2728, address: "Johar Town, Lahore", name: "Johar Town" };

async function mkCustomer(tag: string) {
  const [u] = await db
    .insert(users)
    .values({ role: "customer", fullName: `Test Passenger ${tag}`, phone: `+9230000${tag.padStart(5, "0")}`, passwordHash: await hashPassword("Passw0rd!") })
    .returning();
  return u!;
}

async function mkDriver(tag: string, opts: { approved?: boolean; subscribed?: boolean; online?: boolean; kmPerLitre?: number; category?: "car" | "car_ac" | "bike" } = {}) {
  const { approved = true, subscribed = true, online = true, kmPerLitre = 14, category = "car" } = opts;
  const [u] = await db
    .insert(users)
    .values({ role: "driver", fullName: `Test Driver ${tag}`, phone: `+9231000${tag.padStart(5, "0")}`, passwordHash: await hashPassword("Passw0rd!") })
    .returning();
  const [d] = await db
    .insert(drivers)
    .values({
      userId: u!.id,
      status: approved ? "approved" : "onboarding",
      isOnline: online,
      lastLat: 31.515,
      lastLng: 74.35,
      lastLocationAt: new Date(),
      cnic: `35202${tag.padStart(8, "0")}`,
    })
    .returning();
  await db.insert(vehicles).values({ driverId: d!.id, category, catalogId: "suzuki-cultus", make: "Suzuki", model: "Cultus", year: 2019, color: "White", plate: `LE${tag}`, kmPerLitre });
  if (subscribed) {
    const [f] = await db.insert(files).values({ ownerId: u!.id, kind: "receipt", mime: "image/jpeg", sizeBytes: 10, sha256: "x".repeat(64), storage: "db", bytes: Buffer.from("x") }).returning();
    await db.insert(subscriptions).values({ driverId: d!.id, status: "active", amountPkr: 1000, method: "jazzcash", receiptFileId: f!.id, startsAt: new Date(), endsAt: new Date(Date.now() + 30 * 86_400_000) });
  }
  return { user: u!, driver: d! };
}

beforeAll(async () => {
  try {
    db = await getDb();
    dbOk = true;
    // clean slate
    await db.delete(users);
  } catch (err) {
    console.warn("skipping marketplace integration tests — database unreachable:", err instanceof Error ? err.message : err);
  }
});

const run = (name: string, fn: () => Promise<void>) => it(name, async () => (dbOk ? fn() : undefined));

describe("marketplace", () => {
  let tagCounter = 1;
  const tag = () => String(tagCounter++);

  run("quotes a route with fares for every category and enforces bounds on create", async () => {
    const q = await mp.quote(LHR, JT);
    expect(q.distanceKm).toBeGreaterThan(5);
    expect(q.fares.car.minimumFarePkr).toBeLessThan(q.fares.car.maximumFarePkr);
    const customer = await mkCustomer(tag());
    await expect(
      mp.createRequest(customer, { pickup: LHR, dropoff: JT, category: "car", offeredFarePkr: q.fares.car.minimumFarePkr - 10, passengers: 1, distanceKm: q.distanceKm, durationMin: q.durationMin }),
    ).rejects.toMatchObject({ status: 400 });
    const req = await mp.createRequest(customer, { pickup: LHR, dropoff: JT, category: "car", offeredFarePkr: q.fares.car.recommendedFarePkr, passengers: 1, distanceKm: q.distanceKm, durationMin: q.durationMin });
    expect(req.status).toBe("open");
    expect(req.minFarePkr).toBe(q.fares.car.minimumFarePkr);
    // second open request is refused
    await expect(
      mp.createRequest(customer, { pickup: LHR, dropoff: JT, category: "car", offeredFarePkr: q.fares.car.recommendedFarePkr, passengers: 1, distanceKm: q.distanceKm, durationMin: q.durationMin }),
    ).rejects.toMatchObject({ status: 409 });
  });

  run("full bidding lifecycle: feed → bid → accept → arrive → start → complete → rate", async () => {
    const customer = await mkCustomer(tag());
    const { user: du, driver } = await mkDriver(tag(), { kmPerLitre: 24 });
    const loser = await mkDriver(tag());
    const q = await mp.quote(LHR, JT);
    const req = await mp.createRequest(customer, { pickup: LHR, dropoff: JT, category: "car", offeredFarePkr: q.fares.car.recommendedFarePkr, passengers: 2, distanceKm: q.distanceKm, durationMin: q.durationMin });

    // driver feed shows the request with personal economics using their 24 km/L car
    const feed = await mp.driverFeed(driver);
    const item = feed.find((f) => f.request.id === req.id)!;
    expect(item).toBeTruthy();
    expect(item.economics.kmPerLitre).toBe(24);
    expect(item.economics.fuelCostPkr).toBeLessThan(computeFare({ distanceKm: q.distanceKm, durationMin: q.durationMin, category: "car", settings: DEFAULT_SETTINGS }).fuelCostPkr);

    // bids outside the range are rejected
    await expect(mp.placeBid(driver, req.id, { amountPkr: req.maxFarePkr + 10, etaMin: 5 })).rejects.toMatchObject({ status: 400 });
    const bid = await mp.placeBid(driver, req.id, { amountPkr: req.offeredFarePkr + 50, etaMin: 6, message: "AC on, clean car" });
    expect(bid.status).toBe("pending");
    // counter-bid updates the same pending bid instead of creating a second one
    const bid2 = await mp.placeBid(driver, req.id, { amountPkr: req.offeredFarePkr + 20, etaMin: 5 });
    expect(bid2.id).toBe(bid.id);
    expect(bid2.amountPkr).toBe(req.offeredFarePkr + 20);
    const loserBid = await mp.placeBid(loser.driver, req.id, { amountPkr: req.offeredFarePkr, etaMin: 9 });

    const withBids = await mp.getCustomerRequest(customer, req.id);
    expect(withBids.bids).toHaveLength(2);

    // accept → ride created, other bid rejected, request closed
    const ride = await mp.acceptBid(customer, req.id, bid.id);
    expect(ride.status).toBe("assigned");
    expect(ride.farePkr).toBe(req.offeredFarePkr + 20);
    const closed = await mp.getRequestById(req.id);
    expect(closed.status).toBe("accepted");
    expect(closed.rideId).toBe(ride.id);
    const loserBids = await mp.driverPendingBids(loser.driver);
    expect(loserBids.find((b) => b.id === loserBid.id)).toBeUndefined();
    // double accept is impossible
    await expect(mp.acceptBid(customer, req.id, loserBid.id)).rejects.toMatchObject({ status: 409 });

    // ride lifecycle
    await expect(mp.startRide(loser.driver, ride.id)).rejects.toMatchObject({ status: 404 });
    const arrived = await mp.driverArrived(driver, ride.id);
    expect(arrived.status).toBe("arrived");
    const started = await mp.startRide(driver, ride.id);
    expect(started.status).toBe("in_progress");
    await expect(mp.cancelRide(customer.id, "customer", ride.id, "Changed my plans")).rejects.toMatchObject({ status: 409 });
    await mp.recordDriverLocation(driver, { lat: 31.5, lng: 74.33, heading: 180 });
    const trail = await mp.rideTrail(ride.id, customer.id);
    expect(trail.length).toBeGreaterThanOrEqual(1);
    const done = await mp.completeRide(driver, ride.id);
    expect(done.status).toBe("completed");

    // 100% to the driver
    const [d2] = await db.select().from(drivers).where(eq(drivers.id, driver.id));
    expect(d2!.totalEarningsPkr).toBe(ride.farePkr);
    expect(d2!.totalRides).toBe(1);

    // ratings both ways, once each
    const rated = await mp.rateRide(customer.id, ride.id, 5, "Great driver");
    expect(rated.myRating?.stars).toBe(5);
    await expect(mp.rateRide(customer.id, ride.id, 4)).rejects.toMatchObject({ status: 409 });
    await mp.rateRide(du.id, ride.id, 4);
    const [du2] = await db.select().from(users).where(eq(users.id, du.id));
    expect(du2!.ratingCount).toBe(1);
    expect(du2!.ratingSum).toBe(5);

    // chat only during active rides
    await expect(mp.sendMessage(ride.id, customer.id, "customer", "hello")).rejects.toMatchObject({ status: 409 });
  });

  run("drivers without approval or subscription cannot work; going offline withdraws bids", async () => {
    const customer = await mkCustomer(tag());
    const q = await mp.quote(LHR, JT);
    const req = await mp.createRequest(customer, { pickup: LHR, dropoff: JT, category: "car", offeredFarePkr: q.fares.car.recommendedFarePkr, passengers: 1, distanceKm: q.distanceKm, durationMin: q.durationMin });
    const unapproved = await mkDriver(tag(), { approved: false });
    await expect(mp.placeBid(unapproved.driver, req.id, { amountPkr: req.offeredFarePkr, etaMin: 4 })).rejects.toMatchObject({ status: 403 });
    const unpaid = await mkDriver(tag(), { subscribed: false });
    await expect(mp.setDriverOnline(unpaid.driver, true)).rejects.toMatchObject({ status: 403 });
    const bike = await mkDriver(tag(), { category: "bike" });
    await expect(mp.placeBid(bike.driver, req.id, { amountPkr: req.offeredFarePkr, etaMin: 4 })).rejects.toMatchObject({ status: 403 });
    const ok = await mkDriver(tag());
    await mp.placeBid(ok.driver, req.id, { amountPkr: req.offeredFarePkr, etaMin: 4 });
    await mp.setDriverOnline(ok.driver, false);
    expect(await mp.driverPendingBids(ok.driver)).toHaveLength(0);
    const cancelled = await mp.cancelRequest(customer, req.id, "Changed my plans");
    expect(cancelled.status).toBe("cancelled");
  });

  run("raising the offer keeps it inside the fair range and resets the timer", async () => {
    const customer = await mkCustomer(tag());
    const q = await mp.quote(LHR, JT);
    const req = await mp.createRequest(customer, { pickup: LHR, dropoff: JT, category: "bike", offeredFarePkr: q.fares.bike.minimumFarePkr, passengers: 1, distanceKm: q.distanceKm, durationMin: q.durationMin });
    const raised = await mp.updateOffer(customer, req.id, req.offeredFarePkr + 50);
    expect(raised.offeredFarePkr).toBe(req.offeredFarePkr + 50);
    expect(new Date(raised.expiresAt).getTime()).toBeGreaterThanOrEqual(new Date(req.expiresAt).getTime());
    await expect(mp.updateOffer(customer, req.id, req.maxFarePkr + 10)).rejects.toMatchObject({ status: 400 });
  });
});
