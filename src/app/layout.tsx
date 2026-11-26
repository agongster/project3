import type { Metadata } from "next";
import { Pixelify_Sans, Press_Start_2P } from "next/font/google";
import "./globals.css";

// Two pixel fonts: a chunky one for titles and a readable one for body text.
const pressStart = Press_Start_2P({ subsets: ["latin"], weight: "400", variable: "--font-title" });
// Only the two lightest weights are loaded on purpose: at most sizes the heavier
// ones smear on a normal (non-Retina) screen until "c" reads as "o" and "2" as
// "8". "Bold" text therefore uses weight 500 (see `font-synthesis` in globals.css).
const pixelify = Pixelify_Sans({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "Lintlands — turn a GitHub repo into a pixel-art world",
  description: "Paste a Python repo. Explore it as a cozy pixel world, squash its bugs in dungeons, and collect treasure from clean code.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${pressStart.variable} ${pixelify.variable} h-full`}>
      <body className="h-full">{children}</body>
    </html>
  );
}
