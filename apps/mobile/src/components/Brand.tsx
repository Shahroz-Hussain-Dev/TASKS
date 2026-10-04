import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Raahi brand mark: a road that sweeps from the bottom-left and resolves into a
 * location pin — "the journey becomes the destination". The negative space of
 * the sweep reads as a lowercase "r".
 */
export function LogoMark({ size = 64, className, animated = false }: { size?: number; className?: string; animated?: boolean }) {
  const Path = animated ? motion.path : "path";
  const pathProps = animated
    ? {
        initial: { pathLength: 0, opacity: 0 },
        animate: { pathLength: 1, opacity: 1 },
        transition: { duration: 1.4, ease: [0.16, 1, 0.3, 1] as const, delay: 0.2 },
      }
    : {};
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" className={className} aria-label="Raahi">
      <defs>
        <linearGradient id="raahi-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0f2a24" />
          <stop offset="1" stopColor="#0b0f1a" />
        </linearGradient>
        <linearGradient id="raahi-road" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#6ee7b7" />
          <stop offset="0.6" stopColor="#10b981" />
          <stop offset="1" stopColor="#34d399" />
        </linearGradient>
        <radialGradient id="raahi-glow" cx="0.7" cy="0.3" r="0.7">
          <stop offset="0" stopColor="#10b981" stopOpacity="0.35" />
          <stop offset="1" stopColor="#10b981" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="128" height="128" rx="32" fill="url(#raahi-bg)" />
      <rect width="128" height="128" rx="32" fill="url(#raahi-glow)" />
      <rect x="1" y="1" width="126" height="126" rx="31" fill="none" stroke="rgba(255,255,255,0.08)" />
      {/* road sweep */}
      <Path
        d="M30 104 C 30 72, 46 62, 64 62 C 82 62, 90 50, 90 38"
        fill="none"
        stroke="url(#raahi-road)"
        strokeWidth="14"
        strokeLinecap="round"
        {...pathProps}
      />
      {/* centre dashes */}
      <path d="M30 104 C 30 72, 46 62, 64 62 C 82 62, 90 50, 90 38" fill="none" stroke="#0b0f1a" strokeWidth="2.5" strokeDasharray="6 9" strokeLinecap="round" opacity="0.9" />
      {/* pin head */}
      <circle cx="90" cy="30" r="15" fill="#34d399" />
      <circle cx="90" cy="30" r="6.5" fill="#0b0f1a" />
      {/* r-stem accent */}
      <circle cx="30" cy="104" r="7" fill="#6ee7b7" />
    </svg>
  );
}

export function Wordmark({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <span className={cn("font-display font-bold tracking-tight text-ink-50 inline-flex items-baseline", className)} style={{ fontSize: size, lineHeight: 1 }}>
      raah
      <span className="relative inline-block">
        <span className="opacity-0">i</span>
        <span className="absolute inset-x-0 bottom-0 flex flex-col items-center">
          <span className="rounded-full bg-brand-400" style={{ width: size * 0.22, height: size * 0.22, marginBottom: size * 0.08 }} />
          <span className="bg-ink-50 rounded-full" style={{ width: size * 0.13, height: size * 0.44 }} />
        </span>
      </span>
    </span>
  );
}

export function Logo({ size = 40, withText = true, className, animated }: { size?: number; withText?: boolean; className?: string; animated?: boolean }) {
  return (
    <div className={cn("inline-flex items-center gap-3", className)}>
      <LogoMark size={size} animated={animated} />
      {withText && <Wordmark size={size * 0.68} />}
    </div>
  );
}

/** Static SVG string (same art) for icon/splash generation scripts. */
export const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0f2a24"/><stop offset="1" stop-color="#0b0f1a"/></linearGradient><linearGradient id="road" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#6ee7b7"/><stop offset="0.6" stop-color="#10b981"/><stop offset="1" stop-color="#34d399"/></linearGradient><radialGradient id="glow" cx="0.7" cy="0.3" r="0.7"><stop offset="0" stop-color="#10b981" stop-opacity="0.35"/><stop offset="1" stop-color="#10b981" stop-opacity="0"/></radialGradient></defs><rect width="128" height="128" rx="32" fill="url(#bg)"/><rect width="128" height="128" rx="32" fill="url(#glow)"/><path d="M30 104 C 30 72, 46 62, 64 62 C 82 62, 90 50, 90 38" fill="none" stroke="url(#road)" stroke-width="14" stroke-linecap="round"/><path d="M30 104 C 30 72, 46 62, 64 62 C 82 62, 90 50, 90 38" fill="none" stroke="#0b0f1a" stroke-width="2.5" stroke-dasharray="6 9" stroke-linecap="round" opacity="0.9"/><circle cx="90" cy="30" r="15" fill="#34d399"/><circle cx="90" cy="30" r="6.5" fill="#0b0f1a"/><circle cx="30" cy="104" r="7" fill="#6ee7b7"/></svg>`;
