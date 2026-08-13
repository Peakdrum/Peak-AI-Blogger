import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { siteConfig, absUrl } from "@/lib/siteConfig";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

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
    <html lang={siteConfig.lang} className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased">
        <header className="border-b border-[var(--border)]">
          <div className="container-prose flex h-14 items-center justify-between">
            <Link href="/" className="text-base font-bold tracking-tight">
              {siteConfig.name}
            </Link>
            <nav className="flex items-center gap-5 text-sm">
              {siteConfig.nav.map((n) => (
                <Link key={n.href} href={n.href} className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200">
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="mt-16 border-t border-[var(--border)] py-8">
          <div className="container-prose flex flex-col items-start justify-between gap-2 text-sm text-gray-500 sm:flex-row sm:items-center">
            <p>
              © {new Date().getFullYear()} {siteConfig.name}. Built by {siteConfig.author.name}.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/rss.xml" className="hover:underline">RSS</Link>
              <Link href="/sitemap.xml" className="hover:underline">Sitemap</Link>
              {siteConfig.author.sameAs.map((u) => (
                <a key={u} href={u} className="hover:underline" rel="me nofollow">
                  {new URL(u).hostname.replace("www.", "")}
                </a>
              ))}
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
