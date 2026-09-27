import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";

import { runs } from "@/lib/runs";
import "./globals.css";

const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "relay", template: "%s · relay" },
  description:
    "A durable agent execution engine. Runs survive process death, hold for human approval, and replay deterministically from any point.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <body className="flex min-h-full flex-col font-sans antialiased">
        <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-5 sm:px-8">
            <Link href="/" className="text-sm font-semibold tracking-tight">
              relay
            </Link>
            <nav className="flex flex-1 items-center gap-4 text-sm">
              <Link
                href="/runs"
                className="text-muted-foreground hover:text-foreground"
              >
                Runs
              </Link>
            </nav>
            <span className="hidden font-mono text-xs text-muted-foreground sm:block">
              {runs.length} recorded runs
            </span>
            <a
              href="https://github.com/XIN2025/relay"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Source
            </a>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="mt-20 border-t border-border">
          <div className="mx-auto max-w-6xl px-5 py-8 text-sm text-muted-foreground sm:px-8">
            A durable execution engine for agent graphs. Every timeline on this
            site is a real journal from a real run, exported by{" "}
            <code className="font-mono">relay export</code>. Nothing here is
            mocked for the screenshot.
          </div>
        </footer>
      </body>
    </html>
  );
}
