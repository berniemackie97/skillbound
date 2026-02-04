import { formatNumber } from '@/lib/format/format-number';
import type { HomeCard, HomeSectionModel } from '@/lib/home/home-types';
import { ButtonLink } from '@/components/ui/button-link';

type Props = HomeSectionModel;

function formatDescription(text: string): string {
  // If you ever embed large integers directly into text, this keeps them readable.
  // (Right now page.tsx interpolates, but this prevents future drift.)
  return text.replace(/\b(\d{1,3})(\d{3})+\b/g, (m) => formatNumber(Number(m)));
}

export function HomeSection({ title, description, cards }: Props) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
      </div>

      <div className="panel-grid">
        {cards.map((card) => (
          <SectionCard key={card.title} card={card} />
        ))}
      </div>
    </section>
  );
}

function SectionCard({ card }: { card: HomeCard }) {
  return (
    <div className="stack-card">
      <h3>{card.title}</h3>
      <p>{formatDescription(card.description)}</p>

      <ButtonLink href={card.cta.href} variant="ghost">
        {card.cta.label}
      </ButtonLink>
    </div>
  );
}
