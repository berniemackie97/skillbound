import Script from 'next/script';

const GA_ID = process.env['NEXT_PUBLIC_GOOGLE_ANALYTICS_ID'];
const IS_PRODUCTION = process.env['VERCEL_ENV'] === 'production';

export function GoogleAnalytics() {
  if (!GA_ID || !IS_PRODUCTION) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga-setup" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}', { anonymize_ip: true });`}
      </Script>
    </>
  );
}
