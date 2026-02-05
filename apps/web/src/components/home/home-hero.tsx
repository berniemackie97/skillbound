import { ButtonLink } from '@/components/ui/button-link';
import { formatNumber } from '@/lib/format/format-number';

import type { HomeCounts } from '../../lib/home/home-types';

import { HOME_FEATURES } from './home-feature-grid';

type Props = {
  counts: HomeCounts;
};

export function HomeHero({ counts }: Props) {
  return (
    <section className="hero">
      <div className="hero-copy">
        <div className="eyebrow">
          Old School RuneScape toolkit
          <span className="hero-status">Live</span>
        </div>

        <h1>Track OSRS progress, prices, and guides in one place.</h1>

        <p>
          Skillbound keeps quests, diaries, combat goals, and GE tools together.
          Sync multiple characters, plan next steps, and trade smarter without
          spreadsheet chaos.
        </p>

        <div className="hero-actions">
          <ButtonLink className="hero-primary" href="/lookup">
            Look up a character
          </ButtonLink>
          <ButtonLink
            className="hero-secondary"
            href="/progression"
            variant="ghost"
          >
            Explore progression
          </ButtonLink>
        </div>

        <div className="hero-mobile-features">
          <div className="feature-grid hero-feature-grid">
            {HOME_FEATURES.map((feature) => (
              <article key={feature.title} className="feature-card">
                <h2>{feature.title}</h2>
                <p>{feature.description}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="hero-kpis">
          <div className="stat-chip">
            <span>Content version</span>
            <strong>{counts.version}</strong>
          </div>
          <div className="stat-chip">
            <span>Quests tracked</span>
            <strong>{formatNumber(counts.questCount)}</strong>
          </div>
          <div className="stat-chip">
            <span>Diaries tracked</span>
            <strong>{formatNumber(counts.diaryCount)}</strong>
          </div>
        </div>
      </div>

      <div className="hero-panel">
        <div className="stack-card compact">
          <h2>Getting started</h2>
          <ul>
            <li>Look up any character by username</li>
            <li>Track quests, diaries, and combat goals</li>
            <li>Monitor GE prices and your trades</li>
          </ul>
        </div>

        <div className="stack-card accent compact">
          <h2>Community powered</h2>
          <ul>
            <li>OSRS Wiki Sync integration</li>
            <li>RuneLite crowdsourced prices</li>
            <li>Hiscores data for all account types</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
