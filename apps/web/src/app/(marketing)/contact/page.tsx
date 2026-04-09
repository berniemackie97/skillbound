import { ContactForm } from '@/components/contact/contact-form';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const metadata = buildPageMetadata({
  title: 'Contact & Feedback',
  description:
    'Send us feedback, suggestions, bug reports, or just say hello. We love hearing from the OSRS community.',
  canonicalPath: '/contact',
});

export default function ContactPage() {
  return (
    <div className="contact-page">
      <div className="contact-panel">
        <header className="contact-hero">
          <h1>Contact Us</h1>
          <p>
            Got feedback, suggestions, or found a bug? We&apos;d love to hear
            from you.
          </p>
        </header>
        <ContactForm />
      </div>
    </div>
  );
}
