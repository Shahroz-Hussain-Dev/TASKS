import { motion } from "framer-motion";
import { BUDDY_COLORS as C, type BuddyState } from "./types";

/**
 * The same character drawn in SVG. Shown while the three.js chunk loads and on
 * devices without WebGL, so Buddy is never a blank box.
 */
export function BuddyFallback({ state = "idle", size = 160, className }: { state?: BuddyState; size?: number; className?: string }) {
  const sad = state === "sad";
  const happy = state === "happy";
  const speaking = state === "speaking";
  const listening = state === "listening";
  const bob = state === "sad" ? 1 : happy ? 7 : 3;
  const tilt = sad ? 6 : state === "thinking" ? -4 : 0;
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className={className} role="img" aria-label="Buddy, the Raahi assistant">
      <defs>
        <radialGradient id="buddy-body" cx="40%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#fffaf0" />
          <stop offset="70%" stopColor={C.body} />
          <stop offset="100%" stopColor={C.bodyShade} />
        </radialGradient>
        <radialGradient id="buddy-shadow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={C.shadow} stopOpacity="0.28" />
          <stop offset="100%" stopColor={C.shadow} stopOpacity="0" />
        </radialGradient>
      </defs>
      <motion.ellipse cx="100" cy="182" rx="50" ry="9" fill="url(#buddy-shadow)" animate={{ rx: [50, 44, 50] }} transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }} />
      <motion.g
        style={{ originX: "100px", originY: "120px" }}
        animate={{ y: [0, -bob, 0], rotate: [tilt, tilt + (sad ? 0 : 1.5), tilt] }}
        transition={{ duration: happy ? 0.7 : 2.6, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* feet */}
        <ellipse cx="80" cy="168" rx="15" ry="8" fill={C.teal} />
        <ellipse cx="120" cy="168" rx="15" ry="8" fill={C.teal} />
        {/* arms */}
        <motion.ellipse cx="42" cy="124" rx="9" ry="16" fill={C.bodyShade} style={{ originX: "46px", originY: "110px" }} animate={{ rotate: happy ? [-140, -150, -140] : sad ? 8 : [16, 22, 16] }} transition={{ duration: 1.2, repeat: Infinity }} />
        <motion.ellipse cx="158" cy="124" rx="9" ry="16" fill={C.bodyShade} style={{ originX: "154px", originY: "110px" }} animate={{ rotate: happy ? [140, 150, 140] : sad ? -8 : [-16, -22, -16] }} transition={{ duration: 1.2, repeat: Infinity }} />
        {/* body */}
        <ellipse cx="100" cy="112" rx="58" ry="60" fill="url(#buddy-body)" />
        {/* antenna + pin */}
        <line x1="100" y1="50" x2="100" y2="26" stroke={C.ink} strokeWidth="3.5" strokeLinecap="round" />
        <motion.g animate={listening ? { scale: [1, 1.2, 1], opacity: [1, 0.85, 1] } : { scale: 1 }} transition={{ duration: 0.9, repeat: Infinity }} style={{ originX: "100px", originY: "18px" }}>
          <path d="M100 32 C92 24 88 20 88 14 a12 12 0 1 1 24 0 c0 6 -4 10 -12 18z" fill={C.coral} />
          <circle cx="100" cy="14" r="4.2" fill="#ffffff" />
        </motion.g>
        {/* cap */}
        <path d="M46 84 C46 56 70 42 100 42 C130 42 154 56 154 84 Z" fill={C.teal} />
        <path d="M38 88 C50 78 150 78 162 88 C150 94 50 94 38 88 Z" fill={C.tealDark} />
        <circle cx="100" cy="44" r="5" fill={C.sun} />
        {/* eyes */}
        <motion.g style={{ originX: "80px", originY: "108px" }} animate={{ scaleY: sad ? 0.55 : happy ? 0.8 : [1, 1, 0.08, 1, 1] }} transition={{ duration: 4, repeat: Infinity, times: [0, 0.9, 0.93, 0.96, 1] }}>
          <ellipse cx="80" cy="108" rx="9.5" ry="11.5" fill={C.ink} />
          <circle cx="83.5" cy="103.5" r="3.4" fill="#ffffff" />
          <circle cx="77" cy="112" r="1.6" fill="#ffffff" opacity="0.8" />
        </motion.g>
        <motion.g style={{ originX: "120px", originY: "108px" }} animate={{ scaleY: sad ? 0.55 : happy ? 0.8 : [1, 1, 0.08, 1, 1] }} transition={{ duration: 4, repeat: Infinity, times: [0, 0.9, 0.93, 0.96, 1] }}>
          <ellipse cx="120" cy="108" rx="9.5" ry="11.5" fill={C.ink} />
          <circle cx="123.5" cy="103.5" r="3.4" fill="#ffffff" />
          <circle cx="117" cy="112" r="1.6" fill="#ffffff" opacity="0.8" />
        </motion.g>
        {/* cheeks */}
        <ellipse cx="62" cy="124" rx="8.5" ry="5.5" fill={C.coralSoft} opacity="0.8" />
        <ellipse cx="138" cy="124" rx="8.5" ry="5.5" fill={C.coralSoft} opacity="0.8" />
        {/* mouth */}
        {speaking ? (
          <g fill={C.ink}>
            {[90, 100, 110].map((x, i) => (
              <motion.rect key={x} x={x - 2.5} width="5" rx="2.5" y="128" height="8" style={{ originX: `${x}px`, originY: "132px" }} animate={{ scaleY: [0.5, 1.6, 0.7, 1.3, 0.5] }} transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.12 }} />
            ))}
          </g>
        ) : sad ? (
          <path d="M91 136 Q100 128 109 136" stroke={C.ink} strokeWidth="3.5" strokeLinecap="round" fill="none" />
        ) : happy ? (
          <path d="M86 128 Q100 146 114 128 Z" fill={C.ink} />
        ) : (
          <path d="M91 128 Q100 138 109 128" stroke={C.ink} strokeWidth="3.5" strokeLinecap="round" fill="none" />
        )}
      </motion.g>
    </svg>
  );
}
