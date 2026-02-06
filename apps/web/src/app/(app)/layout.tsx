import { SiteNavApp } from '@/components/nav/site-nav-app';
import { SiteFooter } from '@/components/site/site-footer';

type AppLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <div className="shell">
        <SiteNavApp />

        <main className="page" id="main">
          {children}
        </main>

        <SiteFooter />
      </div>
    </>
  );
}
