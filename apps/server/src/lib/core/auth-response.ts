import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { drivers, type User } from "@/db/schema";
import { toDriverDto, toUserDto } from "@/lib/mappers";
import type { AuthResponse, AuthTokens, DriverDto } from "@raahi/shared";

const DRIVER_RELATIONS = { vehicle: true, documents: true, subscriptions: true } as const;

/**
 * Full driver profile (vehicle, documents, subscriptions) for a driver user.
 * A driver account that somehow lost its profile row gets a fresh onboarding
 * row so the app can always resume the wizard instead of dead-ending.
 */
export async function loadDriverDto(user: Pick<User, "id" | "role">): Promise<DriverDto | null> {
  if (user.role !== "driver") return null;
  const db = await getDb();
  let row = await db.query.drivers.findFirst({ where: eq(drivers.userId, user.id), with: DRIVER_RELATIONS });
  if (!row) {
    await db.insert(drivers).values({ userId: user.id, status: "onboarding" }).onConflictDoNothing();
    row = await db.query.drivers.findFirst({ where: eq(drivers.userId, user.id), with: DRIVER_RELATIONS });
  }
  return row ? toDriverDto(row) : null;
}

export async function buildAuthResponse(user: User, tokens: AuthTokens): Promise<AuthResponse> {
  return { user: toUserDto(user), driver: await loadDriverDto(user), tokens };
}
