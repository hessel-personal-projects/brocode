import type { Metadata } from "next";
import { IBM_Plex_Mono, Barlow_Condensed } from "next/font/google";
import { CRTOverlay } from "@/app/components/CRTOverlay";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["700"],
});

export const metadata: Metadata = {
  title: "Brocode",
  description: "Shared-key media unlock ceremony",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${ibmPlexMono.variable} ${barlowCondensed.variable} h-full antialiased`}>
      <body
        className="min-h-full flex flex-col"
        style={{
          background: "var(--color-bg)",
          color: "var(--color-phosphor)",
        }}
      >
        <CRTOverlay />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
