import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import type { Db } from "./index";
import { settings, users } from "./schema";
import { DEFAULT_SETTINGS } from "@raahi/shared";
import { env, isProd } from "@/lib/env";

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
    let password = e.ADMIN_PASSWORD;
    if (!password) {
      if (isProd()) {
        // Never ship a well-known default on a public deployment: mint a one-time random password
        // and print it to the deployment logs (visible only to the project owner), like a first-boot token.
        password = randomBytes(12).toString("base64url");
        console.warn(
          `[seed] ADMIN_PASSWORD is not set. Created ${e.ADMIN_EMAIL} with the one-time password "${password}" — sign in now and change it from the admin panel, or set ADMIN_PASSWORD and redeploy.`,
        );
      } else {
        password = "ChangeMe-Raahi-2026!";
        console.warn("[seed] ADMIN_PASSWORD not set — created admin with the development default password.");
      }
    }
    await db.insert(users).values({
      role: "admin",
      fullName: e.ADMIN_NAME,
      email: e.ADMIN_EMAIL.toLowerCase(),
      passwordHash: await bcrypt.hash(password, 12),
    });
  }
}
