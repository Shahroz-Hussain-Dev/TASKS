import type { AdminSettingsInput, PlatformSettings } from "@raahi/shared";
import { audit } from "@/lib/audit";
import { getSettings, updateSettings } from "@/lib/settings";
import type { AdminActor } from "./common";

type Change = { from: unknown; to: unknown };

/** Field-level diff so the audit log says exactly what moved (petrol price 380 → 392.76, etc.). */
export function diffSettings(before: PlatformSettings, after: PlatformSettings): Record<string, Change> {
  const changes: Record<string, Change> = {};
  for (const key of Object.keys(after) as (keyof PlatformSettings)[]) {
    if (key === "paymentInstructions") {
      for (const sub of Object.keys(after.paymentInstructions) as (keyof PlatformSettings["paymentInstructions"])[]) {
        if (before.paymentInstructions[sub] !== after.paymentInstructions[sub]) {
          changes[`paymentInstructions.${sub}`] = { from: before.paymentInstructions[sub], to: after.paymentInstructions[sub] };
        }
      }
    } else if (before[key] !== after[key]) {
      changes[key] = { from: before[key], to: after[key] };
    }
  }
  return changes;
}

export async function readSettings(): Promise<PlatformSettings> {
  return getSettings(true);
}

/** The admin schema allows a partial payment block; fill the gaps from the current values. */
function toSettingsPatch(input: AdminSettingsInput, current: PlatformSettings): Partial<PlatformSettings> {
  const { paymentInstructions, ...rest } = input;
  const patch: Partial<PlatformSettings> = { ...rest };
  if (paymentInstructions) {
    const merged = { ...current.paymentInstructions };
    for (const key of Object.keys(merged) as (keyof PlatformSettings["paymentInstructions"])[]) {
      const value = paymentInstructions[key];
      if (typeof value === "string") merged[key] = value.trim();
    }
    patch.paymentInstructions = merged;
  }
  return patch;
}

export async function saveSettings(actor: AdminActor, patch: AdminSettingsInput): Promise<PlatformSettings> {
  const before = await getSettings(true);
  const after = await updateSettings(toSettingsPatch(patch, before), actor.user.id);
  const changed = diffSettings(before, after);
  await audit({
    actorId: actor.user.id,
    actorRole: "admin",
    action: "admin.settings.update",
    targetType: "settings",
    ip: actor.ip,
    meta: { changed, fields: Object.keys(changed) },
  });
  return after;
}
