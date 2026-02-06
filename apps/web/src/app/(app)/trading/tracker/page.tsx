import { TradeTrackerContent } from '@/components/trading/trade-tracker-content';
import { TradingHeader } from '@/components/trading/trading-header';
import { getSessionUser } from '@/lib/auth/auth-helpers';
import {
  getTradableCharacters,
  getUserCharacters,
} from '@/lib/character/character-selection';
import { buildPageMetadata } from '@/lib/seo/metadata';
import type { TimePeriod } from '@/lib/trading/trading-service';

export const metadata = buildPageMetadata({
  title: 'OSRS Trade Tracker',
  description: 'Track GE flips, inventory positions, and profit history.',
  canonicalPath: '/trading/tracker',
  noIndex: true,
});

const PERIODS: Record<TimePeriod, true> = {
  today: true,
  week: true,
  month: true,
  year: true,
  all: true,
};

type TradingSearchParams = {
  period?: string;
  page?: string;
  search?: string;
  addTrade?: string;
  scope?: string;
  tradeType?: string;
  characterId?: string;
};

type PageProps = {
  // Next.js may provide searchParams as either an object or a Promise depending on
  // route configuration and framework version. Handle both.
  searchParams?: TradingSearchParams | Promise<TradingSearchParams>;
};

async function resolveSearchParams(
  searchParams: PageProps['searchParams']
): Promise<TradingSearchParams> {
  if (!searchParams) return {};
  return Promise.resolve(searchParams);
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

function parsePeriod(value: string | undefined): TimePeriod {
  const v = value ?? '';
  return v in PERIODS ? (v as TimePeriod) : 'all';
}

function parseScope(value: string | undefined): 'character' | 'all' {
  return value === 'character' ? 'character' : 'all';
}

function parseTradeType(value: string | undefined): 'buy' | 'sell' | 'all' {
  return value === 'buy' || value === 'sell' ? value : 'all';
}

function parseOptionalInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default async function TradingTrackerPage({ searchParams }: PageProps) {
  const user = await getSessionUser();
  const params = await resolveSearchParams(searchParams);

  const trackerSearch = params.search ?? '';
  const trackerPage = parsePositiveInt(params.page, 1);
  const period = parsePeriod(params.period);
  const scope = parseScope(params.scope);
  const tradeType = parseTradeType(params.tradeType);
  const selectedCharacterId = params.characterId ?? null;
  const preselectedItemId = parseOptionalInt(params.addTrade);

  let character:
    | Awaited<ReturnType<typeof getTradableCharacters>>[number]
    | null = null;
  let characters: Awaited<ReturnType<typeof getTradableCharacters>> = [];
  let hasOnlyIronmanCharacters = false;

  if (user) {
    const allCharacters = await getUserCharacters(user.id);
    characters = await getTradableCharacters(user.id);
    hasOnlyIronmanCharacters =
      allCharacters.length > 0 && characters.length === 0;
    character =
      (selectedCharacterId
        ? characters.find((entry) => entry.id === selectedCharacterId)
        : null) ??
      characters[0] ??
      null;
  }

  return (
    <div className="trading-page ge-exchange-page">
      <TradingHeader activeTab="tracker" showLoginBadge={!user} />

      <section className="trade-tracker-section">
        {!user ? (
          <div className="login-prompt">
            <h2>Login Required</h2>
            <p>
              You need to be logged in to track your trades. Your trades are
              saved per character and are completely private.
            </p>
            <a className="button" href="/login?redirect=/trading/tracker">
              Login to Track Trades
            </a>
          </div>
        ) : !character ? (
          <div className="character-prompt">
            {hasOnlyIronmanCharacters ? (
              <>
                <h2>Trading Needs a Standard Character</h2>
                <p>
                  Your saved characters are all Ironman accounts, which cannot
                  trade on the Grand Exchange. Add or switch to a standard
                  character to track trades here.
                </p>
                <a
                  className="button"
                  href="/characters?redirect=/trading/tracker"
                >
                  Manage Characters
                </a>
              </>
            ) : (
              <>
                <h2>Select a Character</h2>
                <p>
                  You need to select an active character to track trades. Each
                  character has its own trade history.
                </p>
                <a
                  className="button"
                  href="/characters?redirect=/trading/tracker"
                >
                  Select Character
                </a>
              </>
            )}
          </div>
        ) : (
          <TradeTrackerContent
            characterId={character.id}
            characterName={character.displayName}
            characters={characters}
            page={trackerPage}
            period={period}
            scope={scope}
            search={trackerSearch}
            tradeType={tradeType}
            userId={user.id}
            {...(preselectedItemId !== undefined && { preselectedItemId })}
          />
        )}
      </section>
    </div>
  );
}
