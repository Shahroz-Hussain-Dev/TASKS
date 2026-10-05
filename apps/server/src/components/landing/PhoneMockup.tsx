"use client";

import { Microphone, Star } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
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

const AVATAR_TINT = ["bg-coral-100 text-coral-700", "bg-teal-100 text-teal-700", "bg-lavender-100 text-lavender-700", "bg-sky-100 text-sky-700"];

/** A CSS-only phone that replays the bidding moment: an offer goes out, drivers answer. Light "Sunrise" UI. */
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
      <span className="blob -left-16 -top-10 h-56 w-56 bg-sun-100" style={{ animationDelay: "-4s" }} />
      <span className="blob -bottom-12 -right-16 h-64 w-64 bg-teal-100" style={{ animationDelay: "-9s" }} />
      <div className="relative aspect-[9/19] overflow-hidden rounded-[44px] border-[6px] border-white bg-paper-50 shadow-float ring-1 ring-paper-300">
        <div className="absolute left-1/2 top-2.5 z-20 h-6 w-28 -translate-x-1/2 rounded-full bg-ink-900" />

        {/* Map in the warm paper palette */}
        <div className="absolute inset-x-0 top-0 h-[46%] overflow-hidden bg-[#fff6ec]">
          <svg viewBox="0 0 320 300" className="h-full w-full">
            <rect x="0" y="0" width="120" height="60" rx="14" fill="#dff3e3" />
            <rect x="230" y="190" width="110" height="120" rx="18" fill="#cfe8ff" />
            <g stroke="#ecdcc8" strokeWidth="9" fill="none" strokeLinecap="round">
              <path d="M-10 80 H330" />
              <path d="M-10 170 H330" />
              <path d="M90 -10 V310" />
              <path d="M210 -10 V310" />
            </g>
            <g stroke="#ffffff" strokeWidth="6" fill="none" strokeLinecap="round">
              <path d="M-10 80 H330" />
              <path d="M-10 170 H330" />
              <path d="M90 -10 V310" />
              <path d="M210 -10 V310" />
            </g>
            <g stroke="#ffffff" strokeWidth="3" fill="none">
              <path d="M-10 125 H330" />
              <path d="M150 -10 V310" />
              <path d="M40 -10 V310" />
              <path d="M270 -10 V310" />
            </g>
            <path d="M60 240 C 90 200, 130 210, 160 160 S 230 90, 262 72" stroke="#ffffff" strokeWidth="10" fill="none" strokeLinecap="round" />
            <path d="M60 240 C 90 200, 130 210, 160 160 S 230 90, 262 72" stroke="url(#mock-route)" strokeWidth="5" fill="none" strokeLinecap="round" strokeDasharray="300" className="animate-[dash_3s_ease-in-out_infinite]" />
            <defs>
              <linearGradient id="mock-route" x1="60" y1="240" x2="262" y2="72" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#12a594" />
                <stop offset="1" stopColor="#ff6b4a" />
              </linearGradient>
            </defs>
            <circle cx="60" cy="240" r="9" fill="#12a594" stroke="#ffffff" strokeWidth="3.5" />
            <circle cx="262" cy="72" r="9" fill="#ff6b4a" stroke="#ffffff" strokeWidth="3.5" />
          </svg>
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-paper-50 to-transparent" />
          <div className="absolute left-4 right-4 top-12 flex items-center gap-2 rounded-full bg-white px-3 py-2 shadow-pillow">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-coral-100 text-coral-600">
              <Microphone size={13} weight="fill" />
            </span>
            <span className="truncate text-[11px] font-bold text-ink-900">Gulberg → DHA Phase 5</span>
          </div>
        </div>

        {/* Sheet */}
        <div className="absolute inset-x-0 bottom-0 h-[58%] rounded-t-[28px] bg-white px-4 pt-3 shadow-[0_-12px_30px_-18px_rgb(63_42_20_/_0.3)]">
          <div className="mx-auto h-1 w-10 rounded-full bg-paper-300" />
          <div className="mt-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-ink-500">Your offer</p>
              <p className="mt-0.5 inline-flex items-center rounded-full bg-sun-100 px-2.5 py-0.5 font-display text-[20px] font-semibold tabular-nums text-ink-900">PKR {OFFER}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-bold text-ink-700">8.2 km · 22 min</p>
              <p className="text-[11px] text-ink-500">Ride · cash</p>
            </div>
          </div>
          <p className="mt-3 flex items-center gap-2 text-[11.5px] font-bold text-ink-700">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-coral-500 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-coral-500" />
            </span>
            {shown.length === 0 ? "Sending your offer to nearby drivers…" : `${shown.length} driver${shown.length === 1 ? "" : "s"} replied`}
          </p>
          <ul className="mt-2 space-y-2">
            <AnimatePresence initial={false}>
              {shown.map((b) => {
                const win = b.price === OFFER;
                return (
                  <motion.li key={b.id} layout initial={{ opacity: 0, x: 60, scale: 0.96 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, y: 20 }} transition={{ type: "spring", stiffness: 420, damping: 32 }} className={`flex items-center gap-2.5 rounded-2xl p-2.5 ${win ? "bg-teal-100/70 ring-1 ring-teal-200" : "bg-paper-50 ring-1 ring-paper-200"}`}>
                    <span className={`grid h-9 w-9 place-items-center rounded-full font-display text-[12px] font-semibold ${AVATAR_TINT[(b.id - 1) % AVATAR_TINT.length]}`}>{b.name[0]}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1 text-[12.5px] font-bold text-ink-900">
                        {b.name}
                        <Star size={11} weight="fill" className="text-sun-500" />
                        <span className="font-semibold text-ink-500">{b.rating}</span>
                      </span>
                      <span className="block truncate text-[10.5px] text-ink-500">
                        {b.car} · {b.eta}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className={`block font-display text-[14px] font-semibold tabular-nums ${win ? "text-teal-700" : "text-ink-900"}`}>PKR {b.price}</span>
                      <span className={`block text-[10px] font-bold ${win ? "text-teal-700" : "text-ink-500"}`}>{win ? "Your price" : `+${b.price - OFFER}`}</span>
                    </span>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        </div>
      </div>
      <style>{`@keyframes dash{0%{stroke-dashoffset:300}60%,100%{stroke-dashoffset:0}}`}</style>
    </div>
  );
}
