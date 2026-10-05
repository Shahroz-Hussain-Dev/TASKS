import { Preferences } from "@capacitor/preferences";
import { Capacitor } from "@capacitor/core";

/**
 * API base URL resolution.
 *  1. Value saved in-app (Settings → Server) — lets a built APK point at a new deployment.
 *  2. VITE_API_URL baked at build time (GitHub Actions passes the repo variable API_URL).
 *  3. Same origin when running as a web app next to the API.
 */
const KEY = "raahi.apiBaseUrl";
export const DEFAULT_API_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

let resolved: string | null = null;

export async function loadApiBaseUrl(): Promise<string> {
  if (resolved !== null) return resolved;
  try {
    const { value } = await Preferences.get({ key: KEY });
    if (value) {
      resolved = value.replace(/\/$/, "");
      return resolved;
    }
  } catch {
    /* ignore */
  }
  if (DEFAULT_API_URL) {
    resolved = DEFAULT_API_URL;
  } else if (!Capacitor.isNativePlatform() && typeof window !== "undefined") {
    resolved = window.location.origin;
  } else {
    resolved = "";
  }
  return resolved;
}

export function getApiBaseUrl(): string {
  return resolved ?? DEFAULT_API_URL;
}

export async function setApiBaseUrl(url: string) {
  const clean = url.trim().replace(/\/$/, "");
  resolved = clean;
  if (clean) await Preferences.set({ key: KEY, value: clean });
  else await Preferences.remove({ key: KEY });
}

export const MAP_STYLE_URL = import.meta.env.VITE_MAP_STYLE_URL ?? "https://tiles.openfreemap.org/styles/liberty";

export const APP_VERSION = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "1.0.0";

/** Default map centre (Lahore) before we know where the user is. */
export const DEFAULT_CENTER = { lat: 31.5204, lng: 74.3587 };
