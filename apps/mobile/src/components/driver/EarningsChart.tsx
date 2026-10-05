import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import type { DriverEarningsDto } from "@raahi/shared";
import { spring } from "@/lib/motion";
import { haptic } from "@/lib/native";
import { pkr } from "@/lib/utils";

const W = 340;
const H = 150;
const PAD_X = 6;
const BASE = H - 22;
const CHART_H = BASE - 14;

/**
 * 30-day earnings as an SVG bar chart. Rounded teal bars grow from the
 * baseline with a stagger; tapping a bar pins a tooltip. Today is coral.
 */
export function EarningsChart({ daily, className }: { daily: DriverEarningsDto["daily"]; className?: string }) {
  const [selected, setSelected] = useState<number | null>(null);
  const days = useMemo(() => daily.slice(-30), [daily]);
  const max = useMemo(() => Math.max(1, ...days.map((d) => d.earningsPkr)), [days]);
  const n = Math.max(1, days.length);
  const slot = (W - PAD_X * 2) / n;
  const barW = Math.max(4, Math.min(12, slot * 0.62));
  const todayKey = new Date().toISOString().slice(0, 10);
  const sel = selected !== null ? days[selected] : undefined;

  return (
    <div className={className}>
      <div className="relative">
        <AnimatePresence>
          {sel && selected !== null && (
            <motion.div
              key={sel.date}
              initial={{ opacity: 0, y: 6, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.95 }}
              transition={spring}
              className="absolute -top-1 z-10 bg-ink-900 text-white rounded-2xl px-3 py-1.5 text-[12px] shadow-float pointer-events-none -translate-x-1/2"
              style={{ left: `${((PAD_X + selected * slot + slot / 2) / W) * 100}%` }}
            >
              <p className="font-display font-semibold text-[13px] tabular-nums whitespace-nowrap">{pkr(sel.earningsPkr)}</p>
              <p className="text-white/70 font-semibold whitespace-nowrap">
                {new Date(sel.date).toLocaleDateString("en-PK", { weekday: "short", day: "numeric", month: "short" })} · {sel.rides} ride{sel.rides === 1 ? "" : "s"}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto select-none" role="img" aria-label="Earnings over the last 30 days">
          <defs>
            <linearGradient id="earn-bar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#3fbdab" />
              <stop offset="1" stopColor="#12a594" />
            </linearGradient>
            <linearGradient id="earn-bar-today" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ff8a6c" />
              <stop offset="1" stopColor="#ff6b4a" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <line key={f} x1={PAD_X} x2={W - PAD_X} y1={BASE - CHART_H * f} y2={BASE - CHART_H * f} stroke="#f6e9d8" strokeDasharray="3 5" />
          ))}
          <line x1={PAD_X} x2={W - PAD_X} y1={BASE} y2={BASE} stroke="#ead9c3" strokeWidth={1.5} />
          {days.map((d, i) => {
            const h = d.earningsPkr > 0 ? Math.max(4, (d.earningsPkr / max) * CHART_H) : 3;
            const x = PAD_X + i * slot + (slot - barW) / 2;
            const isToday = d.date.slice(0, 10) === todayKey;
            const active = selected === i;
            return (
              <g key={d.date}>
                <rect
                  x={PAD_X + i * slot}
                  y={0}
                  width={slot}
                  height={H}
                  fill="transparent"
                  onClick={() => {
                    haptic.tick();
                    setSelected((s) => (s === i ? null : i));
                  }}
                />
                <motion.rect
                  x={x}
                  width={barW}
                  rx={barW / 2}
                  fill={d.earningsPkr > 0 ? (isToday ? "url(#earn-bar-today)" : "url(#earn-bar)") : "#ead9c3"}
                  initial={{ y: BASE, height: 0, opacity: 0 }}
                  animate={{ y: BASE - h, height: h, opacity: active || selected === null ? 1 : 0.4 }}
                  transition={{ y: { ...spring, delay: i * 0.018 }, height: { ...spring, delay: i * 0.018 }, opacity: { duration: 0.2 } }}
                  style={{ pointerEvents: "none" }}
                />
                {i % 5 === 0 && (
                  <text x={PAD_X + i * slot + slot / 2} y={H - 6} textAnchor="middle" fontSize={9.5} fontWeight={700} fill="#a39cb0" fontFamily="inherit">
                    {new Date(d.date).toLocaleDateString("en-PK", { day: "numeric", month: "short" })}
                  </text>
                )}
              </g>
            );
          })}
          <text x={W - PAD_X} y={BASE - CHART_H - 4} textAnchor="end" fontSize={9.5} fontWeight={700} fill="#a39cb0" fontFamily="inherit">
            {pkr(max)}
          </text>
        </svg>
      </div>
    </div>
  );
}
