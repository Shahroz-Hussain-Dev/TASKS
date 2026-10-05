"use client";

import { ArrowRight, DeviceMobile, GasPump, Gauge, HandCoins, Money, ShieldCheck, Sparkle, UsersThree, Wallet, type Icon } from "@phosphor-icons/react";
import { motion, type Variants } from "framer-motion";
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

const JELLY = "inline-flex h-14 items-center gap-2 rounded-full px-7 text-[15px] font-bold";

/* ------------------------------------------------------------------ */

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-paper-50 px-4 pb-20 pt-32 sm:pt-40">
      <span className="blob left-[-8%] top-[6%] h-[520px] w-[520px] bg-coral-100" />
      <span className="blob right-[-6%] top-[18%] h-[460px] w-[460px] bg-sun-100" style={{ animationDelay: "-6s" }} />
      <span className="blob bottom-[-12%] left-[28%] h-[420px] w-[420px] bg-teal-100" style={{ animationDelay: "-12s" }} />
      <div className="relative mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2">
        <motion.div variants={stagger} initial="hidden" animate="show">
          <motion.p variants={up} className="inline-flex items-center gap-2 rounded-full bg-coral-100 px-3.5 py-1.5 text-[13px] font-bold text-coral-700">
            <Sparkle size={16} weight="duotone" /> Fair-price rides across Pakistan
          </motion.p>
          <motion.h1 variants={up} className="mt-6 font-display text-[46px] font-semibold leading-[1.02] tracking-tight text-ink-900 sm:text-[68px]">
            Your ride.
            <br />
            <span className="text-coral-500">Your price.</span>
          </motion.h1>
          <motion.p variants={up} className="mt-6 max-w-lg text-[17px] leading-relaxed text-ink-700">
            Name the fare you want to pay. Nearby drivers accept or counter in seconds, and you choose who takes you. No surge, no hidden commission — every rupee goes to the driver.
          </motion.p>
          <motion.div variants={up} className="mt-8 flex flex-wrap items-center gap-3">
            <span className="breathe inline-flex">
              <Link href="/download" className={`jelly jelly-coral ${JELLY}`}>
                <DeviceMobile size={20} weight="duotone" /> Download for Android
              </Link>
            </span>
            <a href="#how" className={`jelly jelly-cream ${JELLY}`}>
              See how it works <ArrowRight size={17} weight="bold" />
            </a>
          </motion.div>
          <motion.dl variants={up} className="mt-10 grid max-w-md grid-cols-3 gap-4">
            {[
              ["0%", "commission"],
              ["60 s", "to get offers"],
              ["5", "ride types"],
            ].map(([v, l]) => (
              <div key={l}>
                <dt className="font-display text-[28px] font-semibold tabular-nums text-ink-900">{v}</dt>
                <dd className="text-[13px] font-semibold text-ink-500">{l}</dd>
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

const STEPS: { icon: Icon; title: string; body: string; tint: string; tilt: number }[] = [
  { icon: HandCoins, title: "Name your fare", body: "Pick where you're going. Raahi suggests a fair price built from real fuel costs — adjust it up or down to suit you.", tint: "bg-coral-100 text-coral-600", tilt: -1.5 },
  { icon: UsersThree, title: "Drivers compete", body: "Every driver nearby sees your offer. They accept it or send a counter-offer with their car, rating and arrival time.", tint: "bg-teal-100 text-teal-600", tilt: 0 },
  { icon: Gauge, title: "Ride for less", body: "Choose the driver you like, track them live, pay cash at the end. Rate each other so the good ones rise.", tint: "bg-sun-100 text-sun-700", tilt: 1.2 },
];

export function HowItWorks() {
  return (
    <section id="how" className="bg-white px-4 py-20">
      <Reveal className="mx-auto max-w-6xl">
        <motion.p variants={up} className="text-[13px] font-extrabold uppercase tracking-[0.2em] text-coral-600">
          How it works
        </motion.p>
        <motion.h2 variants={up} className="mt-3 max-w-2xl font-display text-[34px] font-semibold leading-tight text-ink-900 sm:text-[44px]">
          Three taps between you and a fair ride.
        </motion.h2>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <motion.article key={s.title} variants={up} style={{ rotate: s.tilt }} whileHover={{ y: -4, rotate: 0 }} className="relative overflow-hidden rounded-3xl bg-paper-50 p-7 shadow-pillow ring-1 ring-paper-200">
              <span className="absolute right-5 top-3 font-display text-[72px] font-semibold leading-none text-paper-200">{i + 1}</span>
              <span className={`relative grid h-14 w-14 place-items-center rounded-full ${s.tint}`}>
                <s.icon size={28} weight="duotone" />
              </span>
              <h3 className="relative mt-6 font-display text-[22px] font-semibold text-ink-900">{s.title}</h3>
              <p className="relative mt-2 text-[15px] leading-relaxed text-ink-700">{s.body}</p>
            </motion.article>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

/* ------------------------------------------------------------------ */

export function DriverSection() {
  const perks: [Icon, string, string][] = [
    [Money, "Keep every rupee", "The passenger pays you directly in cash. Nothing is deducted, ever."],
    [Wallet, "PKR 1,000 / month", "Pay by JazzCash, EasyPaisa or bank transfer and upload the receipt. Active in minutes."],
    [ShieldCheck, "Verified in a day", "Upload your CNIC, license and vehicle papers once. Our AI checks them instantly and a human confirms."],
  ];
  return (
    <section id="drivers" className="relative overflow-hidden bg-teal-100/60 px-4 py-20">
      <span className="blob right-[-10%] top-[5%] h-[420px] w-[420px] bg-teal-100" style={{ animationDelay: "-3s" }} />
      <span className="blob left-[-8%] bottom-[-20%] h-[360px] w-[360px] bg-sky-100" style={{ animationDelay: "-10s" }} />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
        <Reveal variants={left}>
          <p className="text-[13px] font-extrabold uppercase tracking-[0.2em] text-teal-700">For drivers</p>
          <h2 className="mt-3 font-display text-[34px] font-semibold leading-tight text-ink-900 sm:text-[44px]">
            100% of the fare is yours. <span className="text-teal-600">Always.</span>
          </h2>
          <p className="mt-5 max-w-lg text-[16px] leading-relaxed text-ink-700">
            Raahi doesn&apos;t take a cut of your rides. Instead you pay one flat subscription of PKR 1,000 a month — whether you do ten trips or three hundred. See the fuel cost and your take-home before you accept any job.
          </p>
          <ul className="mt-8 space-y-4">
            {perks.map(([I, t, b]) => (
              <li key={t} className="flex gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-teal-600 shadow-pillow">
                  <I size={24} weight="duotone" />
                </span>
                <span>
                  <span className="block text-[16px] font-bold text-ink-900">{t}</span>
                  <span className="block text-[14.5px] text-ink-700">{b}</span>
                </span>
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal variants={right}>
          <div className="pillow p-7">
            <p className="text-[12.5px] font-extrabold uppercase tracking-wide text-ink-500">A typical month in Lahore</p>
            <div className="mt-5 space-y-3">
              {[
                ["Rides completed", "180"],
                ["Fares collected", "PKR 81,000"],
                ["Platform commission", "PKR 0"],
                ["Raahi subscription", "− PKR 1,000"],
              ].map(([l, v]) => (
                <div key={l} className="flex items-center justify-between border-b border-paper-200 pb-3 text-[15px]">
                  <span className="text-ink-700">{l}</span>
                  <span className={`font-display font-semibold tabular-nums ${v.startsWith("−") ? "text-rose-600" : "text-ink-900"}`}>{v}</span>
                </div>
              ))}
              <div className="sticker sticker-tilt-r mt-5 flex items-center justify-between bg-teal-100 px-5 py-4">
                <span className="text-[15px] font-bold text-ink-900">You keep</span>
                <span className="font-display text-[32px] font-semibold tabular-nums text-teal-700">PKR 80,000</span>
              </div>
            </div>
            <p className="mt-6 text-[12.5px] text-ink-500">Illustrative figures at PKR 450 average fare. On a 20% commission app the same month costs PKR 16,200.</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

export function FareSection() {
  return (
    <section id="fare" className="bg-paper-50 px-4 py-20">
      <Reveal className="mx-auto max-w-6xl">
        <motion.p variants={up} className="text-[13px] font-extrabold uppercase tracking-[0.2em] text-coral-600">
          Fare transparency
        </motion.p>
        <motion.h2 variants={up} className="mt-3 max-w-2xl font-display text-[34px] font-semibold leading-tight text-ink-900 sm:text-[44px]">
          No algorithm decides your price. Arithmetic does.
        </motion.h2>
        <motion.p variants={up} className="mt-4 max-w-2xl text-[16px] leading-relaxed text-ink-700">
          Every suggested fare starts from what the trip actually costs to drive, using the official OGRA petrol price and the fuel economy of the car you picked. The minimum guarantees the driver never loses money; everything above it is up to you and them.
        </motion.p>

        <motion.div variants={up} className="mt-10 overflow-hidden rounded-[32px] bg-sun-100 p-3 shadow-pillow">
          <div className="grid gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
            <Term icon={<Gauge size={22} weight="duotone" />} label="Distance" value="8.2 km" />
            <Op>÷</Op>
            <Term icon={<GasPump size={22} weight="duotone" />} label="Fuel economy" value="14 km / L" />
            <Op>×</Op>
            <Term icon={<Money size={22} weight="duotone" />} label="Petrol price" value="PKR 392.76 / L" />
            <Op>+</Op>
            <Term icon={<HandCoins size={22} weight="duotone" />} label="Driver floor" value="PKR 100" highlight />
          </div>
          <div className="mt-2 flex flex-col gap-4 rounded-3xl bg-white px-7 py-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[13px] font-semibold text-ink-500">Minimum fare for this trip</p>
              <p className="font-display text-[36px] font-semibold tabular-nums text-ink-900">PKR 330</p>
            </div>
            <div className="grid grid-cols-3 gap-6 text-[13.5px]">
              <div>
                <p className="text-ink-500">Fuel used</p>
                <p className="font-bold text-ink-900">0.59 L ≈ PKR 230</p>
              </div>
              <div>
                <p className="text-ink-500">Recommended</p>
                <p className="font-bold text-teal-700">PKR 410</p>
              </div>
              <div>
                <p className="text-ink-500">Ceiling</p>
                <p className="font-bold text-ink-900">PKR 660</p>
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
    <div className={`flex items-center gap-3 rounded-3xl px-5 py-5 ${highlight ? "sticker bg-sun-500 text-ink-900" : "bg-white text-ink-900"}`}>
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${highlight ? "bg-white/70 text-sun-700" : "bg-coral-100 text-coral-600"}`}>{icon}</span>
      <span>
        <span className={`block text-[12px] font-bold uppercase tracking-wide ${highlight ? "text-sun-700" : "text-ink-500"}`}>{label}</span>
        <span className="block font-display text-[18px] font-semibold tabular-nums">{value}</span>
      </span>
    </div>
  );
}

function Op({ children }: { children: ReactNode }) {
  return <div className="grid place-items-center px-2 py-1 font-display text-[28px] text-sun-700 md:px-1">{children}</div>;
}

/* ------------------------------------------------------------------ */

export function DownloadCta() {
  return (
    <section className="bg-white px-4 py-20">
      <Reveal variants={up} className="bg-sunrise relative mx-auto max-w-6xl overflow-hidden rounded-[40px] px-8 py-14 text-center shadow-float sm:px-14">
        <span className="blob left-[-10%] top-[-30%] h-[360px] w-[360px] bg-white/25" />
        <span className="blob right-[-10%] bottom-[-40%] h-[360px] w-[360px] bg-sun-100/40" style={{ animationDelay: "-8s" }} />
        <div className="relative">
          <h2 className="font-display text-[34px] font-semibold leading-tight text-white sm:text-[48px]">Ready to name your price?</h2>
          <p className="mx-auto mt-4 max-w-xl text-[16px] font-semibold text-white/90">Raahi is launching on Android first. Grab the app, set your fare and let the drivers come to you.</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/download" className={`jelly jelly-white ${JELLY}`}>
              <DeviceMobile size={20} weight="duotone" className="text-coral-500" /> Get Raahi for Android
            </Link>
            <Link href="/download#drivers" className={`jelly jelly-ink ${JELLY}`}>
              I want to drive
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
