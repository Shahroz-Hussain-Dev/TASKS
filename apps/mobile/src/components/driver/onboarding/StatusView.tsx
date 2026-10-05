import { motion } from "framer-motion";
import { ArrowsClockwise, ChatCircleDots, Clock, Lifebuoy, Power, SealCheck, ShieldSlash, Warning } from "@phosphor-icons/react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DOCUMENT_META, type DriverDto } from "@raahi/shared";
import { Buddy } from "@/components/buddy";
import { Breathe } from "@/components/driver/Breathe";
import { Confetti } from "@/components/driver/Confetti";
import { Badge, Button } from "@/components/ui";
import { DOC_STATUS_META, formatDay } from "@/hooks/driver/onboarding";
import { item, springBouncy, stagger } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Post-submission states. Under review shows a ticking clock and polls;
 * rejected lists what to fix; suspended points to support; approved throws
 * confetti and hands over to the home screen.
 */
export function StatusView({ driver, refreshing, onRefresh, onFixDocuments, onGoOnline }: { driver: DriverDto; refreshing: boolean; onRefresh: () => void; onFixDocuments: () => void; onGoOnline: () => void }) {
  const navigate = useNavigate();
  const problemDocs = driver.documents.filter((d) => d.status === "rejected" || d.status === "flagged");
  const approved = driver.status === "approved";

  useEffect(() => {
    if (!approved) return;
    let cancelled = false;
    import("@/lib/confetti")
      .then((m) => {
        if (!cancelled) m.celebrate({ intensity: "big" });
      })
      .catch(() => {
        /* confetti is a delight, never a dependency */
      });
    return () => {
      cancelled = true;
    };
  }, [approved]);

  if (approved) {
    return (
      <div className="relative flex-1 flex flex-col overflow-hidden">
        <span aria-hidden className="blob bg-teal-100 w-80 h-80 -top-10 -right-24 opacity-90" />
        <span aria-hidden className="blob bg-sun-100 w-64 h-64 bottom-10 -left-20 opacity-90" style={{ animationDelay: "-6s" }} />
        <Confetti count={80} />
        <motion.div variants={stagger(0.08, 0.1)} initial="hidden" animate="show" className="relative flex-1 flex flex-col items-center justify-center text-center gap-5 px-2 pb-6">
          <motion.div variants={item.scale} className="relative">
            <span aria-hidden className="blob bg-teal-100 w-56 h-56 -inset-10 -z-10" />
            <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ ...springBouncy, delay: 0.2 }} className="relative">
              <Buddy state="happy" size={180} />
            </motion.div>
            <motion.span initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: -8 }} transition={{ ...springBouncy, delay: 0.45 }} className="absolute -right-2 bottom-2 size-16 rounded-[22px] bg-teal-500 text-white flex items-center justify-center shadow-glow-teal">
              <SealCheck className="size-9" weight="fill" />
            </motion.span>
          </motion.div>
          <motion.div variants={item.up}>
            <h2 className="font-display text-[32px] font-semibold text-ink-900 leading-tight tracking-tight">You're approved!</h2>
            <p className="mt-2 text-[15px] font-semibold text-ink-500 leading-relaxed max-w-[30ch] mx-auto">Welcome to Raahi. Go online to start receiving requests near you — every rupee of every fare is yours.</p>
          </motion.div>
          {driver.subscription?.endsAt && (
            <motion.div variants={item.pop}>
              <Badge tone="teal">Subscription active until {formatDay(driver.subscription.endsAt)}</Badge>
            </motion.div>
          )}
          <motion.div variants={item.up} className="w-full pt-2">
            <Breathe>
              <Button full size="xl" variant="teal" icon={Power} onClick={onGoOnline}>
                Go online
              </Button>
            </Breathe>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  if (driver.status === "under_review") {
    return (
      <motion.div variants={stagger(0.08, 0.05)} initial="hidden" animate="show" className="relative flex-1 flex flex-col gap-5 pb-6">
        {/* Sky-tinted hero */}
        <motion.div variants={item.scale} className="relative overflow-hidden rounded-[32px] bg-sky-100 px-5 pt-6 pb-5 flex flex-col items-center text-center">
          <span aria-hidden className="blob bg-sky-300/40 w-56 h-56 -top-16 -right-16" />
          <span aria-hidden className="blob bg-white/70 w-40 h-40 -bottom-14 -left-10" style={{ animationDelay: "-8s" }} />
          <div className="relative flex items-end gap-2">
            <AnimatedClock />
            <div className="-ml-6 mb-1">
              <Buddy state="thinking" size={72} />
            </div>
          </div>
          <h2 className="relative mt-3 font-display text-[26px] font-semibold text-ink-900 tracking-tight">Documents under review</h2>
          <p className="relative mt-1.5 text-[14.5px] font-semibold text-ink-600 leading-relaxed max-w-[32ch]">Our team is checking your application. This usually takes less than 24 hours and we'll notify you the moment it's done.</p>
        </motion.div>
        <motion.div variants={item.left} className="relative pillow p-4 flex flex-col gap-2">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-400">Your documents</p>
          {driver.documents.length === 0 ? (
            <p className="text-[13.5px] font-semibold text-ink-500">No documents on file.</p>
          ) : (
            driver.documents.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 text-[13.5px]">
                <span className="font-bold text-ink-800 truncate">{DOCUMENT_META[d.type].label}</span>
                <Badge tone={DOC_STATUS_META[d.status].tone}>{DOC_STATUS_META[d.status].label}</Badge>
              </div>
            ))
          )}
        </motion.div>
        <motion.div variants={item.up} className="relative flex flex-col gap-2 mt-auto">
          <Button full variant="teal" icon={ArrowsClockwise} loading={refreshing} onClick={onRefresh}>
            Check status
          </Button>
          {problemDocs.length > 0 && (
            <Button full variant="ghost" icon={Warning} onClick={onFixDocuments}>
              Retake flagged documents
            </Button>
          )}
          <Button full variant="ghost" icon={ChatCircleDots} onClick={() => navigate("/support")}>
            Ask support
          </Button>
        </motion.div>
      </motion.div>
    );
  }

  const suspended = driver.status === "suspended";
  return (
    <motion.div variants={stagger(0.08, 0.05)} initial="hidden" animate="show" className="relative flex-1 flex flex-col gap-5 pb-6">
      <motion.div variants={item.scale} className="relative self-center mt-4">
        <span aria-hidden className="blob bg-rose-100 w-40 h-40 -inset-8 -z-10" />
        <span className="relative size-24 rounded-[32px] bg-rose-100 text-rose-500 flex items-center justify-center">
          <ShieldSlash className="size-12" weight="duotone" />
        </span>
      </motion.div>
      <motion.div variants={item.up} className="text-center px-2">
        <h2 className="font-display text-[26px] font-semibold text-ink-900 tracking-tight">{suspended ? "Account suspended" : "Application not approved"}</h2>
        <p className="mt-2 text-[15px] font-semibold text-ink-500 leading-relaxed max-w-[32ch] mx-auto">{suspended ? "Your driver account has been suspended. Reach out to support and we'll explain what happened and how to get back on the road." : "Something in your application needs attention. Fix the items below and resubmit — it only takes a few minutes."}</p>
      </motion.div>
      {driver.statusReason && (
        <motion.div variants={item.left} className="rounded-[22px] bg-rose-100 px-4 py-3">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-rose-500">Reason</p>
          <p className="mt-1 text-[14px] font-semibold text-ink-800 leading-snug">{driver.statusReason}</p>
        </motion.div>
      )}
      {!suspended && problemDocs.length > 0 && (
        <motion.div variants={item.right} className="pillow p-4 flex flex-col gap-3">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-400">Documents to fix</p>
          {problemDocs.map((d) => (
            <div key={d.id} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[14px] font-bold text-ink-900">{DOCUMENT_META[d.type].label}</span>
                <Badge tone={DOC_STATUS_META[d.status].tone}>{DOC_STATUS_META[d.status].label}</Badge>
              </div>
              {(d.reviewerNote || d.aiVerdict?.issues[0]) && <p className="text-[13px] font-semibold text-ink-500 leading-snug">{d.reviewerNote ?? d.aiVerdict?.issues[0]}</p>}
            </div>
          ))}
        </motion.div>
      )}
      <motion.div variants={item.up} className="flex flex-col gap-2 mt-auto">
        {!suspended && (
          <Breathe>
            <Button full size="xl" variant="teal" icon={Warning} onClick={onFixDocuments}>
              Fix documents
            </Button>
          </Breathe>
        )}
        <Button full variant={suspended ? "primary" : "ghost"} size={suspended ? "xl" : "lg"} icon={Lifebuoy} onClick={() => navigate("/support")}>
          Contact support
        </Button>
      </motion.div>
    </motion.div>
  );
}

/** A wall clock whose hands sweep continuously — "we're on it". */
function AnimatedClock({ className }: { className?: string }) {
  return (
    <div className={cn("relative size-36", className)} aria-hidden>
      <svg viewBox="0 0 160 160" className="relative size-36 drop-shadow-[0_12px_24px_rgba(61,169,252,0.35)]">
        <circle cx="80" cy="80" r="70" fill="#ffffff" stroke="#e1f1ff" strokeWidth="6" />
        <circle cx="80" cy="80" r="60" fill="none" stroke="#9dd3ff" strokeWidth="1.5" strokeDasharray="2 8" />
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i / 12) * Math.PI * 2;
          const x1 = 80 + Math.sin(a) * 54;
          const y1 = 80 - Math.cos(a) * 54;
          const x2 = 80 + Math.sin(a) * (i % 3 === 0 ? 46 : 50);
          const y2 = 80 - Math.cos(a) * (i % 3 === 0 ? 46 : 50);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={i % 3 === 0 ? "#3da9fc" : "#cfc9d9"} strokeWidth={i % 3 === 0 ? 3.5 : 2} strokeLinecap="round" />;
        })}
        <motion.line x1="80" y1="80" x2="80" y2="44" stroke="#1f1b2d" strokeWidth="5" strokeLinecap="round" style={{ originX: "80px", originY: "80px" }} animate={{ rotate: 360 }} transition={{ duration: 36, repeat: Infinity, ease: "linear" }} />
        <motion.line x1="80" y1="80" x2="80" y2="30" stroke="#3da9fc" strokeWidth="3.5" strokeLinecap="round" style={{ originX: "80px", originY: "80px" }} animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }} />
        <circle cx="80" cy="80" r="5" fill="#ff6b4a" />
      </svg>
      <span className="absolute -right-1 -top-1 size-10 rounded-[14px] bg-white shadow-pillow flex items-center justify-center text-sky-500">
        <Clock className="size-5" weight="duotone" />
      </span>
    </div>
  );
}
