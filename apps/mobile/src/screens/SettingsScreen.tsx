import { useMutation } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Eye, EyeSlash, HardDrives, Info, Key, Lifebuoy, ShieldCheck, Smiley, Sparkle, SpeakerHigh, Translate } from "@phosphor-icons/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, Input, Row, Screen, Segmented, TopBar, useToast } from "@/components/ui";
import { Buddy, type BuddyState } from "@/components/buddy";
import { BackButton } from "@/components/shared/BackButton";
import { chat } from "@/lib/assistant/client";
import { LANGUAGE_OPTIONS, useAssistantSettings, type AssistantLanguage } from "@/lib/assistant/settings";
import { APP_VERSION } from "@/lib/config";
import { item, spring, springJelly, stagger } from "@/lib/motion";
import { haptic, isNative } from "@/lib/native";
import { cn, errorMessage } from "@/lib/utils";
// TEMP-GALLERY-START
import { BuddyBubble } from "@/components/buddy";
// TEMP-GALLERY-END

const LONG_PRESS_MS = 3000;

/** Settings tab — Buddy's key, voice, appearance and the app's about box (DESIGN.md §5). */
export default function SettingsScreen() {
  const navigate = useNavigate();
  const toast = useToast();
  const { settings, ready, update } = useAssistantSettings();
  const [showKey, setShowKey] = useState(false);
  const [keyDraft, setKeyDraft] = useState(settings.apiKey);
  const [mood, setMood] = useState<BuddyState>("idle");
  const [serverRevealed, setServerRevealed] = useState(false);
  const moodTimer = useRef<number | null>(null);

  // Settings load asynchronously; mirror the saved key into the field once.
  const seeded = useRef(false);
  useEffect(() => {
    if (ready && !seeded.current) {
      seeded.current = true;
      setKeyDraft(settings.apiKey);
    }
  }, [ready, settings.apiKey]);

  useEffect(() => () => {
    if (moodTimer.current) window.clearTimeout(moodTimer.current);
  }, []);

  const flash = (m: BuddyState, ms = 2400) => {
    setMood(m);
    if (moodTimer.current) window.clearTimeout(moodTimer.current);
    moodTimer.current = window.setTimeout(() => setMood("idle"), ms);
  };

  const saveKey = (value: string) => {
    setKeyDraft(value);
    update({ apiKey: value.trim() });
  };

  const test = useMutation({
    mutationFn: () => chat([{ role: "user", text: "hello" }], { apiKey: keyDraft.trim() }),
    onMutate: () => setMood("thinking"),
    onSuccess: (r) => {
      haptic.success();
      flash("happy");
      toast({ title: "Buddy says", body: r.reply.length > 140 ? `${r.reply.slice(0, 137)}…` : r.reply, tone: "success" });
    },
    onError: (err) => {
      haptic.error();
      flash("sad");
      toast({ title: "Key didn't work", body: errorMessage(err), tone: "error" });
    },
  });

  const usingOwnKey = keyDraft.trim().length > 0;

  // TEMP-GALLERY-START
  if (window.location.hash.includes("gallery")) {
    const states: BuddyState[] = ["idle", "listening", "thinking", "speaking", "happy", "sad"];
    return (
      <Screen>
        <TopBar title="Buddy gallery" />
        <div className="grid grid-cols-2 gap-2">
          {states.map((s) => (
            <div key={s} className="flex flex-col items-center pillow p-2">
              <Buddy state={s} size={170} />
              <p className="text-[12px] font-bold text-ink-500">{s}</p>
            </div>
          ))}
        </div>
        <div className="flex justify-center mt-2"><Buddy state="happy" size={240} /></div>
        <BuddyBubble />
      </Screen>
    );
  }
  // TEMP-GALLERY-END
  return (
    <Screen>
      <motion.div variants={stagger(0.07)} initial="hidden" animate="show" className="flex flex-col gap-4 pb-4">
        <motion.div variants={item.down}>
          <TopBar left={<BackButton fallback="/" />} title="Settings" subtitle="Buddy, voice and the app" />
        </motion.div>

        {/* AI assistant */}
        <motion.div variants={item.left}>
          <Card className="relative overflow-hidden p-5">
            <span className="blob absolute -right-10 -top-12 h-44 w-48 bg-coral-100" aria-hidden />
            <div className="relative flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <SectionTitle icon={Sparkle} tone="coral">
                  AI assistant
                </SectionTitle>
                <p className="mt-1 text-[14px] font-medium leading-snug text-ink-500">Buddy books rides by voice. Add your own Google Gemini key to use it instead of Raahi's.</p>
              </div>
              <Buddy state={mood} size={104} className="-mr-2 -my-3" />
            </div>
            <div className="relative mt-4 flex flex-col gap-3">
              <Input
                label="Gemini API key"
                icon={Key}
                type={showKey ? "text" : "password"}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="off"
                placeholder="AIza… (optional)"
                value={keyDraft}
                onChange={(e) => saveKey(e.target.value)}
                hint={usingOwnKey ? "Saved on this phone only. Sent with your assistant requests as X-Assistant-Key." : "Leave empty to use the key configured on the server."}
                right={
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.85 }}
                    transition={springJelly}
                    aria-label={showKey ? "Hide key" : "Show key"}
                    onClick={() => {
                      haptic.tick();
                      setShowKey((v) => !v);
                    }}
                    className="flex size-9 items-center justify-center rounded-full text-ink-400 hover:bg-paper-200"
                  >
                    {showKey ? <EyeSlash className="size-[22px]" weight="duotone" /> : <Eye className="size-[22px]" weight="duotone" />}
                  </motion.button>
                }
              />
              <Button type="button" variant={usingOwnKey ? "primary" : "secondary"} size="md" icon={Sparkle} loading={test.isPending} onClick={() => test.mutate()}>
                {usingOwnKey ? "Test key" : "Test assistant"}
              </Button>
            </div>
          </Card>
        </motion.div>

        {/* Voice */}
        <motion.div variants={item.up}>
          <Card className="p-5">
            <SectionTitle icon={Translate} tone="teal">
              Voice
            </SectionTitle>
            <p className="mb-2 mt-3 pl-1 text-[13.5px] font-extrabold tracking-wide text-ink-600">Language</p>
            <Segmented<AssistantLanguage>
              tone="teal"
              value={settings.language}
              onChange={(v) => update({ language: v })}
              options={LANGUAGE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            />
            <div className="mt-2">
              <Row
                icon={SpeakerHigh}
                tone="teal"
                label="Speak replies aloud"
                onClick={() => update({ speakReplies: !settings.speakReplies })}
                right={<Toggle checked={settings.speakReplies} tone="teal" />}
              />
            </div>
          </Card>
        </motion.div>

        {/* Appearance */}
        <motion.div variants={item.right}>
          <Card className="p-5 pb-3">
            <SectionTitle icon={Smiley} tone="sun">
              Appearance
            </SectionTitle>
            <div className="mt-2">
              <Row icon={Smiley} tone="sun" label="Buddy on home" value={settings.showBuddy ? "Shown" : "Hidden"} onClick={() => update({ showBuddy: !settings.showBuddy })} right={<Toggle checked={settings.showBuddy} tone="coral" />} />
            </div>
          </Card>
        </motion.div>

        {/* Notifications & help */}
        <motion.div variants={item.up}>
          <Card className="px-5 py-2">
            <Row icon={Bell} tone="lavender" label="Notifications" onClick={() => navigate("/notifications")} right={<Chevron />} />
            <div className="h-px bg-paper-200" />
            <Row icon={Lifebuoy} tone="sky" label="Help & support" onClick={() => navigate("/support")} right={<Chevron />} />
          </Card>
        </motion.div>

        {/* About */}
        <motion.div variants={item.up}>
          <Card className="p-5">
            <SectionTitle icon={Info} tone="lavender">
              About
            </SectionTitle>
            <div className="mt-3 flex items-start gap-3">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-[18px] bg-sunrise text-white shadow-pillow">
                <ShieldCheck className="size-6" weight="duotone" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-[18px] font-semibold text-ink-900">Raahi</p>
                <p className="text-[14px] font-medium leading-snug text-ink-500">Fair-price rides for Pakistan. You name the fare, drivers bid, and every rupee goes to the driver.</p>
              </div>
            </div>
            <VersionLabel
              onUnlock={() => {
                haptic.success();
                setServerRevealed(true);
                toast({ title: "Server settings unlocked", body: "Point the app at a different Raahi deployment.", tone: "brand" });
              }}
            />
            <AnimatePresence initial={false}>
              {serverRevealed && (
                <motion.div key="server" initial={{ opacity: 0, height: 0, y: -8 }} animate={{ opacity: 1, height: "auto", y: 0 }} exit={{ opacity: 0, height: 0 }} transition={spring} className="overflow-hidden">
                  <div className="mt-1 h-px bg-paper-200" />
                  <Row icon={HardDrives} tone="coral" label="Server" value="Advanced" onClick={() => navigate("/settings/server")} right={<Chevron />} />
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </motion.div>
      </motion.div>
    </Screen>
  );
}

function SectionTitle({ icon: Icon, tone, children }: { icon: typeof Sparkle; tone: "coral" | "teal" | "sun" | "lavender"; children: ReactNode }) {
  const t = { coral: "text-coral-500", teal: "text-teal-500", sun: "text-sun-600", lavender: "text-lavender-500" }[tone];
  return (
    <h2 className="flex items-center gap-2 font-display text-[19px] font-semibold text-ink-900">
      <Icon className={cn("size-[22px]", t)} weight="duotone" />
      {children}
    </h2>
  );
}

function Chevron() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-ink-300" aria-hidden>
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Pill switch; the parent Row handles the tap so the whole row is the target. */
function Toggle({ checked, tone }: { checked: boolean; tone: "coral" | "teal" }) {
  const on = tone === "teal" ? "bg-teal-500" : "bg-coral-500";
  return (
    <span role="switch" aria-checked={checked} className={cn("relative inline-flex h-8 w-[52px] shrink-0 items-center rounded-full p-1 transition-colors duration-200", checked ? on : "bg-paper-300")}>
      <motion.span layout transition={springJelly} className={cn("block size-6 rounded-full bg-white shadow-[0_2px_0_0_rgb(63_42_20/0.18)]", checked && "ml-auto")} />
    </span>
  );
}

/** Version line; holding it for 3 s reveals the Server row. */
function VersionLabel({ onUnlock }: { onUnlock: () => void }) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | null>(null);
  const cancel = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  };
  const start = () => {
    cancel();
    setHolding(true);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setHolding(false);
      onUnlock();
    }, LONG_PRESS_MS);
  };
  useEffect(() => cancel, []);
  return (
    <button
      type="button"
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={`Version ${APP_VERSION}`}
      className="relative mt-4 flex w-full items-center justify-between overflow-hidden rounded-2xl bg-paper-100 px-4 py-3 text-left"
      style={{ touchAction: "manipulation", WebkitTouchCallout: "none" }}
    >
      <AnimatePresence>
        {holding && <motion.span key="fill" initial={{ width: 0 }} animate={{ width: "100%" }} exit={{ opacity: 0 }} transition={{ duration: LONG_PRESS_MS / 1000, ease: "linear" }} className="absolute inset-y-0 left-0 bg-coral-100" aria-hidden />}
      </AnimatePresence>
      <span className="relative text-[14px] font-bold text-ink-700">Version</span>
      <span className="relative text-[14px] font-semibold tabular-nums text-ink-500">
        {APP_VERSION} · {isNative ? "Android" : "Web"}
      </span>
    </button>
  );
}
