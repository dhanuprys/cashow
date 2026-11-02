import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/ledger/sw-register";
import { ThemeScript } from "@/components/ledger/theme-script";
import { Toaster } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-sans" });

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://cashow.local"),
  title: {
    default: "Cashow · Ikuti Ke Mana Setiap Rupiah Mengalir",
    template: "%s · Cashow",
  },
  description:
    "Buku kas pribadi mandiri berpresisi integer. Kelola uang masuk, alokasi amplop terkunci, dan batas aman belanja tanpa pelacak komersial.",
  applicationName: "Cashow",
  manifest: "/manifest.webmanifest",
  formatDetection: { telephone: false },
  openGraph: {
    title: "Cashow · Ikuti Ke Mana Setiap Rupiah Mengalir",
    description:
      "Buku kas pribadi mandiri berpresisi integer. Kelola uang masuk, alokasi amplop terkunci, dan batas aman belanja tanpa pelacak komersial.",
    url: "/",
    siteName: "Cashow",
    locale: "id_ID",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cashow · Ikuti Ke Mana Setiap Rupiah Mengalir",
    description:
      "Buku kas pribadi mandiri berpresisi integer. Kelola uang masuk, alokasi amplop terkunci, dan batas aman belanja tanpa pelacak komersial.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      // `suppressHydrationWarning` is required because ThemeScript may add the
      // `dark` class before React hydrates.
      suppressHydrationWarning
      className={cn("h-full", "antialiased", geistMono.variable, "font-sans", geistSans.variable)}
    >
      <head>
        <ThemeScript />
        <link rel="icon" type="image/png" href="/favicon-96x96.png" sizes="96x96" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-title" content="Cashow" />
      </head>
      <body className="flex min-h-full flex-col">
        {children}
        <ServiceWorkerRegister />
        <Toaster />
      </body>
    </html>
  );
}
