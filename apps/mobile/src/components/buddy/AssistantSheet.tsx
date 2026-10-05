import { AnimatePresence, motion } from "framer-motion";
import { Broom, Microphone, PaperPlaneTilt, Stop } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Chip, IconButton, Sheet, useToast } from "@/components/ui";
import { chat, type AssistantAction, type AssistantTurn } from "@/lib/assistant/client";
import { useAssistantSettings } from "@/lib/assistant/settings";
import { listen, speak, stopSpeaking, voiceSupported } from "@/lib/assistant/voice";
import { useAuth } from "@/lib/auth";
import { springBouncy, springSoft } from "@/lib/motion";
import { getCurrentLocation, haptic, type LocationFix } from "@/lib/native";
import { cn, errorMessage } from "@/lib/utils";
import { Buddy } from "./Buddy";
import type { BuddyState } from "./types";

interface Message extends AssistantTurn {
  id: string;
}
type Mode = "idle" | "listening" | "thinking" | "speaking";
type Mood = "happy" | "sad" | null;

let counter = 0;
const nextId = () => `m${Date.now().toString(36)}${(counter++).toString(36)}`;

function greetingFor(role: "customer" | "driver" | undefined, name: string | undefined): { text: string; suggestions: string[] } {
  const first = name?.split(/\s+/)[0];
  const hi = first ? `Hi ${first}!` : "Hi!";
  if (role === "driver") return { text: `${hi} Want me to take you online, or check on your ride?`, suggestions: ["Go online", "Go offline", "Do I have a ride?"] };
  return { text: `${hi} Where should I pick you up, and where are you going?`, suggestions: ["Book a ride", "Fare to Liberty Market?", "How do fares work?"] };
}

const STATUS_COPY: Record<BuddyState, string> = {
  idle: "Tap the mic and talk to me",
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking",
  happy: "Yay!",
  sad: "Oops, that didn't work",
};

/**
 * Full-height voice assistant. Buddy on top reacts to the conversation,
 * transcript in the middle, mic + text input at the bottom.
 *
 * `autoVoice`: Buddy speaks his opening question out loud as soon as the sheet
 * opens ("Where should I pick you up, and where are you going?") and then
 * starts listening, so a tap on him is a whole hands-free booking. Only
 * signed-in screens mount this sheet, so he never talks on the welcome page.
 */
export function AssistantSheet({ open, onClose, initialPrompt, autoVoice = false }: { open: boolean; onClose: () => void; initialPrompt?: string; autoVoice?: boolean }) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Buddy"
      className="h-[92vh] flex flex-col [&>div:last-child]:flex-1 [&>div:last-child]:min-h-0 [&>div:last-child]:max-h-none [&>div:last-child]:flex [&>div:last-child]:flex-col [&>div:last-child]:overflow-hidden"
    >
      <Conversation onClose={onClose} initialPrompt={initialPrompt} autoVoice={autoVoice} />
    </Sheet>
  );
}

function Conversation({ onClose, initialPrompt, autoVoice }: { onClose: () => void; initialPrompt?: string; autoVoice: boolean }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { settings } = useAssistantSettings();
  const greeting = greetingFor(user?.role === "driver" ? "driver" : "customer", user?.fullName);

  const [messages, setMessages] = useState<Message[]>(() => [{ id: nextId(), role: "assistant", text: greeting.text }]);
  const [suggestions, setSuggestions] = useState<string[]>(greeting.suggestions);
  const [mode, setMode] = useState<Mode>("idle");
  const [mood, setMood] = useState<Mood>(null);
  const [partial, setPartial] = useState("");
  const [draft, setDraft] = useState("");
  const supported = voiceSupported();

  const alive = useRef(true);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const stopListenRef = useRef<(() => void) | null>(null);
  const moodTimer = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const locationRef = useRef<LocationFix | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const greetingRef = useRef(greeting);
  greetingRef.current = greeting;

  const buddyState: BuddyState = mood ?? mode;

  const flashMood = useCallback((m: Exclude<Mood, null>, ms = 2000) => {
    setMood(m);
    if (moodTimer.current) window.clearTimeout(moodTimer.current);
    moodTimer.current = window.setTimeout(() => alive.current && setMood(null), ms);
  }, []);

  const stopListening = useCallback(() => {
    const stop = stopListenRef.current;
    stopListenRef.current = null;
    stop?.();
  }, []);

  // Warm up the GPS so the first turn does not wait on it.
  useEffect(() => {
    alive.current = true;
    getCurrentLocation(6000).then((fix) => {
      if (fix) locationRef.current = fix;
    });
    return () => {
      alive.current = false;
      stopListenRef.current?.();
      stopListenRef.current = null;
      stopSpeaking();
      abortRef.current?.abort();
      if (moodTimer.current) window.clearTimeout(moodTimer.current);
    };
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, partial, mode, suggestions]);

  const performActions = useCallback(
    (actions: AssistantAction[]) => {
      for (const a of actions) {
        switch (a.type) {
          case "request_created":
            haptic.success();
            toast({ title: "Drivers are bidding now", body: "Pick the offer you like best.", tone: "success" });
            flashMood("happy", 1800);
            break;
          case "request_updated":
            haptic.light();
            toast({ title: "Offer updated", tone: "brand" });
            break;
          case "request_cancelled":
            toast({ title: "Request cancelled", tone: "neutral" });
            flashMood("sad", 1800);
            break;
          case "driver_presence":
            haptic.light();
            toast({ title: a.online ? "You're online" : "You're offline", body: a.online ? "New requests will reach you here." : "Take a break. Come back any time.", tone: "brand" });
            break;
          case "navigate":
            break;
        }
      }
      const target = actions.find((a) => typeof a.to === "string" && a.to.length > 0)?.to;
      if (target) {
        window.setTimeout(() => {
          navigate(target);
          onClose();
        }, 900);
      }
    },
    [flashMood, navigate, onClose, toast],
  );

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text) return;
      stopListening();
      stopSpeaking();
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      haptic.light();

      const userMsg: Message = { id: nextId(), role: "user", text };
      const history = [...messagesRef.current, userMsg];
      setMessages(history);
      setSuggestions([]);
      setPartial("");
      setDraft("");
      setMode("thinking");

      try {
        if (!locationRef.current) {
          const fix = await Promise.race([getCurrentLocation(3500), new Promise<null>((r) => window.setTimeout(() => r(null), 3800))]);
          if (fix) locationRef.current = fix;
        }
        const loc = locationRef.current;
        const reply = await chat(
          history.map(({ role, text: t }) => ({ role, text: t })),
          { location: loc ? { lat: loc.lat, lng: loc.lng } : null, signal: controller.signal },
        );
        if (!alive.current || controller.signal.aborted) return;
        setMessages((prev) => [...prev, { id: nextId(), role: "assistant", text: reply.reply }]);
        setSuggestions(reply.suggestions);
        performActions(reply.actions);
        if (settingsRef.current.speakReplies) {
          setMode("speaking");
          await speak(reply.reply, settingsRef.current.language);
        }
        if (alive.current && !controller.signal.aborted) setMode("idle");
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (!alive.current) return;
        setMode("idle");
        flashMood("sad");
        toast({ title: "Buddy couldn't answer", body: errorMessage(err, "Please try again in a moment."), tone: "error" });
      }
    },
    [flashMood, performActions, stopListening, toast],
  );

  // The opener (e.g. the mic in "Where to?") can hand Buddy a first line.
  const initialSent = useRef(false);
  useEffect(() => {
    if (initialPrompt && !initialSent.current) {
      initialSent.current = true;
      void send(initialPrompt);
    }
  }, [initialPrompt, send]);

  const toggleMic = useCallback(async () => {
    if (mode === "listening") {
      haptic.light();
      stopListening();
      return;
    }
    if (!supported) {
      toast({ title: "Voice isn't available here", body: "Type your message instead.", tone: "neutral" });
      return;
    }
    haptic.medium();
    stopSpeaking();
    abortRef.current?.abort();
    setMood(null);
    setPartial("");
    setMode("listening");
    const stop = await listen({
      language: settingsRef.current.language,
      onPartial: (t) => alive.current && setPartial(t),
      onFinal: (text) => {
        stopListenRef.current = null;
        if (!alive.current) return;
        setPartial("");
        if (text) void send(text);
        else {
          setMode("idle");
          toast({ title: "Didn't catch that", body: "Try again, a little closer to the mic.", tone: "neutral" });
        }
      },
      onError: (message) => {
        stopListenRef.current = null;
        if (!alive.current) return;
        setPartial("");
        setMode("idle");
        flashMood("sad");
        toast({ title: "Microphone trouble", body: message, tone: "error" });
      },
    });
    if (!alive.current) {
      stop();
      return;
    }
    stopListenRef.current = stop;
  }, [flashMood, mode, send, stopListening, supported, toast]);

  // Buddy opens his mouth first: say the question, then listen for the answer.
  const toggleMicRef = useRef(toggleMic);
  toggleMicRef.current = toggleMic;
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!autoVoice || initialPrompt || autoStarted.current) return;
    autoStarted.current = true;
    const run = async () => {
      // Let the sheet finish sliding in so the voice doesn't fight the animation.
      await new Promise((r) => window.setTimeout(r, 350));
      if (!alive.current) return;
      if (settingsRef.current.speakReplies) {
        setMode("speaking");
        await speak(greetingRef.current.text, settingsRef.current.language);
        if (!alive.current) return;
        setMode("idle");
      }
      if (voiceSupported()) await toggleMicRef.current();
    };
    void run();
  }, [autoVoice, initialPrompt]);

  const reset = () => {
    haptic.tick();
    stopListening();
    stopSpeaking();
    abortRef.current?.abort();
    setMessages([{ id: nextId(), role: "assistant", text: greeting.text }]);
    setSuggestions(greeting.suggestions);
    setPartial("");
    setDraft("");
    setMode("idle");
    setMood(null);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void send(draft);
  };

  const busy = mode === "thinking";
  const listening = mode === "listening";
  const stopDrag = (e: { stopPropagation: () => void }) => e.stopPropagation();

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Buddy hero */}
      <div className="relative flex flex-col items-center pt-1">
        <div className="absolute right-0 top-0">
          <IconButton icon={Broom} label="Clear conversation" size={40} variant="ghost" onClick={reset} />
        </div>
        <span className="blob absolute top-6 h-[120px] w-[150px] bg-coral-100/80 -z-0" aria-hidden />
        <div className="relative">
          <Buddy state={buddyState} size={170} />
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={STATUS_COPY[buddyState]}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className={cn("relative -mt-2 text-[13.5px] font-extrabold tracking-wide", listening ? "text-coral-600" : "text-ink-400")}
          >
            {STATUS_COPY[buddyState]}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Transcript */}
      <div ref={scrollRef} onPointerDownCapture={stopDrag} style={{ touchAction: "pan-y" }} className="mt-2 flex min-h-0 flex-1 flex-col overflow-y-auto no-scrollbar px-0.5 pb-2">
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <Bubble key={m.id} role={m.role}>
              {m.text}
            </Bubble>
          ))}
          {listening && (
            <Bubble key="partial" role="user" pending>
              {partial || "…"}
            </Bubble>
          )}
          {busy && (
            <motion.div key="typing" layout="position" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="mt-3 self-start rounded-[22px] rounded-bl-lg bg-white px-4 py-3 shadow-pillow">
              <span className="flex items-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.span key={i} className="size-2 rounded-full bg-coral-400" animate={{ y: [0, -5, 0], opacity: [0.45, 1, 0.45] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }} />
                ))}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Suggestions */}
      <AnimatePresence initial={false}>
        {suggestions.length > 0 && !busy && !listening && (
          <motion.div key="chips" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8, height: 0 }} transition={springSoft} className="flex gap-2 overflow-x-auto no-scrollbar py-1" onPointerDownCapture={stopDrag}>
            {suggestions.map((s, i) => (
              <motion.div key={s} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ...springBouncy, delay: i * 0.06 }}>
                <Chip tone="sun" onClick={() => void send(s)} className="whitespace-nowrap">
                  {s}
                </Chip>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom bar */}
      <form onSubmit={submit} className="mt-2 flex items-center gap-2.5" onPointerDownCapture={stopDrag}>
        <div className="relative shrink-0">
          <AnimatePresence>
            {listening &&
              [0, 1].map((i) => (
                <motion.span
                  key={i}
                  aria-hidden
                  className="absolute inset-0 rounded-full bg-coral-400"
                  initial={{ scale: 1, opacity: 0.45 }}
                  animate={{ scale: 1.75, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.75, ease: "easeOut" }}
                />
              ))}
          </AnimatePresence>
          <motion.button
            type="button"
            aria-label={listening ? "Stop listening" : "Talk to Buddy"}
            aria-pressed={listening}
            disabled={!supported}
            whileTap={supported ? { scale: 0.92, y: 3 } : undefined}
            onClick={() => void toggleMic()}
            className={cn(
              "jelly relative flex size-16 items-center justify-center rounded-full",
              supported ? (listening ? "jelly-ink" : "jelly-coral") : "jelly-cream text-ink-300 cursor-not-allowed",
            )}
          >
            {listening ? <Stop className="size-7" weight="fill" /> : <Microphone className="size-7" weight="duotone" />}
          </motion.button>
        </div>
        <div className="flex h-14 min-w-0 flex-1 items-center rounded-full bg-paper-100 border-2 border-transparent pl-5 pr-1.5 transition-colors focus-within:border-coral-400 focus-within:bg-white">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={supported ? "Or type here…" : "Type your message"}
            enterKeyHint="send"
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-[16px] font-semibold text-ink-900 outline-none placeholder:font-medium placeholder:text-ink-300"
          />
          <motion.button
            type="submit"
            aria-label="Send"
            disabled={!draft.trim() || busy}
            whileTap={{ scale: 0.9 }}
            className={cn("flex size-11 shrink-0 items-center justify-center rounded-full transition-colors", draft.trim() && !busy ? "bg-coral-500 text-white" : "bg-paper-200 text-ink-300")}
          >
            <PaperPlaneTilt className="size-5" weight="fill" />
          </motion.button>
        </div>
      </form>
      {!supported && <p className="mt-2 text-center text-[12.5px] font-semibold text-ink-400">Voice isn't available in this browser, so type to Buddy instead.</p>}
    </div>
  );
}

function Bubble({ role, pending, children }: { role: "user" | "assistant"; pending?: boolean; children: string }) {
  const mine = role === "user";
  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 14, x: mine ? 20 : -20, scale: 0.95 }}
      animate={{ opacity: pending ? 0.75 : 1, y: 0, x: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={springSoft}
      className={cn("mt-3 max-w-[82%] select-text whitespace-pre-wrap break-words px-4 py-2.5 text-[15px] leading-snug font-semibold", mine ? "self-end rounded-[22px] rounded-br-lg bg-coral-500 text-white shadow-[0_3px_0_0_#f2552f]" : "self-start rounded-[22px] rounded-bl-lg bg-white text-ink-800 shadow-pillow")}
    >
      {children}
    </motion.div>
  );
}
