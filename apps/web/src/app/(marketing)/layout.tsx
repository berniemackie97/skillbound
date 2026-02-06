import { SiteNavMarketing } from '@/components/nav/site-nav-marketing';
import { SiteFooter } from '@/components/site/site-footer';

type MarketingLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function MarketingLayout({ children }: MarketingLayoutProps) {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <div className="shell">
        <SiteNavMarketing />

        <main className="page" id="main">
          {children}
        </main>

        <SiteFooter />
      </div>
    </>
  );
}
