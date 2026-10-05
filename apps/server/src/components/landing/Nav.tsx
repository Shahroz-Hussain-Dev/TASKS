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
      <nav className="glass mx-auto flex max-w-6xl items-center justify-between rounded-full py-2 pl-4 pr-2">
        <Link href="/" aria-label="Raahi home">
          <Wordmark size={32} />
        </Link>
        <div className="hidden items-center gap-7 text-[14.5px] font-bold text-ink-700 md:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="transition-colors hover:text-coral-600">
              {l.label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <Link href="/admin" className="hidden rounded-full px-3.5 py-2 text-[13.5px] font-bold text-ink-700 transition-colors hover:bg-paper-100 hover:text-ink-900 sm:block">
            Admin
          </Link>
          <Link href="/download" className="jelly jelly-coral inline-flex h-10 items-center rounded-full px-4 text-[13.5px] font-bold">
            Get the app
          </Link>
        </div>
      </nav>
    </motion.header>
  );
}
