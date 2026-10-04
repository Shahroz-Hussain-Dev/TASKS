import { motion } from "framer-motion";
import { Clock3, FileWarning, LifeBuoy, MessageCircle, Power, RefreshCw, ShieldX, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DOCUMENT_META, type DriverDto } from "@raahi/shared";
import { Confetti } from "@/components/driver/Confetti";
import { Aurora } from "@/components/shared/Aurora";
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

  if (driver.status === "approved") {
    return (
      <div className="relative flex-1 flex flex-col">
        <Confetti count={80} />
        <motion.div variants={stagger(0.08, 0.1)} initial="hidden" animate="show" className="relative flex-1 flex flex-col items-center justify-center text-center gap-5 px-2 pb-6">
          <motion.div variants={item.scale} className="relative">
            <motion.span aria-hidden className="absolute inset-0 rounded-full bg-brand-500/30 blur-2xl" animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0.9, 0.6] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }} />
            <motion.span initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ ...springBouncy, delay: 0.2 }} className="relative size-28 rounded-[36px] bg-brand-500 text-ink-950 flex items-center justify-center shadow-glow">
              <Sparkles className="size-12" strokeWidth={2.2} />
            </motion.span>
          </motion.div>
          <motion.div variants={item.up}>
            <h2 className="font-display text-[30px] font-bold text-ink-50 leading-tight tracking-tight">You're approved!</h2>
            <p className="mt-2 text-[15px] text-ink-300 leading-relaxed max-w-[30ch] mx-auto">Welcome to Raahi. Go online to start receiving requests near you — every rupee of every fare is yours.</p>
          </motion.div>
          {driver.subscription?.endsAt && (
            <motion.div variants={item.up}>
              <Badge tone="brand">Subscription active until {formatDay(driver.subscription.endsAt)}</Badge>
            </motion.div>
          )}
          <motion.div variants={item.up} className="w-full pt-2">
            <Button full size="xl" icon={Power} onClick={onGoOnline}>
              Go online
            </Button>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  if (driver.status === "under_review") {
    return (
      <motion.div variants={stagger(0.08, 0.05)} initial="hidden" animate="show" className="relative flex-1 flex flex-col gap-5 pb-6">
        <Aurora variant="soft" intensity={0.7} />
        <motion.div variants={item.scale} className="relative self-center mt-4">
          <AnimatedClock />
        </motion.div>
        <motion.div variants={item.up} className="relative text-center px-2">
          <h2 className="font-display text-[26px] font-bold text-ink-50 tracking-tight">Documents under review</h2>
          <p className="mt-2 text-[15px] text-ink-300 leading-relaxed max-w-[32ch] mx-auto">Our team is checking your application. This usually takes less than 24 hours and we'll notify you the moment it's done.</p>
        </motion.div>
        <motion.div variants={item.left} className="relative rounded-3xl bg-ink-800 border border-white/6 shadow-card p-4 flex flex-col gap-2">
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-ink-400">Your documents</p>
          {driver.documents.length === 0 ? (
            <p className="text-[13.5px] text-ink-400">No documents on file.</p>
          ) : (
            driver.documents.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 text-[13.5px]">
                <span className="text-ink-200 truncate">{DOCUMENT_META[d.type].label}</span>
                <Badge tone={DOC_STATUS_META[d.status].tone}>{DOC_STATUS_META[d.status].label}</Badge>
              </div>
            ))
          )}
        </motion.div>
        <motion.div variants={item.up} className="relative flex flex-col gap-2 mt-auto">
          <Button full variant="secondary" icon={RefreshCw} loading={refreshing} onClick={onRefresh}>
            Check status
          </Button>
          {problemDocs.length > 0 && (
            <Button full variant="ghost" icon={FileWarning} onClick={onFixDocuments}>
              Retake flagged documents
            </Button>
          )}
          <Button full variant="ghost" icon={MessageCircle} onClick={() => navigate("/support")}>
            Ask support
          </Button>
        </motion.div>
      </motion.div>
    );
  }

  const suspended = driver.status === "suspended";
  return (
    <motion.div variants={stagger(0.08, 0.05)} initial="hidden" animate="show" className="relative flex-1 flex flex-col gap-5 pb-6">
      <motion.div variants={item.scale} className="self-center mt-4">
        <span className="size-24 rounded-[32px] bg-rose-500/12 text-rose-400 flex items-center justify-center border border-rose-500/20">
          <ShieldX className="size-11" strokeWidth={2} />
        </span>
      </motion.div>
      <motion.div variants={item.up} className="text-center px-2">
        <h2 className="font-display text-[26px] font-bold text-ink-50 tracking-tight">{suspended ? "Account suspended" : "Application not approved"}</h2>
        <p className="mt-2 text-[15px] text-ink-300 leading-relaxed max-w-[32ch] mx-auto">{suspended ? "Your driver account has been suspended. Reach out to support and we'll explain what happened and how to get back on the road." : "Something in your application needs attention. Fix the items below and resubmit — it only takes a few minutes."}</p>
      </motion.div>
      {driver.statusReason && (
        <motion.div variants={item.left} className="rounded-2xl bg-rose-500/8 border border-rose-500/20 px-4 py-3">
          <p className="text-[12px] font-bold uppercase tracking-wide text-rose-400">Reason</p>
          <p className="mt-1 text-[14px] text-ink-100 leading-snug">{driver.statusReason}</p>
        </motion.div>
      )}
      {!suspended && problemDocs.length > 0 && (
        <motion.div variants={item.right} className="rounded-3xl bg-ink-800 border border-white/6 shadow-card p-4 flex flex-col gap-3">
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-ink-400">Documents to fix</p>
          {problemDocs.map((d) => (
            <div key={d.id} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[14px] font-medium text-ink-50">{DOCUMENT_META[d.type].label}</span>
                <Badge tone={DOC_STATUS_META[d.status].tone}>{DOC_STATUS_META[d.status].label}</Badge>
              </div>
              {(d.reviewerNote || d.aiVerdict?.issues[0]) && <p className="text-[13px] text-ink-400 leading-snug">{d.reviewerNote ?? d.aiVerdict?.issues[0]}</p>}
            </div>
          ))}
        </motion.div>
      )}
      <motion.div variants={item.up} className="flex flex-col gap-2 mt-auto">
        {!suspended && (
          <Button full size="xl" icon={FileWarning} onClick={onFixDocuments}>
            Fix documents
          </Button>
        )}
        <Button full variant={suspended ? "primary" : "ghost"} size={suspended ? "xl" : "lg"} icon={LifeBuoy} onClick={() => navigate("/support")}>
          Contact support
        </Button>
      </motion.div>
    </motion.div>
  );
}

/** A wall clock whose hands sweep continuously — "we're on it". */
function AnimatedClock({ className }: { className?: string }) {
  return (
    <div className={cn("relative size-40", className)} aria-hidden>
      <motion.span className="absolute inset-0 rounded-full bg-amber-400/15 blur-2xl" animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.85, 0.5] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }} />
      <svg viewBox="0 0 160 160" className="relative size-40">
        <circle cx="80" cy="80" r="70" fill="#111827" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
        <circle cx="80" cy="80" r="62" fill="none" stroke="rgba(251,191,36,0.25)" strokeWidth="1.5" strokeDasharray="2 8" />
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i / 12) * Math.PI * 2;
          const x1 = 80 + Math.sin(a) * 56;
          const y1 = 80 - Math.cos(a) * 56;
          const x2 = 80 + Math.sin(a) * (i % 3 === 0 ? 48 : 52);
          const y2 = 80 - Math.cos(a) * (i % 3 === 0 ? 48 : 52);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={i % 3 === 0 ? "#fbbf24" : "#64748b"} strokeWidth={i % 3 === 0 ? 3 : 2} strokeLinecap="round" />;
        })}
        <motion.line x1="80" y1="80" x2="80" y2="44" stroke="#f8fafc" strokeWidth="5" strokeLinecap="round" style={{ originX: "80px", originY: "80px" }} animate={{ rotate: 360 }} transition={{ duration: 36, repeat: Infinity, ease: "linear" }} />
        <motion.line x1="80" y1="80" x2="80" y2="30" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" style={{ originX: "80px", originY: "80px" }} animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }} />
        <circle cx="80" cy="80" r="5" fill="#fbbf24" />
      </svg>
      <span className="absolute -right-1 -top-1 size-10 rounded-2xl glass flex items-center justify-center text-amber-300 shadow-card">
        <Clock3 className="size-5" />
      </span>
    </div>
  );
}
