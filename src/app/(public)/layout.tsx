import { BodyTheme } from "@/components/shared/body-theme";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { getAuthSession } from "@/lib/auth/session";

export default async function PublicLayout({ children }: LayoutProps<"/">) {
  const session = await getAuthSession();
  return (
    <div className="theme-coinbase flex min-h-dvh flex-col bg-background text-foreground">
      <BodyTheme className="theme-coinbase" />
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-full focus:bg-background focus:px-4 focus:py-2">
        Skip to content
      </a>
      <SiteHeader signedIn={Boolean(session)} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
