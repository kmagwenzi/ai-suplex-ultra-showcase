import type { Metadata } from "next";
import { Inter, IBM_Plex_Serif, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter-face", display: "swap" });
const serif = IBM_Plex_Serif({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-serif-face",
  display: "swap",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono-face",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI-Suplex Ultra — the same question, answered twice",
  description:
    "AI-Suplex Ultra reads the records your vault already captures and reasons over them. Keyword retrieval scores A, graph retrieval scores B, both judged live by a deterministic rubric. Ships 28 November 2026, from $50.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${serif.variable} ${mono.variable}`}>
      <body className="font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
