import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import type { Db } from "./index";
import { settings, users } from "./schema";
import { DEFAULT_SETTINGS } from "@raahi/shared";
import { env } from "@/lib/env";

/**
 * Idempotent seed: platform settings row and the first admin account.
 * Runs after every migration; cheap when nothing is missing.
 */
export async function ensureSeed(db: Db) {
  const existing = await db.select({ key: settings.key }).from(settings).where(eq(settings.key, "platform")).limit(1);
  if (existing.length === 0) {
    await db.insert(settings).values({ key: "platform", value: DEFAULT_SETTINGS }).onConflictDoNothing();
  }

  const e = env();
  const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin")).limit(1);
  if (admins.length === 0) {
    const password = e.ADMIN_PASSWORD ?? "ChangeMe-Raahi-2026!";
    if (!e.ADMIN_PASSWORD) {
      console.warn(
        "[seed] ADMIN_PASSWORD not set — created admin with the default password. Change it immediately from the admin panel.",
      );
    }
    await db.insert(users).values({
      role: "admin",
      fullName: e.ADMIN_NAME,
      email: e.ADMIN_EMAIL.toLowerCase(),
      passwordHash: await bcrypt.hash(password, 12),
    });
  }
}
