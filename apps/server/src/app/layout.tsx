import type { Metadata, Viewport } from "next";
import { Manrope, Sora } from "next/font/google";
import "./globals.css";

const sora = Sora({ subsets: ["latin"], variable: "--font-sora", display: "swap" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Raahi — Your ride. Your price.", template: "%s · Raahi" },
  description: "Fair-price ride hailing for Pakistan. Name your fare, drivers compete, 100% goes to the driver.",
  applicationName: "Raahi",
  icons: { icon: "/icon.svg" },
  openGraph: { title: "Raahi", description: "Your ride. Your price.", type: "website" },
};

export const viewport: Viewport = { themeColor: "#0b0f1a", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sora.variable} ${manrope.variable}`}>
      <body style={{ fontFamily: "var(--font-manrope), Manrope, system-ui, sans-serif" }}>
        <style>{`:root{--font-display:var(--font-sora),Sora,system-ui,sans-serif;--font-sans:var(--font-manrope),Manrope,system-ui,sans-serif}`}</style>
        {children}
      </body>
    </html>
  );
}
