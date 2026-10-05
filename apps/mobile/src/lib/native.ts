import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Geolocation, type Position } from "@capacitor/geolocation";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";
import { LocalNotifications } from "@capacitor/local-notifications";
import { App } from "@capacitor/app";
import imageCompression from "browser-image-compression";
import { UPLOAD_LIMITS, type LatLng } from "@raahi/shared";

export const isNative = Capacitor.isNativePlatform();

/* ----------------------------- haptics ----------------------------- */
export const haptic = {
  light: () => isNative && Haptics.impact({ style: ImpactStyle.Light }).catch(() => {}),
  medium: () => isNative && Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {}),
  heavy: () => isNative && Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {}),
  success: () => isNative && Haptics.notification({ type: NotificationType.Success }).catch(() => {}),
  warning: () => isNative && Haptics.notification({ type: NotificationType.Warning }).catch(() => {}),
  error: () => isNative && Haptics.notification({ type: NotificationType.Error }).catch(() => {}),
  tick: () => isNative && Haptics.selectionChanged().catch(() => {}),
};

/* ----------------------------- chrome ------------------------------ */
export async function setupNativeChrome() {
  if (!isNative) return;
  try {
    await StatusBar.setStyle({ style: Style.Light });
    await StatusBar.setBackgroundColor({ color: "#FFFBF5" });
    await StatusBar.setOverlaysWebView({ overlay: true });
  } catch {
    /* web */
  }
  setTimeout(() => SplashScreen.hide({ fadeOutDuration: 300 }).catch(() => {}), 150);
}

/* ----------------------------- camera ------------------------------ */

/** Pick or capture an image, compress to upload limits, return a JPEG Blob. */
export async function pickImage(source: "camera" | "gallery" | "prompt" = "prompt"): Promise<Blob | null> {
  let blob: Blob | null = null;
  if (isNative) {
    try {
      const photo = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: source === "camera" ? CameraSource.Camera : source === "gallery" ? CameraSource.Photos : CameraSource.Prompt,
        correctOrientation: true,
        width: 1600,
        promptLabelHeader: "Add a photo",
        promptLabelPhoto: "Choose from gallery",
        promptLabelPicture: "Take a photo",
      });
      if (!photo.webPath) return null;
      blob = await (await fetch(photo.webPath)).blob();
    } catch (err) {
      if (String(err).toLowerCase().includes("cancel")) return null;
      throw err;
    }
  } else {
    blob = await new Promise<Blob | null>((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      if (source === "camera") input.capture = "environment";
      input.onchange = () => resolve(input.files?.[0] ?? null);
      input.oncancel = () => resolve(null);
      input.click();
    });
  }
  if (!blob) return null;
  const file = blob instanceof File ? blob : new File([blob], "photo.jpg", { type: blob.type || "image/jpeg" });
  const compressed = await imageCompression(file, {
    maxSizeMB: UPLOAD_LIMITS.maxBytes / 1_000_000 - 0.2,
    maxWidthOrHeight: UPLOAD_LIMITS.maxDimension,
    useWebWorker: true,
    fileType: "image/jpeg",
    initialQuality: 0.86,
  });
  return compressed;
}

/* ---------------------------- location ----------------------------- */

export interface LocationFix extends LatLng {
  heading: number | null;
  speedKmh: number | null;
  accuracyM: number | null;
  at: number;
}

const toFix = (p: Position): LocationFix => ({
  lat: p.coords.latitude,
  lng: p.coords.longitude,
  heading: p.coords.heading ?? null,
  speedKmh: p.coords.speed != null ? Math.max(0, p.coords.speed * 3.6) : null,
  accuracyM: p.coords.accuracy ?? null,
  at: p.timestamp,
});

export async function ensureLocationPermission(): Promise<boolean> {
  try {
    const status = await Geolocation.checkPermissions();
    if (status.location === "granted" || status.coarseLocation === "granted") return true;
    const req = await Geolocation.requestPermissions({ permissions: ["location"] });
    return req.location === "granted" || req.coarseLocation === "granted";
  } catch {
    return false;
  }
}

export async function getCurrentLocation(timeoutMs = 10_000): Promise<LocationFix | null> {
  try {
    const p = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 15_000 });
    return toFix(p);
  } catch {
    return null;
  }
}

export async function watchLocation(cb: (fix: LocationFix) => void): Promise<() => void> {
  let id: string | null = null;
  try {
    id = await Geolocation.watchPosition({ enableHighAccuracy: true, timeout: 15_000, maximumAge: 3_000 }, (p, err) => {
      if (p && !err) cb(toFix(p));
    });
  } catch {
    /* permission denied */
  }
  return () => {
    if (id) Geolocation.clearWatch({ id }).catch(() => {});
  };
}

/* ------------------------- local notifications ---------------------- */

let notifPermission: boolean | null = null;
export async function localNotify(title: string, body: string, id = Math.floor(Math.random() * 1e6)) {
  if (!isNative) return;
  try {
    if (notifPermission === null) {
      const p = await LocalNotifications.requestPermissions();
      notifPermission = p.display === "granted";
    }
    if (!notifPermission) return;
    await LocalNotifications.schedule({ notifications: [{ id, title, body, smallIcon: "ic_stat_raahi", schedule: { at: new Date(Date.now() + 50) } }] });
  } catch {
    /* ignore */
  }
}

/* ------------------------------ app -------------------------------- */

export function onAppStateChange(cb: (active: boolean) => void) {
  if (!isNative) {
    const h = () => cb(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", h);
    return () => document.removeEventListener("visibilitychange", h);
  }
  const sub = App.addListener("appStateChange", ({ isActive }) => cb(isActive));
  return () => {
    sub.then((s) => s.remove()).catch(() => {});
  };
}

export function onBackButton(cb: () => boolean) {
  if (!isNative) return () => {};
  const sub = App.addListener("backButton", () => {
    const handled = cb();
    if (!handled) App.exitApp();
  });
  return () => {
    sub.then((s) => s.remove()).catch(() => {});
  };
}
