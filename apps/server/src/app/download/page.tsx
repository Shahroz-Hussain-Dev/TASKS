import type { Metadata } from "next";
import { ArrowRight, Download, GitBranch, Package, ShieldCheck, Smartphone, Tag } from "lucide-react";
import Link from "next/link";
import { Footer } from "@/components/landing/Footer";
import { Nav } from "@/components/landing/Nav";

export const metadata: Metadata = {
  title: "Download",
  description: "Get the Raahi Android app — APK and AAB builds from the GitHub Actions Android workflow, and soon on Google Play.",
};

const STEPS = [
  {
    icon: GitBranch,
    title: "Built by the “Android” workflow",
    body: "Every push to the main branch runs the GitHub Actions workflow named Android. It typechecks the app, builds the web bundle, syncs Capacitor and compiles a signed APK and an AAB.",
  },
  {
    icon: Package,
    title: "Artifacts on every run",
    body: "Open the workflow run on GitHub and download the raahi-apk and raahi-aab artifacts from the Summary tab. Artifacts are kept for 30 days.",
  },
  {
    icon: Tag,
    title: "Releases on version tags",
    body: "Tagging a commit v1.2.0 (any v* tag) publishes a GitHub Release with the APK and AAB attached, plus release notes generated from the commits.",
  },
  {
    icon: ShieldCheck,
    title: "Google Play",
    body: "The AAB from each tagged release is what we upload to the Play Console. Once the listing is live, this page will link straight to the store.",
  },
];

export default function DownloadPage() {
  return (
    <main className="min-h-screen bg-ink-900 text-ink-100">
      <Nav />
      <section className="relative overflow-hidden px-4 pb-16 pt-32 sm:pt-40">
        <span className="aurora left-[-10%] top-[0%] h-[460px] w-[460px] bg-brand-500/40" />
        <span className="aurora right-[-10%] top-[30%] h-[400px] w-[400px] bg-violet-400/25" style={{ animationDelay: "-7s" }} />
        <div className="relative mx-auto max-w-3xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-3.5 py-1.5 text-[13px] font-semibold text-brand-300">
            <Smartphone size={14} /> Android · APK and AAB
          </p>
          <h1 className="mt-6 font-display text-[40px] font-semibold leading-tight text-ink-50 sm:text-[54px]">Get Raahi on Android</h1>
          <p className="mt-5 text-[17px] leading-relaxed text-ink-300">
            Raahi ships as a Capacitor app. The installable APK and the Play Store bundle (AAB) are produced automatically by our GitHub Actions pipeline — no hand-built binaries, every build traceable to a commit.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="https://github.com/Shahroz-Hussain-Dev/TASKS/releases/latest" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-2xl bg-brand-500 px-6 py-3.5 text-[15px] font-semibold text-ink-950 shadow-glow transition-colors hover:bg-brand-400">
              <Download size={18} /> Latest release on GitHub
            </a>
            <Link href="/admin" className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-6 py-3.5 text-[15px] font-semibold text-ink-100 transition-colors hover:bg-white/5">
              Open admin panel <ArrowRight size={16} />
            </Link>
          </div>
          <p className="mt-3 text-[13px] text-ink-500">Installing an APK requires allowing “Install unknown apps” for your browser on Android 8 or later.</p>
        </div>
      </section>

      <section className="px-4 pb-20">
        <div className="mx-auto grid max-w-3xl gap-4">
          {STEPS.map((s, i) => (
            <article key={s.title} className="flex gap-5 rounded-3xl border border-white/6 bg-ink-800 p-6 shadow-card">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-500/15 text-brand-400">
                <s.icon size={20} />
              </span>
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-500">Step {i + 1}</p>
                <h2 className="mt-0.5 font-display text-[19px] font-semibold text-ink-50">{s.title}</h2>
                <p className="mt-1.5 text-[15px] leading-relaxed text-ink-300">{s.body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="drivers" className="px-4 pb-24">
        <div className="mx-auto max-w-3xl rounded-3xl border border-amber-400/20 bg-amber-400/5 p-7">
          <h2 className="font-display text-[22px] font-semibold text-ink-50">Driving with Raahi?</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-300">
            The same app covers passengers and drivers. Install it, choose “I want to drive”, and complete the five-step onboarding: personal details, vehicle, documents, PKR 1,000 subscription, review. Most drivers are approved within a day.
          </p>
        </div>
      </section>
      <Footer />
    </main>
  );
}
