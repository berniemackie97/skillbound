import { formatNumber } from '@/lib/format/format-number';
import type { HomeCounts } from '../../lib/home/home-types';
import { ButtonLink } from '@/components/ui/button-link';

type Props = {
  counts: HomeCounts;
};

export function HomeHero({ counts }: Props) {
  return (
    <section className="hero">
      <div className="hero-copy">
        <div className="eyebrow">
          Your hub for everything Old School RuneScape
        </div>

        <h1>You could go to five or six sites, or just one!</h1>

        <p>
          Tired of having 3 spreadsheets and 20 wiki tabs open at all times? Do
          you have multiple copies of the same spreadsheet saved for your many
          alts? Skillbound brings all your favorite tools and guides into just 1
          website. Track progression for multiple characters, plan your next
          moves with action planners, and integrate with popular community
          guides. More features coming soon!
        </p>

        <div className="hero-actions">
          <ButtonLink href="/lookup">Look up a character</ButtonLink>
          <ButtonLink href="/progression" variant="ghost">
            View progression tracker
          </ButtonLink>
        </div>

        <div className="hero-meta">
          <div className="meta-card">
            <span>Content version</span>
            <strong>{counts.version}</strong>
          </div>
          <div className="meta-card">
            <span>Quests tracked</span>
            <strong>{formatNumber(counts.questCount)}</strong>
          </div>
          <div className="meta-card">
            <span>Diaries tracked</span>
            <strong>{formatNumber(counts.diaryCount)}</strong>
          </div>
        </div>
      </div>

      <div className="hero-panel">
        <div className="status-card">
          <div>
            <span className="label">Platform status</span>
            <h3>Operational</h3>
          </div>
          <span className="badge">Live</span>
        </div>

        <div className="stack-card">
          <h3>Getting started</h3>
          <ul>
            <li>Look up any character by username</li>
            <li>Track quests, diaries, and combat achievements</li>
            <li>Monitor GE prices and track your trades</li>
            <li>Follow community guides step-by-step</li>
          </ul>
        </div>

        <div className="stack-card accent">
          <h3>Powered by community data</h3>
          <ul>
            <li>OSRS Wiki Sync API integration</li>
            <li>Real-time Grand Exchange prices</li>
            <li>Hiscores data for all account types</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
