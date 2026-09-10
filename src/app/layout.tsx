import type { Metadata } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Newsreader — editorial serif for headlines. Picked over Source Serif 4 and
// Fraunces for the long-form Atlantic-piece feel: high-contrast strokes, an
// italic that earns its keep on words like "fair". Body stays Geist Sans for
// readability. The "analyst, not judge" tone starts in the typography.
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "FightAutopsy — a map of the fight you keep having",
  description:
    "For the fight you've had forty times: each person writes their side separately, and FightAutopsy maps where you actually diverge. It never picks a winner.",
  keywords: ["FightAutopsy", "conflict", "relationships", "claim analysis"],
  authors: [{ name: "FightAutopsy" }],
  robots: { index: false, follow: false },
  openGraph: {
    title: "FightAutopsy",
    description:
      "A map of the fight you keep having. It never picks a winner.",
    siteName: "FightAutopsy",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FightAutopsy",
    description:
      "A map of the fight you keep having. It never picks a winner.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
