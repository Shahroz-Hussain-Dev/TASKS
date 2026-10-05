/**
 * Soft-keyboard visibility. On Android the Capacitor Keyboard plugin reports
 * show/hide (the webview body already resizes, see capacitor.config.ts); on
 * the web we infer it from the visual viewport shrinking.
 */
import { useEffect, useState } from "react";
import type { PluginListenerHandle } from "@capacitor/core";
import { Keyboard } from "@capacitor/keyboard";
import { isNative } from "@/lib/native";

export interface KeyboardState {
  open: boolean;
  height: number;
}

export function useKeyboard(): KeyboardState {
  const [state, setState] = useState<KeyboardState>({ open: false, height: 0 });

  useEffect(() => {
    if (isNative) {
      const handles: Promise<PluginListenerHandle>[] = [
        Keyboard.addListener("keyboardWillShow", (info) => setState({ open: true, height: info.keyboardHeight })),
        Keyboard.addListener("keyboardWillHide", () => setState({ open: false, height: 0 })),
      ];
      return () => {
        for (const h of handles) h.then((x) => x.remove()).catch(() => {});
      };
    }
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      const diff = Math.round(window.innerHeight - vv.height);
      setState(diff > 120 ? { open: true, height: diff } : { open: false, height: 0 });
    };
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  return state;
}
