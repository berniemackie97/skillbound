import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  cleanWikitext,
  createMediaWikiClient,
  parseAllInfoboxes,
  parseDiaryAdditionalRequirements,
  parseDiaryPage,
  parseDiaryQuestRequirements,
  parseDiarySkillStats,
  parseDiaryTasks,
  parseInfobox,
  WikiMediaWikiClient,
} from './mediawiki';

const createJsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const buildRevisionPayload = (overrides?: {
  pageid?: number;
  title?: string;
  wikitext?: string;
  missing?: boolean;
  revisions?: Array<Record<string, unknown>>;
}) => ({
  query: {
    pages: {
      '1': {
        pageid: overrides?.pageid ?? 1,
        title: overrides?.title ?? 'Test Page',
        ...(overrides?.missing ? { missing: true } : {}),
        revisions: overrides?.revisions ?? [
          {
            revid: 10,
            slots: {
              main: {
                content: overrides?.wikitext ?? 'Sample content',
              },
            },
          },
        ],
      },
    },
  },
});

describe('MediaWiki parsing helpers', () => {
  it('cleans wiki markup from wikitext', () => {
    const input =
      'Some [[Link|Display]] and [[Plain]] <!--comment--> [https://example.com Text] <ref>ref</ref><ref name="x"/> <nowiki>no</nowiki><br>Line<br/>two <b>bold</b>';

    expect(cleanWikitext(input)).toBe(
      'Some Display and Plain Text no Line two bold'
    );
  });

  it('parses a single infobox and respects nested templates', () => {
    const wikitext =
      'Intro {{Infobox Item| name = Dragon scimitar | note = [[Link|Display]] | nested = {{Other|foo=bar}} }} outro';

    const infobox = parseInfobox(wikitext, 'Infobox Item');
    expect(infobox).toBeTruthy();
    expect(infobox?.params['name']).toBe('Dragon scimitar');
    expect(infobox?.params['note']).toBe('Display');
    expect(infobox?.params['nested']).toContain('{{Other');
  });

  it('returns null when an infobox is missing or unmatched', () => {
    expect(parseInfobox('No template', 'Infobox Item')).toBeNull();
    expect(parseInfobox('{{Infobox Item|name=Test', 'Infobox Item')).toBeNull();
  });

  it('parses all infobox templates in a page', () => {
    const wikitext =
      '{{Infobox Item|name=Item}}{{Infobox NPC|name=NPC}}{{Infobox Quest|name=Quest}}';

    const infoboxes = parseAllInfoboxes(wikitext);
    expect(infoboxes).toHaveLength(3);
    expect(infoboxes[0]?.templateName).toBe('Infobox Item');
  });

  it('parses diary skill stats into tiered requirements', () => {
    const wikitext =
      '{{DiarySkillStats|Agility|1=5|2=0|3=20|4=90}}{{DiarySkillStats|Fishing|1=1|4=70}}';

    const result = parseDiarySkillStats(wikitext);
    expect(result.easy).toEqual(
      expect.arrayContaining([{ skill: 'agility', level: 5 }])
    );
    expect(result.hard).toEqual(
      expect.arrayContaining([{ skill: 'agility', level: 20 }])
    );
    expect(result.elite).toEqual(
      expect.arrayContaining([{ skill: 'agility', level: 90 }])
    );
    expect(result.easy).toEqual(
      expect.arrayContaining([{ skill: 'fishing', level: 1 }])
    );
  });

  it('parses diary tasks from tables and fallbacks', () => {
    const tableText = `
{| class="wikitable"
|- data-diary-tier="easy"
| Catch a shrimp
| Needs [[Net]]
|-
| Cook a shrimp
|
|}
`;

    const result = parseDiaryTasks(tableText);
    expect(result.easy).toHaveLength(2);
    expect(result.easy[0]?.description).toContain('Catch a shrimp');

    const fallbackText = `
== Easy tasks ==
* Cook [[Shrimp]]
== Medium tasks ==
* Catch [[Trout]]
`;

    const fallback = parseDiaryTasks(fallbackText);
    expect(fallback.easy[0]?.description).toBe('Cook Shrimp');
    expect(fallback.medium[0]?.description).toBe('Catch Trout');
  });

  it('parses diary quest requirements and additional requirements', () => {
    const questText = `
== Easy ==
Quest requirements
| [[Cook's Assistant]]
| [[File:Quest-icon.png]]
| [[Ernest the Chicken|Ernest]]
|}
`;

    const additionalText = `
== Easy ==
Additional requirements
| [[Coins]] (10,000)
|}
`;

    const questReqs = parseDiaryQuestRequirements(questText);
    expect(questReqs.easy).toEqual(
      expect.arrayContaining(["Cook's Assistant", 'Ernest the Chicken'])
    );

    const additionalReqs = parseDiaryAdditionalRequirements(additionalText);
    expect(additionalReqs.easy).toEqual(
      expect.arrayContaining(['Coins (10,000)'])
    );
  });

  it('builds a complete diary page with optional sections', () => {
    const wikitext = `
{{DiarySkillStats|Agility|1=5}}
== Easy ==
Quest requirements
| [[Cook's Assistant]]
|}
`;

    const diary = parseDiaryPage(wikitext, 'Ardougne');
    expect(diary.name).toBe('Ardougne');
    expect(diary.questRequirements?.easy).toEqual(
      expect.arrayContaining(["Cook's Assistant"])
    );
    expect(diary.additionalRequirements).toBeUndefined();
  });
});

describe('WikiMediaWikiClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches and caches page content', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      createJsonResponse(buildRevisionPayload({ wikitext: 'Hello world' }))
    );

    const client = createMediaWikiClient('SkillboundTest');
    const first = await client.getPageContent('Test Page');
    const second = await client.getPageContent('Test Page');

    expect(first?.wikitext).toBe('Hello world');
    expect(second?.wikitext).toBe('Hello world');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns null for missing or empty pages', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(
        createJsonResponse(buildRevisionPayload({ missing: true }))
      )
      .mockResolvedValueOnce(
        createJsonResponse(buildRevisionPayload({ revisions: [] }))
      );

    const client = createMediaWikiClient('SkillboundTest');
    await expect(client.getPageContent('Missing Page')).resolves.toBeNull();
    await expect(client.getPageContent('Empty Page')).resolves.toBeNull();
  });

  it('fetches multiple pages in chunks', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(
        createJsonResponse(
          buildRevisionPayload({
            pageid: 1,
            title: 'Page 1',
            wikitext: 'Page 1 content',
          })
        )
      )
      .mockResolvedValueOnce(
        createJsonResponse(
          buildRevisionPayload({
            pageid: 2,
            title: 'Page 2',
            wikitext: 'Page 2 content',
          })
        )
      );

    const client = createMediaWikiClient('SkillboundTest');
    const titles = Array.from({ length: 51 }, (_, i) => `Page ${i + 1}`);
    const results = await client.getMultiplePages(titles);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(results.get('Page 1')?.wikitext).toBe('Page 1 content');
    expect(results.get('Page 2')?.wikitext).toBe('Page 2 content');
  });

  it('fetches category members with continuation', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(
        createJsonResponse({
          query: {
            categorymembers: [
              { pageid: 1, ns: 0, title: 'Page A' },
              { pageid: 2, ns: 0, title: 'Page B' },
            ],
          },
          continue: { cmcontinue: 'next' },
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          query: {
            categorymembers: [{ pageid: 3, ns: 0, title: 'Page C' }],
          },
        })
      );

    const client = createMediaWikiClient('SkillboundTest');
    const members = await client.getCategoryMembers('Category:Tests', {
      limit: 10,
    });

    expect(members).toHaveLength(3);
  });

  it('parses infoboxes from page helpers', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      createJsonResponse(
        buildRevisionPayload({
          wikitext: '{{Infobox Item|name=Item}}',
        })
      )
    );

    const client = createMediaWikiClient('SkillboundTest');
    const infoboxes = await client.getPageInfoboxes('Item');

    expect(infoboxes).toHaveLength(1);
    expect(infoboxes[0]?.templateName).toBe('Infobox Item');
  });

  it('tries multiple diary page name formats', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(
        createJsonResponse(buildRevisionPayload({ missing: true }))
      )
      .mockResolvedValueOnce(
        createJsonResponse(
          buildRevisionPayload({
            wikitext: '{{DiarySkillStats|Agility|1=5}}',
          })
        )
      );

    const client = createMediaWikiClient('SkillboundTest');
    const diary = await client.getDiary('Ardougne');

    expect(diary?.name).toBe('Ardougne');
  });

  it('collects all diaries using getAllDiaries', async () => {
    const client = new WikiMediaWikiClient({ userAgent: 'SkillboundTest' });
    const diary = {
      name: 'Ardougne',
      tasks: { easy: [], medium: [], hard: [], elite: [] },
      requirements: { easy: [], medium: [], hard: [], elite: [] },
    };

    vi.spyOn(client, 'getDiary').mockImplementation((region) =>
      Promise.resolve(region === 'Ardougne' ? diary : null)
    );

    const diaries = await client.getAllDiaries();
    expect(diaries).toEqual([diary]);
  });
});
