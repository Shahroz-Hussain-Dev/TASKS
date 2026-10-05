/**
 * Speech in / speech out. Native builds use the Capacitor community plugins;
 * the web build uses the Web Speech API. Nothing here throws into React —
 * failures are reported through callbacks or swallowed.
 */
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { SpeechRecognition } from "@capacitor-community/speech-recognition";
import { TextToSpeech } from "@capacitor-community/text-to-speech";
import type { AssistantLanguage } from "./settings";

const isNative = Capacitor.isNativePlatform();

export interface ListenOptions {
  language: AssistantLanguage | string;
  onPartial?: (text: string) => void;
  onFinal: (text: string) => void;
  onError?: (message: string) => void;
}

type WebRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecognitionCtor = new () => WebRecognition;

function webRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Can this device listen at all? (Sync; native availability is confirmed when listening starts.) */
export function voiceSupported(): boolean {
  if (isNative) return true;
  return webRecognitionCtor() !== null;
}

/** Can this device read replies aloud? */
export function speechSupported(): boolean {
  if (isNative) return true;
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

const ERROR_COPY: Record<string, string> = {
  "not-allowed": "Microphone access was denied. Allow it in your phone settings to talk to Buddy.",
  "service-not-allowed": "Speech recognition is not available right now.",
  network: "Speech recognition needs an internet connection.",
  "audio-capture": "No microphone found.",
  "language-not-supported": "That language is not available for speech on this device.",
};

/**
 * Start listening. Resolves with a stop function once the recogniser is live.
 * `onFinal` fires exactly once (possibly with an empty string when nothing was heard).
 */
export async function listen(opts: ListenOptions): Promise<() => void> {
  const language = String(opts.language || "en-PK");
  let finished = false;
  let lastPartial = "";
  const finish = (text: string) => {
    if (finished) return;
    finished = true;
    opts.onFinal(text.trim());
  };
  const fail = (message: string) => {
    if (finished) return;
    finished = true;
    opts.onError?.(message);
  };

  if (isNative) {
    const handles: PluginListenerHandle[] = [];
    const cleanup = () => {
      for (const h of handles) h.remove().catch(() => {});
      handles.length = 0;
    };
    try {
      const { available } = await SpeechRecognition.available();
      if (!available) {
        fail("Speech recognition is not available on this phone.");
        return () => {};
      }
      const perm = await SpeechRecognition.requestPermissions();
      if (perm.speechRecognition !== "granted") {
        fail(ERROR_COPY["not-allowed"]!);
        return () => {};
      }
      handles.push(
        await SpeechRecognition.addListener("partialResults", ({ matches }) => {
          const text = matches?.[0] ?? "";
          if (!text) return;
          lastPartial = text;
          opts.onPartial?.(text);
        }),
      );
      handles.push(
        await SpeechRecognition.addListener("listeningState", ({ status }) => {
          if (status === "stopped") {
            cleanup();
            finish(lastPartial);
          }
        }),
      );
      const result = await SpeechRecognition.start({ language, maxResults: 1, partialResults: true, popup: false });
      // Some Android recognisers resolve with the matches instead of emitting events.
      if (result?.matches?.length) {
        cleanup();
        finish(result.matches[0] ?? "");
      }
    } catch (err) {
      cleanup();
      fail(err instanceof Error && err.message ? err.message : "Couldn't start listening. Try again.");
      return () => {};
    }
    return () => {
      SpeechRecognition.stop()
        .catch(() => {})
        .finally(() => {
          cleanup();
          finish(lastPartial);
        });
    };
  }

  const Ctor = webRecognitionCtor();
  if (!Ctor) {
    fail("Voice input is not supported in this browser. Type your message instead.");
    return () => {};
  }
  let rec: WebRecognition;
  try {
    rec = new Ctor();
    rec.lang = language;
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
  } catch {
    fail("Couldn't start the microphone.");
    return () => {};
  }
  let finalText = "";
  rec.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i]!;
      const t = r[0]?.transcript ?? "";
      if (r.isFinal) finalText += t;
      else interim += t;
    }
    const shown = (finalText + interim).trim();
    if (shown) {
      lastPartial = shown;
      opts.onPartial?.(shown);
    }
  };
  rec.onerror = (e) => {
    if (e.error === "no-speech" || e.error === "aborted") return; // onend will settle it
    fail(ERROR_COPY[e.error] ?? "Couldn't hear you. Try again.");
  };
  rec.onend = () => finish(finalText.trim() || lastPartial);
  try {
    rec.start();
  } catch {
    fail("Couldn't start the microphone.");
    return () => {};
  }
  return () => {
    try {
      rec.stop();
    } catch {
      finish(finalText.trim() || lastPartial);
    }
  };
}

let webUtterance: SpeechSynthesisUtterance | null = null;

/** Read `text` aloud. Resolves when speech ends (or immediately when unsupported). */
export async function speak(text: string, language: AssistantLanguage | string): Promise<void> {
  const clean = text.trim();
  if (!clean) return;
  const lang = String(language || "en-PK");
  if (isNative) {
    try {
      await TextToSpeech.stop().catch(() => {});
      await TextToSpeech.speak({ text: clean, lang, rate: 1.0, pitch: 1.05, volume: 1, category: "ambient" });
    } catch {
      /* no TTS engine installed — stay silent */
    }
    return;
  }
  if (!speechSupported()) return;
  await new Promise<void>((resolve) => {
    try {
      const synth = window.speechSynthesis;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = lang;
      u.rate = 1.0;
      u.pitch = 1.05;
      const voices = synth.getVoices();
      const match = voices.find((v) => v.lang.toLowerCase() === lang.toLowerCase()) ?? voices.find((v) => v.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()));
      if (match) u.voice = match;
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        if (webUtterance === u) webUtterance = null;
        resolve();
      };
      u.onend = done;
      u.onerror = done;
      // Chrome occasionally never fires onend for long utterances; cap the wait.
      window.setTimeout(done, Math.min(30_000, 2_500 + clean.length * 90));
      webUtterance = u;
      synth.speak(u);
    } catch {
      resolve();
    }
  });
}

/** Cut any speech short (sheet closed, user tapped the mic). */
export function stopSpeaking() {
  if (isNative) {
    TextToSpeech.stop().catch(() => {});
    return;
  }
  try {
    if (speechSupported()) window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
  webUtterance = null;
}
