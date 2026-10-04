"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Wordmark } from "./Logo";

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#drivers", label: "For drivers" },
  { href: "#fare", label: "Fair fares" },
];

export function Nav() {
  return (
    <motion.header initial={{ y: -24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 30 }} className="fixed inset-x-0 top-0 z-50 px-4 pt-4">
      <nav className="glass mx-auto flex max-w-6xl items-center justify-between rounded-2xl px-4 py-2.5 shadow-float">
        <Link href="/" aria-label="Raahi home">
          <Wordmark size={30} />
        </Link>
        <div className="hidden items-center gap-7 text-[14px] font-semibold text-ink-300 md:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="transition-colors hover:text-ink-50">
              {l.label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin" className="hidden rounded-xl px-3 py-2 text-[13.5px] font-semibold text-ink-300 transition-colors hover:text-ink-50 sm:block">
            Admin
          </Link>
          <Link href="/download" className="rounded-xl bg-brand-500 px-4 py-2 text-[13.5px] font-semibold text-ink-950 shadow-glow transition-colors hover:bg-brand-400">
            Get the app
          </Link>
        </div>
      </nav>
    </motion.header>
  );
}
