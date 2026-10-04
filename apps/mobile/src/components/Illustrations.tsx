/**
 * Animated vector illustrations ("moving cartoons"). Pure SVG + framer-motion,
 * so they are crisp at any density and weigh a few KB. Each scene accepts a
 * className for sizing and animates continuously while mounted.
 */
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const loop = (duration: number, delay = 0) => ({ duration, repeat: Infinity, ease: "easeInOut" as const, delay });

/** Night city skyline with a car gliding along a glowing road. */
export function CityScene({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 360 260" className={cn("w-full h-auto", className)} fill="none">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b0f1a" />
          <stop offset="1" stopColor="#111a2e" />
        </linearGradient>
        <linearGradient id="road" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#10b981" stopOpacity="0" />
          <stop offset="0.5" stopColor="#34d399" />
          <stop offset="1" stopColor="#10b981" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="360" height="260" rx="28" fill="url(#sky)" />
      {/* stars */}
      {Array.from({ length: 18 }).map((_, i) => (
        <motion.circle key={i} cx={20 + ((i * 53) % 320)} cy={18 + ((i * 29) % 90)} r={i % 3 === 0 ? 1.6 : 1} fill="#cbd5e1" animate={{ opacity: [0.2, 0.9, 0.2] }} transition={loop(2 + (i % 4), i * 0.17)} />
      ))}
      {/* moon */}
      <circle cx="300" cy="46" r="18" fill="#e2e8f0" opacity="0.9" />
      <circle cx="308" cy="40" r="16" fill="#111a2e" />
      {/* far buildings */}
      <g fill="#161e2e">
        <rect x="20" y="120" width="34" height="80" rx="3" />
        <rect x="64" y="96" width="28" height="104" rx="3" />
        <rect x="100" y="130" width="46" height="70" rx="3" />
        <rect x="156" y="84" width="30" height="116" rx="3" />
        <rect x="196" y="112" width="52" height="88" rx="3" />
        <rect x="258" y="98" width="26" height="102" rx="3" />
        <rect x="292" y="124" width="48" height="76" rx="3" />
      </g>
      {/* windows */}
      {Array.from({ length: 40 }).map((_, i) => {
        const col = i % 8;
        const row = Math.floor(i / 8);
        const x = 26 + col * 40 + (row % 2) * 6;
        const y = 136 + row * 14;
        return <motion.rect key={i} x={x} y={y} width="5" height="7" rx="1" fill="#fbbf24" animate={{ opacity: [0.15, 0.85, 0.15] }} transition={loop(3 + (i % 5), (i * 0.23) % 3)} />;
      })}
      {/* Minar-e-Pakistan silhouette */}
      <g fill="#1a2235">
        <rect x="236" y="70" width="8" height="130" rx="2" />
        <path d="M232 70 L240 54 L248 70 Z" />
        <rect x="226" y="140" width="28" height="8" rx="2" />
      </g>
      {/* ground */}
      <rect x="0" y="200" width="360" height="60" fill="#0e1424" />
      <rect x="0" y="212" width="360" height="4" fill="url(#road)" />
      <motion.rect x="0" y="213" width="60" height="2" rx="1" fill="#e2e8f0" animate={{ x: [-60, 360] }} transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }} />
      {/* car */}
      <motion.g animate={{ x: [-30, 10, -30], y: [0, -1, 0] }} transition={loop(5)}>
        <g transform="translate(130 184)">
          <rect x="0" y="12" width="88" height="22" rx="8" fill="#e2e8f0" />
          <path d="M14 12 C 18 2, 30 0, 44 0 L 60 0 C 70 0, 76 4, 80 12 Z" fill="#cbd5e1" />
          <path d="M22 11 C 25 5, 32 3, 42 3 L 42 11 Z" fill="#111a2e" />
          <path d="M48 3 L 60 3 C 66 3, 71 6, 74 11 L 48 11 Z" fill="#111a2e" />
          <rect x="2" y="20" width="10" height="5" rx="2" fill="#fbbf24" />
          <rect x="76" y="20" width="10" height="5" rx="2" fill="#f43f5e" />
          <motion.circle cx="20" cy="36" r="8" fill="#0b0f1a" stroke="#334155" strokeWidth="3" animate={{ rotate: 360 }} transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }} />
          <motion.circle cx="68" cy="36" r="8" fill="#0b0f1a" stroke="#334155" strokeWidth="3" animate={{ rotate: 360 }} transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }} />
          <circle cx="20" cy="36" r="2.5" fill="#94a3b8" />
          <circle cx="68" cy="36" r="2.5" fill="#94a3b8" />
          {/* headlight beam */}
          <motion.path d="M-40 18 L 2 20 L 2 26 L -40 32 Z" fill="#fbbf24" opacity="0.18" animate={{ opacity: [0.1, 0.25, 0.1] }} transition={loop(1.8)} />
        </g>
      </motion.g>
    </svg>
  );
}

/** Phone with bid cards sliding in from drivers. */
export function BiddingScene({ className }: { className?: string }) {
  const bids = [
    { x: 22, y: 92, amount: "PKR 450", delay: 0 },
    { x: 22, y: 134, amount: "PKR 420", delay: 0.8 },
    { x: 22, y: 176, amount: "PKR 480", delay: 1.6 },
  ];
  return (
    <svg viewBox="0 0 360 260" className={cn("w-full h-auto", className)} fill="none">
      <rect width="360" height="260" rx="28" fill="#0e1424" />
      <motion.circle cx="80" cy="60" r="70" fill="#10b981" opacity="0.08" animate={{ scale: [1, 1.15, 1] }} transition={loop(6)} />
      <motion.circle cx="300" cy="210" r="90" fill="#fbbf24" opacity="0.06" animate={{ scale: [1.1, 1, 1.1] }} transition={loop(7)} />
      {/* phone */}
      <rect x="120" y="22" width="120" height="216" rx="22" fill="#1a2235" stroke="#334155" strokeWidth="2" />
      <rect x="128" y="34" width="104" height="192" rx="16" fill="#0b0f1a" />
      <rect x="160" y="40" width="40" height="5" rx="2.5" fill="#243047" />
      <text x="138" y="70" fill="#e2e8f0" fontSize="9" fontWeight="700" fontFamily="Sora Variable, sans-serif">
        Your offer
      </text>
      <text x="138" y="84" fill="#34d399" fontSize="13" fontWeight="800" fontFamily="Sora Variable, sans-serif">
        PKR 400
      </text>
      {bids.map((b, i) => (
        <motion.g key={i} initial={{ x: -140, opacity: 0 }} animate={{ x: [-140, 0, 0, 0, -140], opacity: [0, 1, 1, 1, 0] }} transition={{ duration: 4.2, repeat: Infinity, delay: b.delay, times: [0, 0.18, 0.5, 0.8, 1], ease: "easeInOut" }}>
          <rect x={136} y={b.y} width="88" height="32" rx="10" fill="#161e2e" stroke="#243047" />
          <circle cx={150} cy={b.y + 16} r="8" fill="#334155" />
          <rect x={162} y={b.y + 8} width="34" height="5" rx="2" fill="#94a3b8" />
          <text x={162} y={b.y + 25} fill="#fbbf24" fontSize="8.5" fontWeight="800" fontFamily="Sora Variable, sans-serif">
            {b.amount}
          </text>
        </motion.g>
      ))}
      {/* drivers around */}
      {[
        { cx: 62, cy: 128 },
        { cx: 296, cy: 96 },
        { cx: 290, cy: 176 },
      ].map((d, i) => (
        <g key={i}>
          <motion.circle cx={d.cx} cy={d.cy} r="16" fill="#10b981" opacity="0.25" animate={{ scale: [1, 1.8], opacity: [0.3, 0] }} transition={{ duration: 2, repeat: Infinity, delay: i * 0.6, ease: "easeOut" }} />
          <circle cx={d.cx} cy={d.cy} r="14" fill="#1a2235" stroke="#34d399" strokeWidth="2" />
          <path d={`M${d.cx - 6} ${d.cy + 3} h12 v-5 l-3 -4 h-6 l-3 4 z`} fill="#34d399" />
        </g>
      ))}
    </svg>
  );
}

/** Shield + verified documents. */
export function SafetyScene({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 360 260" className={cn("w-full h-auto", className)} fill="none">
      <rect width="360" height="260" rx="28" fill="#0e1424" />
      <motion.g animate={{ y: [0, -6, 0] }} transition={loop(4)}>
        <path d="M180 36 L 250 62 V 130 C 250 176, 218 210, 180 226 C 142 210, 110 176, 110 130 V 62 Z" fill="#10b981" opacity="0.15" />
        <path d="M180 48 L 238 70 V 130 C 238 170, 212 198, 180 212 C 148 198, 122 170, 122 130 V 70 Z" fill="#111a2e" stroke="#34d399" strokeWidth="3" />
        <motion.path d="M152 132 L 172 152 L 212 110" stroke="#34d399" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: [0, 1, 1, 0] }} transition={{ duration: 3, repeat: Infinity, times: [0, 0.4, 0.8, 1] }} />
      </motion.g>
      {/* id cards */}
      <motion.g animate={{ x: [0, 6, 0], rotate: [-8, -6, -8] }} transition={loop(5)} style={{ originX: "60px", originY: "180px" }}>
        <rect x="26" y="150" width="86" height="56" rx="8" fill="#1a2235" stroke="#334155" />
        <circle cx="48" cy="172" r="10" fill="#334155" />
        <rect x="64" y="164" width="36" height="5" rx="2" fill="#94a3b8" />
        <rect x="64" y="174" width="26" height="5" rx="2" fill="#64748b" />
        <rect x="34" y="192" width="64" height="4" rx="2" fill="#34d399" />
      </motion.g>
      <motion.g animate={{ x: [0, -6, 0], rotate: [8, 6, 8] }} transition={loop(5.5)} style={{ originX: "300px", originY: "80px" }}>
        <rect x="252" y="52" width="86" height="56" rx="8" fill="#1a2235" stroke="#334155" />
        <rect x="262" y="62" width="40" height="6" rx="2" fill="#fbbf24" />
        <rect x="262" y="74" width="60" height="4" rx="2" fill="#94a3b8" />
        <rect x="262" y="84" width="48" height="4" rx="2" fill="#64748b" />
        <rect x="262" y="94" width="30" height="4" rx="2" fill="#64748b" />
      </motion.g>
    </svg>
  );
}

/** Rising earnings bars + coins for the driver pitch. */
export function EarningsScene({ className }: { className?: string }) {
  const bars = [60, 90, 70, 120, 100, 150, 130];
  return (
    <svg viewBox="0 0 360 260" className={cn("w-full h-auto", className)} fill="none">
      <rect width="360" height="260" rx="28" fill="#0e1424" />
      {bars.map((h, i) => (
        <motion.rect key={i} x={48 + i * 40} y={210 - h} width="24" height={h} rx="8" fill={i === bars.length - 1 ? "#34d399" : "#1f2a3f"} initial={{ scaleY: 0 }} animate={{ scaleY: [0, 1, 1, 1, 0] }} transition={{ duration: 5, repeat: Infinity, delay: i * 0.12, times: [0, 0.2, 0.8, 0.95, 1] }} style={{ originY: "210px" }} />
      ))}
      <motion.path d="M60 150 L 100 120 L 140 134 L 180 90 L 220 104 L 260 60 L 300 70" stroke="#fbbf24" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: [0, 1, 1, 0] }} transition={{ duration: 5, repeat: Infinity, times: [0.1, 0.5, 0.85, 1] }} />
      {[0, 1, 2].map((i) => (
        <motion.g key={i} animate={{ y: [0, -14, 0] }} transition={loop(2.4, i * 0.4)}>
          <circle cx={262 + i * 24} cy={52 - i * 10} r="12" fill="#fbbf24" />
          <circle cx={262 + i * 24} cy={52 - i * 10} r="8" fill="#f59e0b" />
          <text x={262 + i * 24} y={56 - i * 10} textAnchor="middle" fill="#0b0f1a" fontSize="9" fontWeight="900" fontFamily="Sora Variable, sans-serif">
            ₨
          </text>
        </motion.g>
      ))}
      <text x="48" y="238" fill="#94a3b8" fontSize="11" fontWeight="600" fontFamily="Manrope Variable, sans-serif">
        100% of every fare is yours
      </text>
    </svg>
  );
}

/** Radar sweep used while waiting for driver offers. */
export function RadarSearch({ className, size = 220 }: { className?: string; size?: number }) {
  return (
    <div className={cn("relative flex items-center justify-center", className)} style={{ width: size, height: size }}>
      {[0, 1, 2].map((i) => (
        <motion.span key={i} className="absolute inset-0 rounded-full border border-brand-400/40" initial={{ scale: 0.3, opacity: 0.8 }} animate={{ scale: 1.1, opacity: 0 }} transition={{ duration: 2.6, repeat: Infinity, delay: i * 0.85, ease: "easeOut" }} />
      ))}
      <motion.div className="absolute inset-0 rounded-full" style={{ background: "conic-gradient(from 0deg, rgba(52,211,153,0) 0deg, rgba(52,211,153,0.35) 60deg, rgba(52,211,153,0) 120deg)" }} animate={{ rotate: 360 }} transition={{ duration: 3.2, repeat: Infinity, ease: "linear" }} />
      <div className="absolute size-[44%] rounded-full glass flex items-center justify-center shadow-glow">
        <svg width="40%" height="40%" viewBox="0 0 24 24" fill="none">
          <path d="M12 2.5c-.9 0-1.7.4-2.3 1L6.8 7.4A2.5 2.5 0 006 9.2V19a2 2 0 002 2h8a2 2 0 002-2V9.2c0-.7-.3-1.3-.8-1.8L14.3 3.5A3.2 3.2 0 0012 2.5zm-4 8.5h8v3H8v-3z" fill="#34d399" />
        </svg>
      </div>
    </div>
  );
}

/** Small animated car for inline loaders / empty states. */
export function AnimatedCar({ className, size = 120 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size * 0.5} viewBox="0 0 120 60" className={className} fill="none">
      <motion.g animate={{ y: [0, -1.5, 0] }} transition={loop(0.6)}>
        <rect x="8" y="22" width="92" height="22" rx="8" fill="#e2e8f0" />
        <path d="M24 22 C 28 10, 40 8, 54 8 L 70 8 C 80 8, 86 12, 90 22 Z" fill="#cbd5e1" />
        <path d="M32 21 C 35 14, 42 12, 52 12 L 52 21 Z" fill="#111a2e" />
        <path d="M58 12 L 70 12 C 76 12, 81 15, 84 21 L 58 21 Z" fill="#111a2e" />
        <rect x="10" y="30" width="10" height="5" rx="2" fill="#fbbf24" />
      </motion.g>
      <motion.circle cx="30" cy="46" r="9" fill="#0b0f1a" stroke="#334155" strokeWidth="3" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }} style={{ originX: "30px", originY: "46px" }} />
      <motion.circle cx="80" cy="46" r="9" fill="#0b0f1a" stroke="#334155" strokeWidth="3" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }} style={{ originX: "80px", originY: "46px" }} />
      <circle cx="30" cy="46" r="3" fill="#94a3b8" />
      <circle cx="80" cy="46" r="3" fill="#94a3b8" />
      <motion.rect x="-30" y="56" width="26" height="2" rx="1" fill="#34d399" animate={{ x: [-30, 130] }} transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }} />
    </svg>
  );
}
