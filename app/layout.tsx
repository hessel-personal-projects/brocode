import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { CRTOverlay } from "@/app/components/CRTOverlay";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
    <html lang="en" className={`${geistMono.variable} h-full antialiased`}>
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
