import Link from "next/link";
import type { ReactNode } from "react";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className="min-h-screen bg-ink-900 text-ink-100">
      <div className="mx-auto max-w-3xl px-6 py-14">
        <Link href="/" className="inline-flex items-center gap-2 text-brand-400 font-semibold text-sm">← Raahi</Link>
        <h1 className="font-display text-4xl font-semibold mt-6 text-ink-50">{title}</h1>
        <p className="text-ink-400 text-sm mt-2">Last updated {updated}</p>
        <article className="mt-10 space-y-6 leading-relaxed [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-ink-50 [&_h2]:mt-10 [&_p]:text-ink-300 [&_li]:text-ink-300 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2 [&_strong]:text-ink-100">
          {children}
        </article>
      </div>
    </main>
  );
}
