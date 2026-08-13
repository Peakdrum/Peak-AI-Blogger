import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { siteConfig, absUrl } from "@/lib/siteConfig";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  // Variable font — omit `weight`; Tailwind's font-semibold/bold utilities
  // drive the weight axis at runtime via CSS font-weight.
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} — Local AI & Automation Guides`,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  alternates: { canonical: absUrl("/") },
  openGraph: {
    type: "website",
    url: absUrl("/"),
    siteName: siteConfig.name,
    title: `${siteConfig.name} — Local AI & Automation Guides`,
    description: siteConfig.description,
    locale: siteConfig.locale,
  },
  twitter: { card: "summary_large_image", site: siteConfig.twitter },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={siteConfig.lang} className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable}`}>
      <body className="antialiased">
        <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
          <div className="container-prose flex h-16 items-baseline justify-between gap-4">
            <Link href="/" className="group flex flex-col leading-none">
              <span className="font-display text-xl font-semibold tracking-tight">
                {siteConfig.name}
              </span>
              <span className="mt-0.5 hidden text-[0.7rem] uppercase tracking-[0.18em] text-ink-soft sm:block">
                Local AI · Automation · Ollama · n8n
              </span>
            </Link>
            <nav className="flex items-center gap-5 text-sm font-medium">
              {siteConfig.nav.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="relative text-ink-soft transition-colors hover:text-foreground"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="mt-20 border-t border-border">
          <div className="container-prose flex flex-col gap-6 py-10 md:flex-row md:items-end md:justify-between">
            <div className="max-w-sm">
              <p className="font-display text-lg font-semibold">{siteConfig.name}</p>
              <p className="mt-1 text-sm text-ink-soft">{siteConfig.description}</p>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-soft">
              <Link href="/rss.xml" className="transition-colors hover:text-foreground">RSS</Link>
              <Link href="/sitemap.xml" className="transition-colors hover:text-foreground">Sitemap</Link>
              {siteConfig.author.sameAs.map((u) => (
                <a key={u} href={u} className="transition-colors hover:text-foreground" rel="me nofollow">
                  {new URL(u).hostname.replace("www.", "")}
                </a>
              ))}
            </div>
          </div>
          <div className="container-prose pb-8 text-xs text-ink-soft">
            © {new Date().getFullYear()} {siteConfig.name}. Built by {siteConfig.author.name}.
          </div>
        </footer>
      </body>
    </html>
  );
}
