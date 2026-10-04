"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Star } from "lucide-react";
import { useEffect, useState } from "react";

interface Bid {
  id: number;
  name: string;
  car: string;
  rating: string;
  eta: string;
  price: number;
}

const OFFER = 450;
const BIDS: Bid[] = [
  { id: 1, name: "Imran", car: "Suzuki Alto · LEB 4821", rating: "4.9", eta: "3 min", price: 450 },
  { id: 2, name: "Bilal", car: "Toyota Vitz · AJK 907", rating: "4.8", eta: "5 min", price: 480 },
  { id: 3, name: "Ahsan", car: "Honda City · LEA 2210", rating: "5.0", eta: "2 min", price: 450 },
  { id: 4, name: "Sana", car: "Suzuki Cultus · LEC 118", rating: "4.9", eta: "4 min", price: 470 },
];

/** A CSS-only phone that replays the bidding moment: an offer goes out, drivers answer. */
export function PhoneMockup() {
  const [shown, setShown] = useState<Bid[]>([]);

  useEffect(() => {
    let i = 0;
    let timer: number;
    const tick = () => {
      if (i < BIDS.length) {
        const next = BIDS[i]!;
        setShown((s) => [next, ...s].slice(0, 3));
        i += 1;
        timer = window.setTimeout(tick, 1400);
      } else {
        timer = window.setTimeout(() => {
          setShown([]);
          i = 0;
          tick();
        }, 2800);
      }
    };
    timer = window.setTimeout(tick, 900);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="relative mx-auto w-[300px] sm:w-[320px]" aria-hidden>
      <div className="absolute -inset-10 rounded-[64px] bg-brand-500/20 blur-3xl" />
      <div className="relative aspect-[9/19] overflow-hidden rounded-[44px] border-[6px] border-ink-700 bg-ink-900 shadow-float ring-1 ring-white/10">
        <div className="absolute left-1/2 top-2.5 z-20 h-6 w-28 -translate-x-1/2 rounded-full bg-ink-950" />

        {/* Map */}
        <div className="absolute inset-x-0 top-0 h-[46%] overflow-hidden bg-[#0e1526]">
          <svg viewBox="0 0 320 300" className="h-full w-full opacity-70">
            <g stroke="#263247" strokeWidth="6" fill="none" strokeLinecap="round">
              <path d="M-10 80 H330" />
              <path d="M-10 170 H330" />
              <path d="M90 -10 V310" />
              <path d="M210 -10 V310" />
            </g>
            <g stroke="#1a2235" strokeWidth="3" fill="none">
              <path d="M-10 125 H330" />
              <path d="M150 -10 V310" />
              <path d="M40 -10 V310" />
              <path d="M270 -10 V310" />
            </g>
            <path d="M60 240 C 90 200, 130 210, 160 160 S 230 90, 262 72" stroke="#34d399" strokeWidth="5" fill="none" strokeLinecap="round" strokeDasharray="300" className="animate-[dash_3s_ease-in-out_infinite]" />
            <circle cx="60" cy="240" r="8" fill="#38bdf8" stroke="#0b0f1a" strokeWidth="3" />
            <circle cx="262" cy="72" r="8" fill="#fb7185" stroke="#0b0f1a" strokeWidth="3" />
          </svg>
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-ink-900 to-transparent" />
        </div>

        {/* Sheet */}
        <div className="absolute inset-x-0 bottom-0 h-[58%] rounded-t-[28px] bg-ink-800 px-4 pt-3">
          <div className="mx-auto h-1 w-10 rounded-full bg-ink-600" />
          <div className="mt-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Your offer</p>
              <p className="font-display text-[22px] font-semibold text-amber-300">PKR {OFFER}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-ink-500">Gulberg → DHA Phase 5</p>
              <p className="text-[11px] text-ink-400">8.2 km · 22 min</p>
            </div>
          </div>
          <p className="mt-3 flex items-center gap-2 text-[11.5px] font-semibold text-ink-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-400" />
            </span>
            {shown.length === 0 ? "Sending your offer to nearby drivers…" : `${shown.length} driver${shown.length === 1 ? "" : "s"} replied`}
          </p>
          <ul className="mt-2 space-y-2">
            <AnimatePresence initial={false}>
              {shown.map((b) => (
                <motion.li key={b.id} layout initial={{ opacity: 0, x: 60, scale: 0.96 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, y: 20 }} transition={{ type: "spring", stiffness: 420, damping: 32 }} className="flex items-center gap-2.5 rounded-2xl border border-white/6 bg-ink-700/70 p-2.5">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-ink-600 font-display text-[12px] font-semibold text-ink-100">{b.name[0]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 text-[12.5px] font-semibold text-ink-50">
                      {b.name}
                      <Star size={10} className="fill-amber-400 text-amber-400" />
                      <span className="text-ink-400">{b.rating}</span>
                    </span>
                    <span className="block truncate text-[10.5px] text-ink-400">
                      {b.car} · {b.eta}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className={`block font-display text-[14px] font-semibold ${b.price === OFFER ? "text-brand-300" : "text-ink-50"}`}>PKR {b.price}</span>
                    <span className="block text-[10px] text-ink-500">{b.price === OFFER ? "Your price" : `+${b.price - OFFER}`}</span>
                  </span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>
      </div>
      <style>{`@keyframes dash{0%{stroke-dashoffset:300}60%,100%{stroke-dashoffset:0}}`}</style>
    </div>
  );
}
