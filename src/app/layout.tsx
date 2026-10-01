import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from "next/font/google";
import { FiatCurrencyProvider } from "@/components/providers/fiat-currency-provider";
import { Toaster } from "@/components/ui/sonner";
import { getFiatDisplay } from "@/lib/fiat-display";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] });
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://lootbox-porscherolex88s-projects.vercel.app"),
  title: { default: "LootBox: Play, discover, collect", template: "%s | LootBox" },
  description:
    "LootBox is a rewards adventure. Open Mystery Boxes, explore the Mystery Map, unlock the Vault, complete collections and build your daily streak.",
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
    <html lang="en" className={`${jakarta.variable} ${bricolage.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <FiatCurrencyProvider currency={fiat}>{children}</FiatCurrencyProvider>
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
