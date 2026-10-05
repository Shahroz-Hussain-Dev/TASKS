/**
 * Assistant preferences — persisted with @capacitor/preferences under
 * `raahi.assistant.*` and shared app-wide through a tiny external store so the
 * Settings tab, the Buddy bubble and the Assistant sheet always agree.
 */
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { Preferences } from "@capacitor/preferences";

export type AssistantLanguage = "en-PK" | "ur-PK";

export interface AssistantSettings {
  /** The user's own Gemini key, sent as X-Assistant-Key. Empty = use the server key. */
  apiKey: string;
  language: AssistantLanguage;
  speakReplies: boolean;
  showBuddy: boolean;
}

export const DEFAULT_ASSISTANT_SETTINGS: AssistantSettings = {
  apiKey: "",
  language: "en-PK",
  speakReplies: true,
  showBuddy: true,
};

export const LANGUAGE_OPTIONS: { value: AssistantLanguage; label: string; short: string }[] = [
  { value: "en-PK", label: "English (Pakistan)", short: "English" },
  { value: "ur-PK", label: "Urdu", short: "اردو" },
];

const PREFIX = "raahi.assistant.";
const KEYS: Record<keyof AssistantSettings, string> = {
  apiKey: `${PREFIX}apiKey`,
  language: `${PREFIX}language`,
  speakReplies: `${PREFIX}speakReplies`,
  showBuddy: `${PREFIX}showBuddy`,
};
const HINT_KEY = `${PREFIX}hintShown`;

let current: AssistantSettings = { ...DEFAULT_ASSISTANT_SETTINGS };
let ready = false;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

async function readKey(key: string): Promise<string | null> {
  try {
    const { value } = await Preferences.get({ key });
    return value;
  } catch {
    return null;
  }
}

async function writeKey(key: string, value: string | null) {
  try {
    if (value === null || value === "") await Preferences.remove({ key });
    else await Preferences.set({ key, value });
  } catch {
    /* storage unavailable — keep the in-memory value */
  }
}

/** Load persisted settings once; safe to call many times. */
export function loadAssistantSettings(): Promise<void> {
  if (ready) return Promise.resolve();
  if (!loading) {
    loading = (async () => {
      const [apiKey, language, speak, show] = await Promise.all([readKey(KEYS.apiKey), readKey(KEYS.language), readKey(KEYS.speakReplies), readKey(KEYS.showBuddy)]);
      current = {
        apiKey: apiKey ?? "",
        language: language === "ur-PK" ? "ur-PK" : "en-PK",
        speakReplies: speak === null ? DEFAULT_ASSISTANT_SETTINGS.speakReplies : speak === "1",
        showBuddy: show === null ? DEFAULT_ASSISTANT_SETTINGS.showBuddy : show === "1",
      };
      ready = true;
      emit();
    })();
  }
  return loading;
}

/** Synchronous snapshot (defaults until `loadAssistantSettings` resolves). */
export function getAssistantSettings(): AssistantSettings {
  return current;
}

export function updateAssistantSettings(patch: Partial<AssistantSettings>) {
  current = { ...current, ...patch };
  emit();
  if (patch.apiKey !== undefined) void writeKey(KEYS.apiKey, patch.apiKey.trim());
  if (patch.language !== undefined) void writeKey(KEYS.language, patch.language);
  if (patch.speakReplies !== undefined) void writeKey(KEYS.speakReplies, patch.speakReplies ? "1" : "0");
  if (patch.showBuddy !== undefined) void writeKey(KEYS.showBuddy, patch.showBuddy ? "1" : "0");
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
const getSnapshot = () => current;
const getReady = () => ready;

/** React hook: live settings + updater. Kicks off loading on first use. */
export function useAssistantSettings() {
  const settings = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const isReady = useSyncExternalStore(subscribe, getReady, getReady);
  useEffect(() => {
    void loadAssistantSettings();
  }, []);
  const update = useCallback((patch: Partial<AssistantSettings>) => updateAssistantSettings(patch), []);
  return { settings, ready: isReady, update };
}

/** One-time Buddy speech-bubble hint: has it been shown already? */
export async function wasHintShown(): Promise<boolean> {
  return (await readKey(HINT_KEY)) === "1";
}
export async function markHintShown() {
  await writeKey(HINT_KEY, "1");
}
