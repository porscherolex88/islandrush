import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import { FiatCurrencyProvider } from "@/components/providers/fiat-currency-provider";
import { Toaster } from "@/components/ui/sonner";
import { getFiatDisplay } from "@/lib/fiat-display";
import "./globals.css";

const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://lootbox-smoky.vercel.app"),
  title: { default: "LootBox: Play, discover, collect", template: "%s | LootBox" },
  description:
    "Open Mystery Boxes, explore island maps, collect Loot and complete puzzles on a free daily adventure.",
  applicationName: "LootBox",
  icons: {
    icon: [{ url: "/brand/icon.svg", type: "image/svg+xml" }, { url: "/brand/icon.png", type: "image/png" }],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "LootBox: Play, discover, collect",
    description: "Open Mystery Boxes, collect Loot, explore the Mystery Map, and claim island prizes.",
    images: [{ url: "/brand/share-1200x628.png", width: 1200, height: 628, alt: "LootBox" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "LootBox: Play, discover, collect",
    description: "Open Mystery Boxes, collect Loot, explore the Mystery Map, and claim island prizes.",
    images: ["/brand/share-1200x628.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const fiat = await getFiatDisplay();
  return (
    <html lang="en" className={`${outfit.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <FiatCurrencyProvider currency={fiat}>{children}</FiatCurrencyProvider>
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
