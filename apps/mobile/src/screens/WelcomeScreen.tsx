import { AnimatePresence, motion, useMotionValue, useTransform, type PanInfo, type Variants } from "framer-motion";
import { ArrowRight, Car, MapPin } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { Link, useNavigate } from "react-router-dom";
import { APP_TAGLINE } from "@raahi/shared";
import { LogoMark, Wordmark } from "@/components/Brand";
import { BiddingScene, CityScene, EarningsScene, SafetyScene } from "@/components/Illustrations";
import { Aurora } from "@/components/shared/Aurora";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import { useLongPress } from "@/hooks/useLongPress";
import { useAuth } from "@/lib/auth";
import { item, spring, springBouncy, springSoft, stagger } from "@/lib/motion";
import { haptic } from "@/lib/native";
import { cn } from "@/lib/utils";

interface Slide {
  id: string;
  Art: ComponentType<{ className?: string }>;
  eyebrow: string;
  title: string;
  body: string;
  accent: string;
}

const SLIDES: Slide[] = [
  { id: "city", Art: CityScene, eyebrow: "Fair-price rides", title: APP_TAGLINE, body: "Name the fare you're happy with. Nearby drivers accept or counter, and you pick who takes you.", accent: "text-brand-400" },
  { id: "bids", Art: BiddingScene, eyebrow: "Live offers", title: "Drivers compete for you", body: "Watch offers arrive in real time with ratings, car and arrival time. One tap to choose.", accent: "text-amber-300" },
  { id: "safety", Art: SafetyScene, eyebrow: "Verified drivers", title: "Everyone is checked", body: "CNIC, licence and vehicle papers are verified by AI and our team before anyone drives with Raahi.", accent: "text-sky-400" },
  { id: "earn", Art: EarningsScene, eyebrow: "For drivers", title: "Keep 100% of every fare", body: "No commission, ever. One flat PKR 1,000 a month and every rupee you earn stays with you.", accent: "text-violet-400" },
];

const AUTO_ADVANCE_MS = 5200;
const SWIPE_OFFSET = 56;
const SWIPE_VELOCITY = 420;

const artVariants: Variants = {
  enter: (dir: number) => ({ x: dir * 120, opacity: 0, scale: 0.92, rotate: dir * 3 }),
  center: { x: 0, opacity: 1, scale: 1, rotate: 0, transition: { ...springSoft, opacity: { duration: 0.25 } } },
  exit: (dir: number) => ({ x: dir * -120, opacity: 0, scale: 0.92, rotate: dir * -3, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }),
};

const textVariants: Variants = {
  enter: (dir: number) => ({ x: dir * 48, opacity: 0, filter: "blur(4px)" }),
  center: { x: 0, opacity: 1, filter: "blur(0px)", transition: { ...spring, delay: 0.05 } },
  exit: (dir: number) => ({ x: dir * -32, opacity: 0, filter: "blur(4px)", transition: { duration: 0.18 } }),
};

/**
 * First screen: logo draws itself, an animated story carousel with parallax
 * on swipe, then two role cards lifting in from either side.
 */
export default function WelcomeScreen() {
  const navigate = useNavigate();
  const { preferredRole, setPreferredRole } = useAuth();
  const [[index, dir], setSlide] = useState<[number, number]>([0, 1]);
  const [paused, setPaused] = useState(false);
  const resumeTimer = useRef<number | null>(null);

  const dragX = useMotionValue(0);
  const artX = useTransform(dragX, (v) => v * 0.9);
  const artRotate = useTransform(dragX, [-240, 0, 240], [5, 0, -5]);
  const textX = useTransform(dragX, (v) => v * 0.45);
  const glowX = useTransform(dragX, (v) => v * 0.18);

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

  return (
    <div className="relative h-full w-full overflow-hidden bg-ink-900 noise flex flex-col" style={{ paddingTop: "calc(var(--safe-top) + 14px)", paddingBottom: "calc(var(--safe-bottom) + 18px)" }}>
      <Aurora intensity={1.1} />
      <OfflineBanner />
      <motion.div style={{ x: glowX }} className="pointer-events-none absolute left-1/2 top-[22%] -translate-x-1/2 size-[70vw] max-w-[360px] rounded-full bg-brand-500/10 blur-3xl" />

      <motion.div variants={stagger(0.09, 0.1)} initial="hidden" animate="show" className="relative flex-1 flex flex-col min-h-0 px-6">
        {/* Header: logo (long-press for server settings) */}
        <motion.header variants={item.down} className="flex items-center justify-between">
          <div className="relative flex items-center gap-3 select-none touch-none" {...serverLongPress.handlers}>
            <div className="relative">
              <LogoMark size={46} animated />
              <svg className="absolute -inset-1.5 pointer-events-none" viewBox="0 0 100 100" aria-hidden>
                <motion.circle
                  cx="50"
                  cy="50"
                  r="47"
                  fill="none"
                  stroke="#34d399"
                  strokeWidth="3"
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: serverLongPress.pressing ? 1 : 0, opacity: serverLongPress.pressing ? 1 : 0 }}
                  transition={{ pathLength: { duration: serverLongPress.pressing ? serverLongPress.durationMs / 1000 : 0.25, ease: "linear" }, opacity: { duration: 0.2 } }}
                  style={{ rotate: -90, transformOrigin: "50% 50%" }}
                />
              </svg>
            </div>
            <Wordmark size={30} />
          </div>
          <motion.span initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ ...spring, delay: 0.9 }} className="text-[11.5px] font-bold uppercase tracking-[0.18em] text-ink-500">
            Pakistan
          </motion.span>
        </motion.header>

        {/* Carousel */}
        <motion.section variants={item.scale} className="relative flex-1 min-h-0 flex flex-col justify-center mt-2" onPointerDown={() => setPaused(true)} onPointerUp={pauseBriefly} onPointerCancel={pauseBriefly}>
          <motion.div style={{ x: artX, rotate: artRotate }} className="relative mx-auto w-full max-w-[400px]">
            <motion.div animate={{ y: [0, -7, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}>
              <AnimatePresence mode="popLayout" custom={dir} initial={false}>
                <motion.div key={slide.id} custom={dir} variants={artVariants} initial="enter" animate="center" exit="exit" className="relative">
                  <div className="absolute inset-x-8 bottom-2 h-10 rounded-full bg-brand-500/25 blur-2xl" />
                  <Art className="relative drop-shadow-[0_30px_60px_rgba(0,0,0,0.6)] max-h-[36vh]" />
                </motion.div>
              </AnimatePresence>
            </motion.div>
          </motion.div>

          <motion.div style={{ x: textX }} className="relative mt-6 min-h-[128px]">
            <AnimatePresence mode="popLayout" custom={dir} initial={false}>
              <motion.div key={slide.id} custom={dir} variants={textVariants} initial="enter" animate="center" exit="exit" className="flex flex-col gap-2">
                <p className={cn("text-[12px] font-bold uppercase tracking-[0.2em]", slide.accent)}>{slide.eyebrow}</p>
                <h1 className="font-display text-[31px] leading-[1.06] font-semibold text-ink-50 tracking-tight">{slide.title}</h1>
                <p className="text-[15px] leading-relaxed text-ink-300 max-w-[34ch]">{slide.body}</p>
              </motion.div>
            </AnimatePresence>
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

        {/* Dots */}
        <motion.div variants={item.fade} className="flex items-center justify-center gap-2 mt-3 mb-5">
          {SLIDES.map((s, i) => (
            <button key={s.id} type="button" aria-label={`Slide ${i + 1}`} onClick={() => {
              jump(i);
              pauseBriefly();
            }} className="py-2">
              <motion.span layout transition={springBouncy} className={cn("block h-1.5 rounded-full", i === index ? "w-7 bg-brand-400 shadow-glow" : "w-1.5 bg-white/20")} />
            </button>
          ))}
        </motion.div>

        {/* Role cards */}
        <div className="grid grid-cols-2 gap-3">
          <RoleCard variants={item.left} icon={MapPin} title="I need a ride" sub="Name your fare" accent="brand" preferred={preferredRole === "customer"} onClick={() => chooseRole("customer")} />
          <RoleCard variants={item.right} icon={Car} title="I want to drive" sub="Keep 100% of fares" accent="amber" preferred={preferredRole === "driver"} onClick={() => chooseRole("driver")} />
        </div>

        <motion.p variants={item.up} className="mt-5 text-center text-[13.5px] text-ink-400">
          New here?{" "}
          <Link to="/auth/signup/customer" className="font-semibold text-ink-100 underline-offset-4 hover:underline">
            Create a rider account
          </Link>
          <span className="mx-1.5 text-ink-600">·</span>
          <Link to="/auth/signup/driver" className="font-semibold text-ink-100 underline-offset-4 hover:underline">
            Drive with Raahi
          </Link>
        </motion.p>
      </motion.div>
    </div>
  );
}

function RoleCard({ variants, icon: Icon, title, sub, accent, preferred, onClick }: { variants: Variants; icon: ComponentType<{ className?: string; strokeWidth?: number }>; title: string; sub: string; accent: "brand" | "amber"; preferred: boolean; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      variants={variants}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.965, y: 1 }}
      transition={spring}
      onClick={onClick}
      className={cn("relative overflow-hidden rounded-3xl p-4 text-left bg-ink-800 border shadow-card min-h-[132px] flex flex-col", preferred ? (accent === "brand" ? "border-brand-500/50" : "border-amber-400/50") : "border-white/8")}
    >
      <span className={cn("absolute -right-8 -top-8 size-28 rounded-full blur-2xl", accent === "brand" ? "bg-brand-500/25" : "bg-amber-400/20")} />
      <span className={cn("relative size-11 rounded-2xl flex items-center justify-center", accent === "brand" ? "bg-brand-500/15 text-brand-400" : "bg-amber-400/15 text-amber-300")}>
        <Icon className="size-[22px]" strokeWidth={2.2} />
      </span>
      <span className="relative mt-auto pt-3">
        <span className="block font-display text-[16.5px] font-semibold text-ink-50 leading-tight">{title}</span>
        <span className="block text-[12.5px] text-ink-400 mt-0.5">{sub}</span>
      </span>
      <ArrowRight className="absolute right-4 bottom-4 size-[18px] text-ink-500" />
      {preferred && (
        <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ ...springBouncy, delay: 0.6 }} className={cn("absolute right-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", accent === "brand" ? "bg-brand-500/20 text-brand-300" : "bg-amber-400/20 text-amber-300")}>
          Last used
        </motion.span>
      )}
    </motion.button>
  );
}
