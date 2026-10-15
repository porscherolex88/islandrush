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
