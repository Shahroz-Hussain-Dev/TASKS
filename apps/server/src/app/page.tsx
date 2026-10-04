import { Footer } from "@/components/landing/Footer";
import { Nav } from "@/components/landing/Nav";
import { DownloadCta, DriverSection, FareSection, Hero, HowItWorks } from "@/components/landing/Sections";

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-ink-900 text-ink-100">
      <Nav />
      <Hero />
      <HowItWorks />
      <DriverSection />
      <FareSection />
      <DownloadCta />
      <Footer />
    </main>
  );
}
