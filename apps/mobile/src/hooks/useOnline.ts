/**
 * Connectivity flag. Uses the Capacitor Network plugin on device and the
 * browser online/offline events on the web.
 */
import { useEffect, useState } from "react";
import type { PluginListenerHandle } from "@capacitor/core";
import { Network } from "@capacitor/network";
import { isNative } from "@/lib/native";

export function useOnline(): boolean {
  const [online, setOnline] = useState<boolean>(typeof navigator === "undefined" ? true : navigator.onLine);

  useEffect(() => {
    if (isNative) {
      let handle: Promise<PluginListenerHandle> | null = Network.addListener("networkStatusChange", (s) => setOnline(s.connected));
      Network.getStatus()
        .then((s) => setOnline(s.connected))
        .catch(() => {});
      return () => {
        handle?.then((h) => h.remove()).catch(() => {});
        handle = null;
      };
    }
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  return online;
}
