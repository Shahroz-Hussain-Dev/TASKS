import { AnimatePresence, motion, useMotionValue, useTransform, type PanInfo, type Variants } from "framer-motion";
import { ArrowRight, Car, MapPin } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogoMark, Wordmark } from "@/components/Brand";
import { BiddingScene, CityScene, EarningsScene, SafetyScene } from "@/components/Illustrations";
import { Buddy } from "@/components/buddy";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import type { IconComponent } from "@/components/ui";
import { useLongPress } from "@/hooks/useLongPress";
import { useAuth } from "@/lib/auth";
import { float, item, spring, springBouncy, springSoft, stagger } from "@/lib/motion";
import { haptic } from "@/lib/native";
import { cn } from "@/lib/utils";

interface Slide {
  id: string;
  Art: ComponentType<{ className?: string }>;
  eyebrow: string;
  /** Headline: the second sentence is rendered in the slide's accent colour. */
  title: [string, string];
  body: string;
  accent: "coral" | "sun" | "sky" | "teal";
  tilt: "l" | "r";
}

const SLIDES: Slide[] = [
  { id: "city", Art: CityScene, eyebrow: "Fair-price rides", title: ["Your ride.", "Your price."], body: "Name the fare you're happy with. Nearby drivers accept or counter, and you pick who takes you.", accent: "coral", tilt: "l" },
  { id: "bids", Art: BiddingScene, eyebrow: "Live offers", title: ["Drivers compete", "for you."], body: "Watch offers arrive in real time with ratings, car and arrival time. One tap to choose.", accent: "sun", tilt: "r" },
  { id: "safety", Art: SafetyScene, eyebrow: "Verified drivers", title: ["Everyone", "is checked."], body: "CNIC, licence and vehicle papers are verified by AI and our team before anyone drives with Raahi.", accent: "sky", tilt: "l" },
  { id: "earn", Art: EarningsScene, eyebrow: "For drivers", title: ["Keep 100%", "of every fare."], body: "No commission, ever. One flat PKR 1,000 a month and every rupee you earn stays with you.", accent: "teal", tilt: "r" },
];

const ACCENT = {
  coral: { text: "text-coral-500", chip: "bg-coral-100 text-coral-700", dot: "bg-coral-500" },
  sun: { text: "text-sun-600", chip: "bg-sun-100 text-sun-600", dot: "bg-sun-500" },
  sky: { text: "text-sky-500", chip: "bg-sky-100 text-sky-600", dot: "bg-sky-500" },
  teal: { text: "text-teal-500", chip: "bg-teal-100 text-teal-700", dot: "bg-teal-500" },
} as const;

const AUTO_ADVANCE_MS = 5200;
const SWIPE_OFFSET = 56;
const SWIPE_VELOCITY = 420;

const artVariants: Variants = {
  enter: (dir: number) => ({ x: dir * 140, opacity: 0, scale: 0.9, rotate: dir * 6 }),
  center: { x: 0, opacity: 1, scale: 1, rotate: 0, transition: { ...springSoft, opacity: { duration: 0.25 }, rotate: springBouncy } },
  exit: (dir: number) => ({ x: dir * -140, opacity: 0, scale: 0.9, rotate: dir * -6, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }),
};

const textVariants: Variants = {
  enter: (dir: number) => ({ x: dir * 48, opacity: 0, filter: "blur(4px)" }),
  center: { x: 0, opacity: 1, filter: "blur(0px)", transition: { ...spring, delay: 0.05 } },
  exit: (dir: number) => ({ x: dir * -32, opacity: 0, filter: "blur(4px)", transition: { duration: 0.18 } }),
};

/**
 * First screen: cream paper with morphing blobs, Buddy floating as the hero,
 * a sticker-card story carousel with parallax on swipe, then two role cards
 * as big jelly buttons lifting in from either side.
 */
export default function WelcomeScreen() {
  const navigate = useNavigate();
  const { preferredRole, setPreferredRole } = useAuth();
  const [[index, dir], setSlide] = useState<[number, number]>([0, 1]);
  const [paused, setPaused] = useState(false);
  const resumeTimer = useRef<number | null>(null);

  const dragX = useMotionValue(0);
  const artX = useTransform(dragX, (v) => v * 0.9);
  const artRotate = useTransform(dragX, [-240, 0, 240], [6, 0, -6]);
  const textX = useTransform(dragX, (v) => v * 0.45);
  const buddyX = useTransform(dragX, (v) => v * 0.2);

  const serverLongPress = useLongPress(() => navigate("/settings/server"), 3000);

  const go = useCallback((delta: number) => {
    haptic.tick();
    setSlide(([i]) => [(i + delta + SLIDES.length) % SLIDES.length, delta > 0 ? 1 : -1]);
  }, []);

  const jump = useCallback((to: number) => {
    setSlide(([i]) => (to === i ? [i, 1] : [to, to > i ? 1 : -1]));
  }, []);

  useEffect(() => {
    if (paused) return;
    const t = window.setInterval(() => setSlide(([i]) => [(i + 1) % SLIDES.length, 1]), AUTO_ADVANCE_MS);
    return () => window.clearInterval(t);
  }, [paused, index]);

  useEffect(() => () => {
    if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
  }, []);

  const pauseBriefly = () => {
    setPaused(true);
    if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
    resumeTimer.current = window.setTimeout(() => setPaused(false), 9000);
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const { offset, velocity } = info;
    if (offset.x < -SWIPE_OFFSET || velocity.x < -SWIPE_VELOCITY) go(1);
    else if (offset.x > SWIPE_OFFSET || velocity.x > SWIPE_VELOCITY) go(-1);
    pauseBriefly();
  };

  const chooseRole = (role: "customer" | "driver") => {
    haptic.medium();
    setPreferredRole(role);
    navigate(`/auth/login?role=${role}`);
  };

  const slide = SLIDES[index] ?? SLIDES[0]!;
  const Art = slide.Art;
  const accent = ACCENT[slide.accent];
  const buddyFloat = float(9, 4.5);

  return (
    <div className="relative h-full w-full overflow-hidden bg-paper-50 flex flex-col" style={{ paddingTop: "calc(var(--safe-top) + 12px)", paddingBottom: "calc(var(--safe-bottom) + 16px)" }}>
      {/* Morphing blobs */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="blob bg-coral-100" style={{ width: "72%", height: "36%", top: "-8%", left: "-18%" }} />
        <div className="blob bg-sun-100" style={{ width: "58%", height: "30%", top: "14%", right: "-20%", animationDelay: "-6s", animationDuration: "17s" }} />
        <div className="blob bg-teal-100" style={{ width: "54%", height: "26%", bottom: "6%", left: "-14%", animationDelay: "-11s", animationDuration: "20s" }} />
      </div>
      <OfflineBanner />

      <motion.div variants={stagger(0.09, 0.1)} initial="hidden" animate="show" className="relative flex-1 flex flex-col min-h-0 px-5">
        {/* Header: logo (long-press for server settings) */}
        <motion.header variants={item.down} className="flex items-center justify-between">
          <div className="relative flex items-center gap-2.5 select-none touch-none" {...serverLongPress.handlers}>
            <div className="relative">
              <LogoMark size={40} animated className="rounded-[12px]" />
              <svg className="absolute -inset-1.5 pointer-events-none" viewBox="0 0 100 100" aria-hidden>
                <motion.circle
                  cx="50"
                  cy="50"
                  r="47"
                  fill="none"
                  stroke="#ff6b4a"
                  strokeWidth="4"
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: serverLongPress.pressing ? 1 : 0, opacity: serverLongPress.pressing ? 1 : 0 }}
                  transition={{ pathLength: { duration: serverLongPress.pressing ? serverLongPress.durationMs / 1000 : 0.25, ease: "linear" }, opacity: { duration: 0.2 } }}
                  style={{ rotate: -90, transformOrigin: "50% 50%" }}
                />
              </svg>
            </div>
            <Wordmark size={28} />
          </div>
          <motion.span initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ ...spring, delay: 0.9 }} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.16em] text-ink-600 shadow-pillow">
            <span className="size-1.5 rounded-full bg-teal-500" />
            Pakistan
          </motion.span>
        </motion.header>

        {/* Hero: Buddy floating over the story sticker */}
        <motion.section variants={item.scale} className="relative flex-1 min-h-0 flex flex-col justify-center" onPointerDown={() => setPaused(true)} onPointerUp={pauseBriefly} onPointerCancel={pauseBriefly}>
          <motion.div style={{ x: buddyX }} className="relative z-20 mx-auto -mb-9 pointer-events-none">
            <motion.div {...buddyFloat}>
              <Buddy state="idle" size={176} />
            </motion.div>
            <motion.span aria-hidden className="absolute left-1/2 -translate-x-1/2 bottom-6 h-3 w-24 rounded-full bg-[#3f2a14]/15 blur-[6px]" animate={{ scaleX: [1, 0.78, 1], opacity: [0.5, 0.3, 0.5] }} transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }} />
          </motion.div>

          <motion.div style={{ x: artX, rotate: artRotate }} className="relative mx-auto w-full max-w-[380px]">
            <AnimatePresence mode="popLayout" custom={dir} initial={false}>
              <motion.div key={slide.id} custom={dir} variants={artVariants} initial="enter" animate="center" exit="exit" className="relative flex justify-center px-2 py-1">
                <div className={cn("relative sticker overflow-hidden bg-white h-[min(26vh,250px)] aspect-[360/260]", slide.tilt === "l" ? "sticker-tilt-l" : "sticker-tilt-r")}>
                  <Art className="block w-full h-full" />
                </div>
              </motion.div>
            </AnimatePresence>
          </motion.div>

          <motion.div style={{ x: textX }} className="relative mt-5 min-h-[132px]">
            <AnimatePresence mode="popLayout" custom={dir} initial={false}>
              <motion.div key={slide.id} custom={dir} variants={textVariants} initial="enter" animate="center" exit="exit" className="flex flex-col gap-2">
                <p className={cn("self-start inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-extrabold uppercase tracking-[0.16em]", accent.chip)}>
                  <span className={cn("size-1.5 rounded-full", accent.dot)} />
                  {slide.eyebrow}
                </p>
                <h1 className="font-display text-[34px] leading-[1.04] font-semibold text-ink-900 tracking-tight">
                  {slide.title[0]} <span className={accent.text}>{slide.title[1]}</span>
                </h1>
                <p className="text-[15px] leading-relaxed text-ink-500 font-medium max-w-[36ch]">{slide.body}</p>
              </motion.div>
            </AnimatePresence>
          </motion.div>

          {/* Dots */}
          <motion.div variants={item.fade} className="relative z-20 flex items-center justify-center gap-2 mt-1">
          {SLIDES.map((s, i) => (
            <button
              key={s.id}
              type="button"
              aria-label={`Slide ${i + 1}`}
              onClick={() => {
                jump(i);
                pauseBriefly();
              }}
              className="py-2"
            >
              <motion.span layout transition={springBouncy} className={cn("block h-2 rounded-full", i === index ? cn("w-7", accent.dot) : "w-2 bg-paper-300")} />
            </button>
          ))}
        </motion.div>

          {/* Transparent swipe surface */}
          <motion.div
            className="absolute inset-0 z-10 cursor-grab active:cursor-grabbing"
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.32}
            dragSnapToOrigin
            dragTransition={{ bounceStiffness: 520, bounceDamping: 32 }}
            style={{ x: dragX }}
            onDragEnd={onDragEnd}
            aria-label="Swipe to see more"
          />
        </motion.section>

        {/* Role cards */}
        <div className="grid grid-cols-2 gap-3 mt-3">
          <RoleCard variants={item.left} icon={MapPin} title="I need a ride" sub="Name your fare" accent="coral" preferred={preferredRole === "customer"} onClick={() => chooseRole("customer")} />
          <RoleCard variants={item.right} icon={Car} title="I want to drive" sub="Keep 100% of fares" accent="teal" preferred={preferredRole === "driver"} onClick={() => chooseRole("driver")} />
        </div>

        <motion.p variants={item.up} className="mt-4 text-center text-[13.5px] text-ink-500 font-semibold">
          New here?{" "}
          <Link to="/auth/signup/customer" className="font-extrabold text-coral-600 underline-offset-4 hover:underline">
            Create a rider account
          </Link>
          <span className="mx-1.5 text-ink-300">·</span>
          <Link to="/auth/signup/driver" className="font-extrabold text-teal-600 underline-offset-4 hover:underline">
            Drive with Raahi
          </Link>
        </motion.p>
      </motion.div>
    </div>
  );
}

function RoleCard({ variants, icon: Icon, title, sub, accent, preferred, onClick }: { variants: Variants; icon: IconComponent; title: string; sub: string; accent: "coral" | "teal"; preferred: boolean; onClick: () => void }) {
  const coral = accent === "coral";
  return (
    <motion.button
      type="button"
      variants={variants}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.965, y: 3 }}
      transition={spring}
      onClick={onClick}
      className={cn("relative overflow-hidden rounded-[26px] p-4 text-left min-h-[128px] flex flex-col jelly text-white", coral ? "jelly-coral" : "jelly-teal")}
    >
      <span aria-hidden className={cn("absolute -right-10 -top-10 size-32 rounded-full blur-2xl opacity-60", coral ? "bg-sun-300" : "bg-sky-300")} />
      <span aria-hidden className="absolute -right-4 -bottom-6 size-24 rounded-full bg-white/10" />
      <span className="relative size-11 rounded-2xl flex items-center justify-center bg-white/22 text-white">
        <Icon className="size-6" weight="duotone" />
      </span>
      <span className="relative mt-auto pt-3">
        <span className="block font-display text-[17.5px] font-semibold leading-tight">{title}</span>
        <span className="block text-[12.5px] text-white/80 mt-0.5 font-bold">{sub}</span>
      </span>
      <ArrowRight className="absolute right-4 bottom-4 size-5 text-white/85" weight="bold" />
      {preferred && (
        <motion.span initial={{ opacity: 0, scale: 0.6, rotate: -6 }} animate={{ opacity: 1, scale: 1, rotate: -4 }} transition={{ ...springBouncy, delay: 0.6 }} className="absolute right-3 top-3 rounded-full bg-white px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-ink-900 shadow-pillow">
          Last used
        </motion.span>
      )}
    </motion.button>
  );
}
