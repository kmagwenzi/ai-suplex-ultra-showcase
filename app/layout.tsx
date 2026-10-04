import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI-Suplex Ultra — the harness that compounds",
  description: "Graph RAG + a self-scoring Gauntlet, streamed live. Deep Ultra 🦸",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
