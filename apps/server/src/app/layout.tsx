import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import "./globals.css";

const fredoka = Fredoka({ subsets: ["latin"], variable: "--font-fredoka", display: "swap" });
const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Raahi — Your ride. Your price.", template: "%s · Raahi" },
  description: "Fair-price ride hailing for Pakistan. Name your fare, drivers compete, 100% goes to the driver.",
  applicationName: "Raahi",
  icons: { icon: "/icon.svg" },
  openGraph: { title: "Raahi", description: "Your ride. Your price.", type: "website" },
};

export const viewport: Viewport = { themeColor: "#fffbf5", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fredoka.variable} ${nunito.variable}`}>
      <body className="min-h-screen bg-paper-50 font-sans text-ink-700">
        {/* Keep the legacy variable names resolvable for any inline style that still reads them. */}
        <style>{`:root{--font-display:var(--font-fredoka),Fredoka,Nunito,ui-rounded,system-ui,sans-serif;--font-sans:var(--font-nunito),Nunito,ui-rounded,system-ui,sans-serif}`}</style>
        {children}
      </body>
    </html>
  );
}
