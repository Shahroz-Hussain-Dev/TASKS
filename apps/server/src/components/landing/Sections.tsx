"use client";

import { motion, type Variants } from "framer-motion";
import { ArrowRight, Banknote, Fuel, Gauge, HandCoins, ShieldCheck, Smartphone, Sparkles, Users, Wallet } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { PhoneMockup } from "./PhoneMockup";

const spring = { type: "spring", stiffness: 300, damping: 30 } as const;
const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } } };
const up: Variants = { hidden: { opacity: 0, y: 28 }, show: { opacity: 1, y: 0, transition: spring } };
const left: Variants = { hidden: { opacity: 0, x: -36 }, show: { opacity: 1, x: 0, transition: spring } };
const right: Variants = { hidden: { opacity: 0, x: 36 }, show: { opacity: 1, x: 0, transition: spring } };

function Reveal({ children, className, variants = stagger }: { children: ReactNode; className?: string; variants?: Variants }) {
  return (
    <motion.div variants={variants} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }} className={className}>
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */

export function Hero() {
  return (
    <section className="relative overflow-hidden px-4 pb-20 pt-32 sm:pt-40">
      <span className="aurora left-[-10%] top-[5%] h-[520px] w-[520px] bg-brand-500/50" />
      <span className="aurora right-[-5%] top-[20%] h-[460px] w-[460px] bg-amber-400/25" style={{ animationDelay: "-6s" }} />
      <span className="aurora bottom-[-10%] left-[30%] h-[420px] w-[420px] bg-violet-400/30" style={{ animationDelay: "-12s" }} />
      <div className="relative mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2">
        <motion.div variants={stagger} initial="hidden" animate="show">
          <motion.p variants={up} className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-3.5 py-1.5 text-[13px] font-semibold text-brand-300">
            <Sparkles size={14} /> Fair-price rides across Pakistan
          </motion.p>
          <motion.h1 variants={up} className="mt-6 font-display text-[44px] font-semibold leading-[1.02] tracking-tight text-ink-50 sm:text-[64px]">
            Your ride.
            <br />
            <span className="text-gradient">Your price.</span>
          </motion.h1>
          <motion.p variants={up} className="mt-6 max-w-lg text-[17px] leading-relaxed text-ink-300">
            Name the fare you want to pay. Nearby drivers accept or counter in seconds, and you choose who takes you. No surge, no hidden commission — every rupee goes to the driver.
          </motion.p>
          <motion.div variants={up} className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/download" className="inline-flex items-center gap-2 rounded-2xl bg-brand-500 px-6 py-3.5 text-[15px] font-semibold text-ink-950 shadow-glow transition-colors hover:bg-brand-400">
              <Smartphone size={18} /> Download for Android
            </Link>
            <a href="#how" className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-6 py-3.5 text-[15px] font-semibold text-ink-100 transition-colors hover:bg-white/5">
              See how it works <ArrowRight size={16} />
            </a>
          </motion.div>
          <motion.dl variants={up} className="mt-10 grid max-w-md grid-cols-3 gap-4">
            {[
              ["0%", "commission"],
              ["60 s", "to get offers"],
              ["5", "ride types"],
            ].map(([v, l]) => (
              <div key={l}>
                <dt className="font-display text-[26px] font-semibold text-ink-50">{v}</dt>
                <dd className="text-[13px] text-ink-400">{l}</dd>
              </div>
            ))}
          </motion.dl>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 40, rotate: -2 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ ...spring, delay: 0.3 }}>
          <PhoneMockup />
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

const STEPS = [
  { icon: HandCoins, title: "Name your fare", body: "Pick where you're going. Raahi suggests a fair price built from real fuel costs — adjust it up or down to suit you." },
  { icon: Users, title: "Drivers compete", body: "Every driver nearby sees your offer. They accept it or send a counter-offer with their car, rating and arrival time." },
  { icon: Gauge, title: "Ride for less", body: "Choose the driver you like, track them live, pay cash at the end. Rate each other so the good ones rise." },
];

export function HowItWorks() {
  return (
    <section id="how" className="px-4 py-20">
      <Reveal className="mx-auto max-w-6xl">
        <motion.p variants={up} className="text-[13px] font-semibold uppercase tracking-[0.2em] text-brand-400">
          How it works
        </motion.p>
        <motion.h2 variants={up} className="mt-3 max-w-2xl font-display text-[34px] font-semibold leading-tight text-ink-50 sm:text-[42px]">
          Three taps between you and a fair ride.
        </motion.h2>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <motion.article key={s.title} variants={up} whileHover={{ y: -4 }} className="relative overflow-hidden rounded-3xl border border-white/6 bg-ink-800 p-7 shadow-card">
              <span className="absolute right-5 top-4 font-display text-[64px] font-semibold leading-none text-white/4">{i + 1}</span>
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-500/15 text-brand-400">
                <s.icon size={22} strokeWidth={2.1} />
              </span>
              <h3 className="mt-6 font-display text-[21px] font-semibold text-ink-50">{s.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-300">{s.body}</p>
            </motion.article>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

/* ------------------------------------------------------------------ */

export function DriverSection() {
  return (
    <section id="drivers" className="relative overflow-hidden px-4 py-20">
      <span className="aurora right-[-10%] top-[10%] h-[420px] w-[420px] bg-amber-400/20" style={{ animationDelay: "-3s" }} />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
        <Reveal variants={left}>
          <p className="text-[13px] font-semibold uppercase tracking-[0.2em] text-amber-300">For drivers</p>
          <h2 className="mt-3 font-display text-[34px] font-semibold leading-tight text-ink-50 sm:text-[42px]">
            100% of the fare is yours. <span className="text-amber-300">Always.</span>
          </h2>
          <p className="mt-5 max-w-lg text-[16px] leading-relaxed text-ink-300">
            Raahi doesn&apos;t take a cut of your rides. Instead you pay one flat subscription of PKR 1,000 a month — whether you do ten trips or three hundred. See the fuel cost and your take-home before you accept any job.
          </p>
          <ul className="mt-8 space-y-4">
            {[
              [Banknote, "Keep every rupee", "The passenger pays you directly in cash. Nothing is deducted, ever."],
              [Wallet, "PKR 1,000 / month", "Pay by JazzCash, EasyPaisa or bank transfer and upload the receipt. Active in minutes."],
              [ShieldCheck, "Verified in a day", "Upload your CNIC, license and vehicle papers once. Our AI checks them instantly and a human confirms."],
            ].map(([Icon, t, b]) => {
              const I = Icon as typeof Banknote;
              return (
                <li key={String(t)} className="flex gap-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-400/15 text-amber-300">
                    <I size={19} />
                  </span>
                  <span>
                    <span className="block text-[16px] font-semibold text-ink-50">{String(t)}</span>
                    <span className="block text-[14.5px] text-ink-400">{String(b)}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </Reveal>
        <Reveal variants={right}>
          <div className="rounded-3xl border border-white/6 bg-ink-800 p-7 shadow-card">
            <p className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-500">A typical month in Lahore</p>
            <div className="mt-5 space-y-3">
              {[
                ["Rides completed", "180"],
                ["Fares collected", "PKR 81,000"],
                ["Platform commission", "PKR 0"],
                ["Raahi subscription", "− PKR 1,000"],
              ].map(([l, v]) => (
                <div key={l} className="flex items-center justify-between border-b border-white/5 pb-3 text-[15px]">
                  <span className="text-ink-300">{l}</span>
                  <span className={`font-display font-semibold ${v.startsWith("−") ? "text-rose-400" : "text-ink-50"}`}>{v}</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[15px] font-semibold text-ink-100">You keep</span>
                <span className="font-display text-[30px] font-semibold text-brand-300">PKR 80,000</span>
              </div>
            </div>
            <p className="mt-5 text-[12.5px] text-ink-500">Illustrative figures at PKR 450 average fare. On a 20% commission app the same month costs PKR 16,200.</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

export function FareSection() {
  return (
    <section id="fare" className="px-4 py-20">
      <Reveal className="mx-auto max-w-6xl">
        <motion.p variants={up} className="text-[13px] font-semibold uppercase tracking-[0.2em] text-brand-400">
          Fare transparency
        </motion.p>
        <motion.h2 variants={up} className="mt-3 max-w-2xl font-display text-[34px] font-semibold leading-tight text-ink-50 sm:text-[42px]">
          No algorithm decides your price. Arithmetic does.
        </motion.h2>
        <motion.p variants={up} className="mt-4 max-w-2xl text-[16px] leading-relaxed text-ink-300">
          Every suggested fare starts from what the trip actually costs to drive, using the official OGRA petrol price and the fuel economy of the car you picked. The minimum guarantees the driver never loses money; everything above it is up to you and them.
        </motion.p>

        <motion.div variants={up} className="mt-10 overflow-hidden rounded-3xl border border-white/6 bg-ink-800 shadow-card">
          <div className="grid gap-px bg-white/5 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
            <Term icon={<Gauge size={18} />} label="Distance" value="8.2 km" />
            <Op>÷</Op>
            <Term icon={<Fuel size={18} />} label="Fuel economy" value="14 km / L" />
            <Op>×</Op>
            <Term icon={<Banknote size={18} />} label="Petrol price" value="PKR 392.76 / L" />
            <Op>+</Op>
            <Term icon={<HandCoins size={18} />} label="Driver floor" value="PKR 100" highlight />
          </div>
          <div className="flex flex-col gap-4 bg-ink-900/60 px-7 py-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[13px] text-ink-400">Minimum fare for this trip</p>
              <p className="font-display text-[34px] font-semibold text-ink-50">PKR 330</p>
            </div>
            <div className="grid grid-cols-3 gap-6 text-[13.5px]">
              <div>
                <p className="text-ink-500">Fuel used</p>
                <p className="font-semibold text-ink-100">0.59 L ≈ PKR 230</p>
              </div>
              <div>
                <p className="text-ink-500">Recommended</p>
                <p className="font-semibold text-brand-300">PKR 410</p>
              </div>
              <div>
                <p className="text-ink-500">Ceiling</p>
                <p className="font-semibold text-ink-100">PKR 660</p>
              </div>
            </div>
          </div>
        </motion.div>
        <motion.p variants={up} className="mt-4 text-[13px] text-ink-500">
          Recommended adds 15% fuel headroom and PKR 2 per minute of travel; the ceiling is 1.6× recommended. Petrol price updates follow OGRA notifications.
        </motion.p>
      </Reveal>
    </section>
  );
}

function Term({ icon, label, value, highlight }: { icon: ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex items-center gap-3 bg-ink-800 px-6 py-6 ${highlight ? "text-amber-300" : "text-ink-100"}`}>
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${highlight ? "bg-amber-400/15" : "bg-brand-500/15 text-brand-400"}`}>{icon}</span>
      <span>
        <span className="block text-[12px] uppercase tracking-wide text-ink-500">{label}</span>
        <span className="block font-display text-[18px] font-semibold">{value}</span>
      </span>
    </div>
  );
}

function Op({ children }: { children: ReactNode }) {
  return <div className="grid place-items-center bg-ink-800 px-3 py-2 font-display text-[26px] text-ink-500 md:px-2">{children}</div>;
}

/* ------------------------------------------------------------------ */

export function DownloadCta() {
  return (
    <section className="px-4 py-20">
      <Reveal variants={up} className="relative mx-auto max-w-6xl overflow-hidden rounded-[36px] border border-white/8 bg-ink-800 px-8 py-14 text-center shadow-float sm:px-14">
        <span className="aurora left-[-10%] top-[-30%] h-[360px] w-[360px] bg-brand-500/50" />
        <span className="aurora right-[-10%] bottom-[-40%] h-[360px] w-[360px] bg-violet-400/35" style={{ animationDelay: "-8s" }} />
        <div className="relative">
          <h2 className="font-display text-[34px] font-semibold leading-tight text-ink-50 sm:text-[46px]">Ready to name your price?</h2>
          <p className="mx-auto mt-4 max-w-xl text-[16px] text-ink-300">Raahi is launching on Android first. Grab the app, set your fare and let the drivers come to you.</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/download" className="inline-flex items-center gap-2 rounded-2xl bg-brand-500 px-6 py-3.5 text-[15px] font-semibold text-ink-950 shadow-glow transition-colors hover:bg-brand-400">
              <Smartphone size={18} /> Get Raahi for Android
            </Link>
            <Link href="/download#drivers" className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-6 py-3.5 text-[15px] font-semibold text-ink-100 transition-colors hover:bg-white/5">
              I want to drive
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
