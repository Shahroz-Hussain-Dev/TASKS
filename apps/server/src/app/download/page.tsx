import type { Metadata } from "next";
import type { Icon } from "@phosphor-icons/react";
import { ArrowRight, DeviceMobile, DownloadSimple, GitBranch, Package, ShieldCheck, SteeringWheel, Tag } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Footer } from "@/components/landing/Footer";
import { Nav } from "@/components/landing/Nav";

export const metadata: Metadata = {
  title: "Download",
  description: "Get the Raahi Android app — APK and AAB builds from the GitHub Actions Android workflow, and soon on Google Play.",
};

const STEPS: { icon: Icon; title: string; body: string; tint: string }[] = [
  {
    icon: GitBranch,
    title: "Built by the “Android” workflow",
    body: "Every push to the main branch runs the GitHub Actions workflow named Android. It typechecks the app, builds the web bundle, syncs Capacitor and compiles a signed APK and an AAB.",
    tint: "bg-coral-100 text-coral-600",
  },
  {
    icon: Package,
    title: "Artifacts on every run",
    body: "Open the workflow run on GitHub and download the raahi-apk and raahi-aab artifacts from the Summary tab. Artifacts are kept for 30 days.",
    tint: "bg-sun-100 text-sun-700",
  },
  {
    icon: Tag,
    title: "Releases on version tags",
    body: "Tagging a commit v1.2.0 (any v* tag) publishes a GitHub Release with the APK and AAB attached, plus release notes generated from the commits.",
    tint: "bg-lavender-100 text-lavender-600",
  },
  {
    icon: ShieldCheck,
    title: "Google Play",
    body: "The AAB from each tagged release is what we upload to the Play Console. Once the listing is live, this page will link straight to the store.",
    tint: "bg-teal-100 text-teal-600",
  },
];

const JELLY = "inline-flex h-14 items-center gap-2 rounded-full px-7 text-[15px] font-bold";

export default function DownloadPage() {
  return (
    <main className="min-h-screen bg-paper-50 text-ink-700">
      <Nav />
      <section className="relative overflow-hidden px-4 pb-16 pt-32 sm:pt-40">
        <span className="blob left-[-10%] top-[0%] h-[460px] w-[460px] bg-coral-100" />
        <span className="blob right-[-10%] top-[30%] h-[400px] w-[400px] bg-teal-100" style={{ animationDelay: "-7s" }} />
        <div className="relative mx-auto max-w-3xl">
          <p className="inline-flex items-center gap-2 rounded-full bg-coral-100 px-3.5 py-1.5 text-[13px] font-bold text-coral-700">
            <DeviceMobile size={16} weight="duotone" /> Android · APK and AAB
          </p>
          <h1 className="mt-6 font-display text-[42px] font-semibold leading-tight text-ink-900 sm:text-[56px]">Get Raahi on Android</h1>
          <p className="mt-5 text-[17px] leading-relaxed text-ink-700">
            Raahi ships as a Capacitor app. The installable APK and the Play Store bundle (AAB) are produced automatically by our GitHub Actions pipeline — no hand-built binaries, every build traceable to a commit.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="https://github.com/Shahroz-Hussain-Dev/TASKS/releases/latest" target="_blank" rel="noreferrer" className={`jelly jelly-coral ${JELLY}`}>
              <DownloadSimple size={20} weight="bold" /> Latest release on GitHub
            </a>
            <Link href="/admin" className={`jelly jelly-cream ${JELLY}`}>
              Open admin panel <ArrowRight size={17} weight="bold" />
            </Link>
          </div>
          <p className="mt-4 text-[13px] text-ink-500">Installing an APK requires allowing “Install unknown apps” for your browser on Android 8 or later.</p>
        </div>
      </section>

      <section className="bg-white px-4 py-16">
        <div className="mx-auto grid max-w-3xl gap-4">
          {STEPS.map((s, i) => (
            <article key={s.title} className="flex gap-5 rounded-3xl bg-paper-50 p-6 shadow-pillow ring-1 ring-paper-200">
              <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${s.tint}`}>
                <s.icon size={24} weight="duotone" />
              </span>
              <div>
                <p className="text-[12px] font-extrabold uppercase tracking-wide text-ink-500">Step {i + 1}</p>
                <h2 className="mt-0.5 font-display text-[20px] font-semibold text-ink-900">{s.title}</h2>
                <p className="mt-1.5 text-[15px] leading-relaxed text-ink-700">{s.body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="drivers" className="bg-paper-50 px-4 py-16">
        <div className="mx-auto flex max-w-3xl flex-col gap-5 rounded-[32px] bg-teal-100 p-7 sm:flex-row sm:items-start">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white text-teal-600 shadow-pillow">
            <SteeringWheel size={30} weight="duotone" />
          </span>
          <div>
            <h2 className="font-display text-[24px] font-semibold text-ink-900">Driving with Raahi?</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-700">
              The same app covers passengers and drivers. Install it, choose “I want to drive”, and complete the five-step onboarding: personal details, vehicle, documents, PKR 1,000 subscription, review. Most drivers are approved within a day.
            </p>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
