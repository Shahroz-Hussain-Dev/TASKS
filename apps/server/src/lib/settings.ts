import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { settings } from "@/db/schema";
import { DEFAULT_SETTINGS, type PlatformSettings } from "@raahi/shared";

let cache: { value: PlatformSettings; at: number } | null = null;
const TTL = 30_000;

export async function getSettings(force = false): Promise<PlatformSettings> {
  if (!force && cache && Date.now() - cache.at < TTL) return cache.value;
  const db = await getDb();
  const [row] = await db.select().from(settings).where(eq(settings.key, "platform")).limit(1);
  const merged: PlatformSettings = {
    ...DEFAULT_SETTINGS,
    ...((row?.value as Partial<PlatformSettings>) ?? {}),
    paymentInstructions: {
      ...DEFAULT_SETTINGS.paymentInstructions,
      ...(((row?.value as Partial<PlatformSettings>)?.paymentInstructions as Partial<PlatformSettings["paymentInstructions"]>) ?? {}),
    },
    // Raahi never takes a cut — enforce regardless of what is stored.
    commissionPercent: 0,
  };
  cache = { value: merged, at: Date.now() };
  return merged;
}

export async function updateSettings(patch: Partial<PlatformSettings>, actorId: string): Promise<PlatformSettings> {
  const current = await getSettings(true);
  const next: PlatformSettings = {
    ...current,
    ...patch,
    paymentInstructions: { ...current.paymentInstructions, ...(patch.paymentInstructions ?? {}) },
    commissionPercent: 0,
  };
  const db = await getDb();
  await db
    .insert(settings)
    .values({ key: "platform", value: next, updatedBy: actorId, updatedAt: new Date() })
    .onConflictDoUpdate({ target: settings.key, set: { value: next, updatedBy: actorId, updatedAt: new Date() } });
  cache = { value: next, at: Date.now() };
  return next;
}
