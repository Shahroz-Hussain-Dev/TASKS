import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Raahi brand mark (Sunrise): a white road sweeps from the bottom-left across a
 * coral-to-sun tile and resolves into a teal location pin — "the journey becomes the destination". The negative space of
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
          <stop offset="0" stopColor="#ff6b4a" />
          <stop offset="0.55" stopColor="#ff8a6c" />
          <stop offset="1" stopColor="#ffc53d" />
        </linearGradient>
        <radialGradient id="raahi-glow" cx="0.25" cy="0.2" r="0.8">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="128" height="128" rx="32" fill="url(#raahi-bg)" />
      <rect width="128" height="128" rx="32" fill="url(#raahi-glow)" />
      {/* road sweep */}
      <Path d="M30 104 C 30 72, 46 62, 64 62 C 82 62, 90 50, 90 38" fill="none" stroke="#ffffff" strokeWidth="14" strokeLinecap="round" {...pathProps} />
      {/* centre dashes */}
      <path d="M30 104 C 30 72, 46 62, 64 62 C 82 62, 90 50, 90 38" fill="none" stroke="#ffc53d" strokeWidth="2.5" strokeDasharray="6 9" strokeLinecap="round" opacity="0.9" />
      {/* pin head */}
      <circle cx="90" cy="30" r="16" fill="#ffffff" />
      <circle cx="90" cy="30" r="12" fill="#12a594" />
      <circle cx="90" cy="30" r="5" fill="#ffffff" />
      {/* r-stem accent */}
      <circle cx="30" cy="104" r="8" fill="#ffffff" />
      <circle cx="30" cy="104" r="4" fill="#1f1b2d" />
    </svg>
  );
}

export function Wordmark({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <span className={cn("font-display font-semibold tracking-tight text-ink-900 inline-flex items-baseline", className)} style={{ fontSize: size, lineHeight: 1 }}>
      raah
      <span className="relative inline-block">
        <span className="opacity-0">i</span>
        <span className="absolute inset-x-0 bottom-0 flex flex-col items-center">
          <span className="rounded-full bg-coral-500" style={{ width: size * 0.22, height: size * 0.22, marginBottom: size * 0.08 }} />
          <span className="bg-ink-900 rounded-full" style={{ width: size * 0.13, height: size * 0.44 }} />
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
export const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff6b4a"/><stop offset="0.55" stop-color="#ff8a6c"/><stop offset="1" stop-color="#ffc53d"/></linearGradient><radialGradient id="glow" cx="0.25" cy="0.2" r="0.8"><stop offset="0" stop-color="#ffffff" stop-opacity="0.35"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient></defs><rect width="128" height="128" rx="32" fill="url(#bg)"/><rect width="128" height="128" rx="32" fill="url(#glow)"/><path d="M30 104 C 30 72, 46 62, 64 62 C 82 62, 90 50, 90 38" fill="none" stroke="#ffffff" stroke-width="14" stroke-linecap="round"/><path d="M30 104 C 30 72, 46 62, 64 62 C 82 62, 90 50, 90 38" fill="none" stroke="#ffc53d" stroke-width="2.5" stroke-dasharray="6 9" stroke-linecap="round" opacity="0.9"/><circle cx="90" cy="30" r="16" fill="#ffffff"/><circle cx="90" cy="30" r="12" fill="#12a594"/><circle cx="90" cy="30" r="5" fill="#ffffff"/><circle cx="30" cy="104" r="8" fill="#ffffff"/><circle cx="30" cy="104" r="4" fill="#1f1b2d"/></svg>`;
