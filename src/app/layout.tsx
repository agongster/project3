import type { Metadata } from "next";
import { Nunito, Press_Start_2P } from "next/font/google";
import "./globals.css";

// Body text (and every number): Nunito. Its rounded ends suit the pixel art, but it is
// a real outline font with open letter shapes, so "c"/"o", "B"/"8", "5"/"S" and "E"/"C"
// stay distinct at 13–16 px on a normal-density screen, and its digits all share one
// width (counters do not jiggle). Loaded as a variable font: every weight is real.
const nunito = Nunito({ subsets: ["latin"], variable: "--font-body" });
// Display text: Press Start 2P, a pixel font drawn on an 8 px grid. Only for big
// words (16 px and up, see the type scale in globals.css), where it is both crisp and easy to read.
const pressStart = Press_Start_2P({ subsets: ["latin"], weight: "400", variable: "--font-title" });

export const metadata: Metadata = {
  title: "Lintlands — turn a GitHub repo into a pixel-art world",
  description: "Paste a Python repo. Explore it as a cozy pixel world, squash its bugs in dungeons, and collect treasure from clean code.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${pressStart.variable} ${nunito.variable} h-full`}>
      <body className="h-full">{children}</body>
    </html>
  );
}
