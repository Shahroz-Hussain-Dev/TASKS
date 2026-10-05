/**
 * Function tools the voice assistant can call. Each tool is a thin, authorised
 * wrapper over the marketplace services; the model never touches the DB.
 */
import type { User, Driver } from "@/db/schema";
import { VEHICLE_CATEGORIES, VEHICLE_CATEGORY_META, type LatLng, type VehicleCategory } from "@raahi/shared";
import * as mp from "@/lib/marketplace";
import { reverseGeocode, searchPlaces } from "@/lib/geo-services";
import { getSettings } from "@/lib/settings";

export interface AssistantContext {
  user: User;
  driver: Driver | null;
  location: LatLng | null;
}

export interface AssistantAction {
  type: "navigate" | "request_created" | "request_updated" | "request_cancelled" | "driver_presence";
  to?: string;
  requestId?: string;
  rideId?: string;
  online?: boolean;
}

export type ToolResult = { ok: true; data: unknown; action?: AssistantAction } | { ok: false; error: string };

/** Gemini function declarations (OpenAPI-ish schema subset). */
export const TOOL_DECLARATIONS = [
  {
    name: "search_place",
    description: "Find a place in Pakistan by name or address. Returns up to 5 candidates with coordinates. Use before quoting or booking when the user names a place.",
    parameters: {
      type: "OBJECT",
      properties: { query: { type: "STRING", description: "Place name or address as the user said it, e.g. 'Liberty Market Lahore'" } },
      required: ["query"],
    },
  },
  {
    name: "my_location",
    description: "Resolve the passenger's current GPS position to an address. Use when the user says 'from here', 'my location', or does not state a pickup.",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "quote_ride",
    description: "Get distance, duration and the fair fare range (minimum, recommended, maximum in PKR) for every vehicle category between two points.",
    parameters: {
      type: "OBJECT",
      properties: {
        pickup: { type: "OBJECT", properties: { lat: { type: "NUMBER" }, lng: { type: "NUMBER" } }, required: ["lat", "lng"] },
        dropoff: { type: "OBJECT", properties: { lat: { type: "NUMBER" }, lng: { type: "NUMBER" } }, required: ["lat", "lng"] },
      },
      required: ["pickup", "dropoff"],
    },
  },
  {
    name: "create_ride_request",
    description: "Post the ride request so nearby drivers can bid. Only call after the user confirmed pickup, drop-off, vehicle category and the offer amount. offeredFarePkr must be inside the quoted range for that category.",
    parameters: {
      type: "OBJECT",
      properties: {
        pickup: { type: "OBJECT", properties: { lat: { type: "NUMBER" }, lng: { type: "NUMBER" }, address: { type: "STRING" }, name: { type: "STRING" } }, required: ["lat", "lng", "address"] },
        dropoff: { type: "OBJECT", properties: { lat: { type: "NUMBER" }, lng: { type: "NUMBER" }, address: { type: "STRING" }, name: { type: "STRING" } }, required: ["lat", "lng", "address"] },
        category: { type: "STRING", enum: [...VEHICLE_CATEGORIES] },
        offeredFarePkr: { type: "INTEGER" },
        passengers: { type: "INTEGER" },
        note: { type: "STRING" },
      },
      required: ["pickup", "dropoff", "category", "offeredFarePkr"],
    },
  },
  {
    name: "get_active_request",
    description: "Return the passenger's currently open ride request (with bids) or active ride, if any.",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "raise_offer",
    description: "Raise (or change) the offered fare on the open request to attract drivers. Must stay inside the fair range.",
    parameters: { type: "OBJECT", properties: { offeredFarePkr: { type: "INTEGER" } }, required: ["offeredFarePkr"] },
  },
  {
    name: "cancel_request",
    description: "Cancel the passenger's open ride request. Only after the user clearly asked to cancel.",
    parameters: { type: "OBJECT", properties: { reason: { type: "STRING" } } },
  },
  {
    name: "accept_bid",
    description: "Accept a driver's bid on the open request by bid id (from get_active_request). Only after the user picked that driver.",
    parameters: { type: "OBJECT", properties: { bidId: { type: "STRING" } }, required: ["bidId"] },
  },
  {
    name: "set_driver_online",
    description: "Drivers only: go online to receive requests, or offline.",
    parameters: { type: "OBJECT", properties: { online: { type: "BOOLEAN" } }, required: ["online"] },
  },
  {
    name: "list_categories",
    description: "List vehicle categories with seats and descriptions, to ask the user which one they want.",
    parameters: { type: "OBJECT", properties: {} },
  },
] as const;

const isCategory = (c: unknown): c is VehicleCategory => typeof c === "string" && (VEHICLE_CATEGORIES as readonly string[]).includes(c);

export async function runTool(name: string, args: Record<string, unknown>, ctx: AssistantContext): Promise<ToolResult> {
  try {
    switch (name) {
      case "search_place": {
        const q = String(args.query ?? "").trim();
        if (!q) return { ok: false, error: "query is required" };
        const items = await searchPlaces(q, ctx.location, 5);
        return { ok: true, data: items.map((p) => ({ name: p.name, address: p.address, lat: p.lat, lng: p.lng })) };
      }
      case "my_location": {
        if (!ctx.location) return { ok: false, error: "The app has not shared the passenger's location yet. Ask them for a pickup place instead." };
        const r = await reverseGeocode(ctx.location);
        return { ok: true, data: { lat: ctx.location.lat, lng: ctx.location.lng, name: r.name, address: r.address } };
      }
      case "quote_ride": {
        const pickup = args.pickup as LatLng;
        const dropoff = args.dropoff as LatLng;
        const q = await mp.quote(pickup, dropoff);
        const fares = Object.fromEntries(
          Object.entries(q.fares).map(([k, f]) => [k, { label: VEHICLE_CATEGORY_META[k as VehicleCategory].label, minimumFarePkr: f.minimumFarePkr, recommendedFarePkr: f.recommendedFarePkr, maximumFarePkr: f.maximumFarePkr, fuelCostPkr: f.fuelCostPkr }]),
        );
        return { ok: true, data: { distanceKm: q.distanceKm, durationMin: q.durationMin, fares } };
      }
      case "create_ride_request": {
        if (ctx.user.role !== "customer") return { ok: false, error: "Only passengers can book rides" };
        if (!isCategory(args.category)) return { ok: false, error: "Unknown category" };
        const pickup = args.pickup as { lat: number; lng: number; address: string; name?: string };
        const dropoff = args.dropoff as { lat: number; lng: number; address: string; name?: string };
        const q = await mp.quote(pickup, dropoff);
        const req = await mp.createRequest(ctx.user, {
          pickup: { lat: pickup.lat, lng: pickup.lng, address: pickup.address, name: pickup.name },
          dropoff: { lat: dropoff.lat, lng: dropoff.lng, address: dropoff.address, name: dropoff.name },
          category: args.category,
          offeredFarePkr: Math.round(Number(args.offeredFarePkr)),
          passengers: Math.min(6, Math.max(1, Math.round(Number(args.passengers ?? 1)))),
          note: typeof args.note === "string" ? args.note.slice(0, 200) : undefined,
          distanceKm: q.distanceKm,
          durationMin: q.durationMin,
          routePolyline: q.polyline ?? undefined,
        });
        return { ok: true, data: { requestId: req.id, offeredFarePkr: req.offeredFarePkr, expiresAt: req.expiresAt }, action: { type: "request_created", requestId: req.id, to: `/c/request/${req.id}` } };
      }
      case "get_active_request": {
        if (ctx.user.role === "customer") {
          const [request, ride] = await Promise.all([mp.getCustomerActiveRequest(ctx.user), mp.getActiveRideForUser(ctx.user.id, "customer")]);
          return {
            ok: true,
            data: {
              request: request
                ? { id: request.id, offeredFarePkr: request.offeredFarePkr, minFarePkr: request.minFarePkr, maxFarePkr: request.maxFarePkr, dropoff: request.dropoff.address, bids: request.bids.map((b) => ({ bidId: b.id, driver: b.driver.fullName, rating: b.driver.ratingAvg, vehicle: b.driver.vehicle ? `${b.driver.vehicle.make} ${b.driver.vehicle.model}` : null, amountPkr: b.amountPkr, etaMin: b.etaMin })) }
                : null,
              ride: ride ? { id: ride.id, status: ride.status, driver: ride.driver.fullName, farePkr: ride.farePkr } : null,
            },
          };
        }
        const ride = await mp.getActiveRideForUser(ctx.user.id, "driver");
        return { ok: true, data: { ride: ride ? { id: ride.id, status: ride.status, passenger: ride.customer.fullName, farePkr: ride.farePkr } : null, online: ctx.driver?.isOnline ?? false } };
      }
      case "raise_offer": {
        const active = await mp.getCustomerActiveRequest(ctx.user);
        if (!active) return { ok: false, error: "There is no open request" };
        const updated = await mp.updateOffer(ctx.user, active.id, Math.round(Number(args.offeredFarePkr)));
        return { ok: true, data: { requestId: updated.id, offeredFarePkr: updated.offeredFarePkr }, action: { type: "request_updated", requestId: updated.id } };
      }
      case "cancel_request": {
        const active = await mp.getCustomerActiveRequest(ctx.user);
        if (!active) return { ok: false, error: "There is no open request" };
        await mp.cancelRequest(ctx.user, active.id, typeof args.reason === "string" ? args.reason : "Cancelled via assistant");
        return { ok: true, data: { cancelled: true }, action: { type: "request_cancelled", requestId: active.id, to: "/c/home" } };
      }
      case "accept_bid": {
        const active = await mp.getCustomerActiveRequest(ctx.user);
        if (!active) return { ok: false, error: "There is no open request" };
        const ride = await mp.acceptBid(ctx.user, active.id, String(args.bidId));
        return { ok: true, data: { rideId: ride.id, driver: ride.driver.fullName, farePkr: ride.farePkr }, action: { type: "navigate", rideId: ride.id, to: `/c/ride/${ride.id}` } };
      }
      case "set_driver_online": {
        if (!ctx.driver) return { ok: false, error: "Only drivers can go online" };
        const r = await mp.setDriverOnline(ctx.driver, Boolean(args.online));
        return { ok: true, data: r, action: { type: "driver_presence", online: r.online } };
      }
      case "list_categories": {
        const s = await getSettings();
        return { ok: true, data: { categories: VEHICLE_CATEGORIES.map((c) => ({ id: c, label: VEHICLE_CATEGORY_META[c].label, seats: VEHICLE_CATEGORY_META[c].seats, description: VEHICLE_CATEGORY_META[c].description })), petrolPricePkr: s.petrolPricePkr } };
      }
      default:
        return { ok: false, error: `Unknown tool ${name}` };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}
