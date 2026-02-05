import { MemoryCache, type CacheAdapter } from '@skillbound/cache';
import pRetry from 'p-retry';
import { z } from 'zod';

/**
 * OSRS Wiki MediaWiki API Client
 * Documentation: https://oldschool.runescape.wiki/api.php
 *
 * Provides access to raw wiki content and page metadata
 * for extracting structured data from infobox templates.
 */

export interface MediaWikiClientConfig {
  userAgent: string;
  retries?: number;
  timeoutMs?: number;
  cache?: CacheAdapter<unknown> | null;
  cacheTtlMs?: number;
}

/**
 * Page revision content from the wiki
 */
export interface WikiPage {
  pageid: number;
  title: string;
  wikitext: string;
  revid?: number | undefined;
}

/**
 * Parsed infobox key-value pairs
 */
export interface InfoboxData {
  templateName: string;
  params: Record<string, string>;
}

/**
 * Page summary from OpenSearch API
 */
export interface WikiPageSummary {
  title: string;
  description: string;
  url: string;
}

/**
 * Category member from the wiki
 */
export interface CategoryMember {
  pageid: number;
  title: string;
  ns: number;
}

const QueryRevisionSchema = z.object({
  query: z
    .object({
      pages: z.record(
        z.string(),
        z.object({
          pageid: z.number().optional(),
          title: z.string(),
          missing: z.boolean().optional(),
          revisions: z
            .array(
              z.object({
                revid: z.number().optional(),
                slots: z
                  .object({
                    main: z.object({
                      content: z.string().optional(),
                      '*': z.string().optional(),
                    }),
                  })
                  .optional(),
                '*': z.string().optional(),
              })
            )
            .optional(),
        })
      ),
    })
    .optional(),
  error: z
    .object({
      code: z.string(),
      info: z.string(),
    })
    .optional(),
});

// Reserved for future parse action support
// const ParseSchema = z.object({
//   parse: z.object({
//     title: z.string(),
//     pageid: z.number(),
//     wikitext: z.object({ '*': z.string() }).optional(),
//     text: z.object({ '*': z.string() }).optional(),
//   }).optional(),
//   error: z.object({ code: z.string(), info: z.string() }).optional(),
// });

const CategoryMembersSchema = z.object({
  query: z
    .object({
      categorymembers: z.array(
        z.object({
          pageid: z.number(),
          ns: z.number(),
          title: z.string(),
        })
      ),
    })
    .optional(),
  continue: z
    .object({
      cmcontinue: z.string().optional(),
    })
    .optional(),
  error: z
    .object({
      code: z.string(),
      info: z.string(),
    })
    .optional(),
});

/**
 * Parse a single infobox template from wikitext
 */
export function parseInfobox(
  wikitext: string,
  templateName: string,
  options?: { clean?: boolean }
): InfoboxData | null {
  // Find the template start
  const templatePattern = new RegExp(
    `\\{\\{\\s*${escapeRegex(templateName)}\\s*`,
    'i'
  );
  const match = wikitext.match(templatePattern);

  if (!match || match.index === undefined) {
    return null;
  }

  // Find matching closing braces by counting depth
  let depth = 0;
  let startIndex = match.index;
  let endIndex = startIndex;
  let foundStart = false;

  for (let i = startIndex; i < wikitext.length - 1; i++) {
    const twoChars = wikitext.slice(i, i + 2);
    if (twoChars === '{{') {
      if (!foundStart) {
        foundStart = true;
        startIndex = i;
      }
      depth++;
      i++; // Skip next char
    } else if (twoChars === '}}') {
      depth--;
      if (depth === 0) {
        endIndex = i + 2;
        break;
      }
      i++; // Skip next char
    }
  }

  if (depth !== 0) {
    return null;
  }

  const templateContent = wikitext.slice(startIndex + 2, endIndex - 2);

  // Extract parameters
  const params: Record<string, string> = {};

  // Split by | but respect nested templates and links
  const paramParts = splitTemplateParams(templateContent);

  const shouldClean = options?.clean !== false;

  for (const part of paramParts.slice(1)) {
    // Skip template name
    const equalsIndex = part.indexOf('=');
    if (equalsIndex === -1) continue;

    const key = part.slice(0, equalsIndex).trim().toLowerCase();
    const value = part.slice(equalsIndex + 1).trim();

    if (key) {
      params[key] = shouldClean ? cleanWikitext(value) : value;
    }
  }

  return {
    templateName,
    params,
  };
}

/**
 * Parse all infoboxes from wikitext
 */
export function parseAllInfoboxes(wikitext: string): InfoboxData[] {
  const results: InfoboxData[] = [];
  const infoboxPattern = /\{\{\s*Infobox\s+(\w+)/gi;
  let match;

  while ((match = infoboxPattern.exec(wikitext)) !== null) {
    const templateName = `Infobox ${match[1]}`;
    const infobox = parseInfobox(wikitext, templateName);
    if (infobox) {
      results.push(infobox);
    }
  }

  return results;
}

/**
 * Split template parameters respecting nested braces
 */
function splitTemplateParams(content: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  let linkDepth = 0;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const twoChars = content.slice(i, i + 2);

    if (twoChars === '{{') {
      depth++;
      current += '{{';
      i++;
    } else if (twoChars === '}}') {
      depth--;
      current += '}}';
      i++;
    } else if (twoChars === '[[') {
      linkDepth++;
      current += '[[';
      i++;
    } else if (twoChars === ']]') {
      linkDepth--;
      current += ']]';
      i++;
    } else if (char === '|' && depth === 0 && linkDepth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  if (current) {
    parts.push(current);
  }

  return parts;
}

/**
 * Clean wikitext markup from a value
 */
export function cleanWikitext(text: string): string {
  let result = text;

  // Remove HTML comments
  result = result.replace(/<!--[\s\S]*?-->/g, '');

  // Convert [[Link|Display]] to Display, [[Link]] to Link
  result = result.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2');
  result = result.replace(/\[\[([^\]]+)\]\]/g, '$1');

  // Remove external links [url text]
  result = result.replace(/\[https?:\/\/[^\s\]]+\s*([^\]]*)\]/g, '$1');

  // Remove ref tags
  result = result.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '');
  result = result.replace(/<ref[^>]*\/>/gi, '');

  // Remove nowiki tags but keep content
  result = result.replace(/<\/?nowiki>/gi, '');

  // Remove br tags
  result = result.replace(/<br\s*\/?>/gi, '\n');

  // Remove other HTML tags
  result = result.replace(/<[^>]+>/g, '');

  // Clean up whitespace
  result = result.replace(/\s+/g, ' ').trim();

  return result;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * MediaWiki API client for OSRS Wiki
 */
export class WikiMediaWikiClient {
  private readonly baseUrl = 'https://oldschool.runescape.wiki/api.php';
  private readonly userAgent: string;
  private readonly retries: number;
  private readonly timeoutMs: number;
  private readonly cache: CacheAdapter<unknown> | null;
  private readonly cacheTtlMs: number;

  constructor(config: MediaWikiClientConfig) {
    this.userAgent = config.userAgent;
    this.retries = config.retries ?? 3;
    this.timeoutMs = config.timeoutMs ?? 15000;
    this.cache = config.cache ?? new MemoryCache<unknown>();
    this.cacheTtlMs = config.cacheTtlMs ?? 10 * 60 * 1000;
  }

  /**
   * Fetch raw wikitext for a page
   */
  async getPageContent(title: string): Promise<WikiPage | null> {
    const cacheKey = `mediawiki:page:${title}`;

    if (this.cache) {
      const cached = (await this.cache.get(cacheKey)) as WikiPage | undefined;
      if (cached) {
        return cached;
      }
    }

    const params = new URLSearchParams({
      action: 'query',
      titles: title,
      prop: 'revisions',
      rvprop: 'content|ids',
      rvslots: 'main',
      format: 'json',
    });

    const result = await this.fetchApi<z.infer<typeof QueryRevisionSchema>>(
      params,
      QueryRevisionSchema
    );

    if (!result.query?.pages) {
      return null;
    }

    const pages = Object.values(result.query.pages);
    const page = pages[0];

    if (!page || page.missing || !page.revisions?.length) {
      return null;
    }

    const revision = page.revisions[0];
    const content =
      revision?.slots?.main?.content ??
      revision?.slots?.main?.['*'] ??
      revision?.['*'];

    if (!content || !page.pageid) {
      return null;
    }

    const wikiPage: WikiPage = {
      pageid: page.pageid,
      title: page.title,
      wikitext: content,
      revid: revision?.revid,
    };

    if (this.cache) {
      await this.cache.set(cacheKey, wikiPage, this.cacheTtlMs);
    }

    return wikiPage;
  }

  /**
   * Fetch multiple pages in a single request (max 50)
   */
  async getMultiplePages(titles: string[]): Promise<Map<string, WikiPage>> {
    const results = new Map<string, WikiPage>();

    // API limit is 50 titles per request
    const chunks = chunkArray(titles, 50);

    for (const chunk of chunks) {
      const params = new URLSearchParams({
        action: 'query',
        titles: chunk.join('|'),
        prop: 'revisions',
        rvprop: 'content|ids',
        rvslots: 'main',
        format: 'json',
      });

      const result = await this.fetchApi<z.infer<typeof QueryRevisionSchema>>(
        params,
        QueryRevisionSchema
      );

      if (!result.query?.pages) continue;

      for (const page of Object.values(result.query.pages)) {
        if (page.missing || !page.revisions?.length || !page.pageid) continue;

        const revision = page.revisions[0];
        const content =
          revision?.slots?.main?.content ??
          revision?.slots?.main?.['*'] ??
          revision?.['*'];

        if (content) {
          results.set(page.title, {
            pageid: page.pageid,
            title: page.title,
            wikitext: content,
            revid: revision?.revid,
          });
        }
      }
    }

    return results;
  }

  /**
   * Get pages in a category with pagination
   */
  async getCategoryMembers(
    category: string,
    options?: {
      limit?: number;
      namespace?: number;
    }
  ): Promise<CategoryMember[]> {
    const results: CategoryMember[] = [];
    const limit = options?.limit ?? 500;
    let continueToken: string | undefined;

    // Normalize category name
    const categoryTitle = category.startsWith('Category:')
      ? category
      : `Category:${category}`;

    do {
      const params = new URLSearchParams({
        action: 'query',
        list: 'categorymembers',
        cmtitle: categoryTitle,
        cmlimit: String(Math.min(limit - results.length, 500)),
        format: 'json',
      });

      if (options?.namespace !== undefined) {
        params.set('cmnamespace', String(options.namespace));
      }

      if (continueToken) {
        params.set('cmcontinue', continueToken);
      }

      const result = await this.fetchApi<z.infer<typeof CategoryMembersSchema>>(
        params,
        CategoryMembersSchema
      );

      if (result.query?.categorymembers) {
        results.push(...result.query.categorymembers);
      }

      continueToken = result.continue?.cmcontinue;
    } while (continueToken && results.length < limit);

    return results;
  }

  /**
   * Parse a page and extract infoboxes
   */
  async getPageInfoboxes(title: string): Promise<InfoboxData[]> {
    const page = await this.getPageContent(title);
    if (!page) {
      return [];
    }

    return parseAllInfoboxes(page.wikitext);
  }

  /**
   * Get a specific infobox from a page
   */
  async getPageInfobox(
    title: string,
    templateName: string
  ): Promise<InfoboxData | null> {
    const page = await this.getPageContent(title);
    if (!page) {
      return null;
    }

    return parseInfobox(page.wikitext, templateName);
  }

  /**
   * Get diary data for a region
   */
  async getDiary(regionName: string): Promise<DiaryRegion | null> {
    // Try different page name formats
    const pageNames = [
      `${regionName}_Diary`,
      `${regionName} Diary`,
      `${regionName}_diary`,
    ];

    for (const pageName of pageNames) {
      const page = await this.getPageContent(pageName);
      if (page) {
        return parseDiaryPage(page.wikitext, regionName);
      }
    }

    return null;
  }

  /**
   * Get all achievement diaries
   */
  async getAllDiaries(): Promise<DiaryRegion[]> {
    const diaryRegions = [
      'Ardougne',
      'Desert',
      'Falador',
      'Fremennik',
      'Kandarin',
      'Karamja',
      'Kourend_&_Kebos',
      'Lumbridge_&_Draynor',
      'Morytania',
      'Varrock',
      'Western_Provinces',
      'Wilderness',
    ];

    const diaries: DiaryRegion[] = [];

    for (const region of diaryRegions) {
      const diary = await this.getDiary(region);
      if (diary) {
        diaries.push(diary);
      }
    }

    return diaries;
  }

  private async fetchApi<T>(
    params: URLSearchParams,
    schema: z.ZodType<T>
  ): Promise<T> {
    const url = `${this.baseUrl}?${params.toString()}`;

    return pRetry(
      async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': this.userAgent,
            Accept: 'application/json',
          },
        }).finally(() => clearTimeout(timeoutId));

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const json = await response.json();
        return schema.parse(json);
      },
      {
        retries: this.retries,
        onFailedAttempt: ({ error, attemptNumber }) => {
          console.warn(
            `MediaWiki API attempt ${attemptNumber} failed:`,
            error.message
          );
        },
      }
    );
  }
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Diary tier data
 */
export type DiaryTier = 'easy' | 'medium' | 'hard' | 'elite';

/**
 * Skill requirement with level
 */
export interface SkillRequirement {
  skill: string;
  level: number;
  boostable?: boolean | undefined;
}

/**
 * Diary task from wiki
 */
export interface DiaryTask {
  description: string;
  tier: DiaryTier;
  requirements?: string | undefined;
}

/**
 * Diary region data parsed from wiki
 */
export interface DiaryRegion {
  name: string;
  tasks: Record<DiaryTier, DiaryTask[]>;
  requirements: Record<DiaryTier, SkillRequirement[]>;
  questRequirements?: Record<DiaryTier, string[]> | undefined;
  additionalRequirements?: Record<DiaryTier, string[]> | undefined;
}

/**
 * Parse diary skill requirements from DiarySkillStats template
 * Example: {{DiarySkillStats|Agility|1=0|2=0|3=0|4=0}}
 */
export function parseDiarySkillStats(
  wikitext: string
): Record<DiaryTier, SkillRequirement[]> {
  const result: Record<DiaryTier, SkillRequirement[]> = {
    easy: [],
    medium: [],
    hard: [],
    elite: [],
  };

  // Match DiarySkillStats templates
  const templatePattern = /\{\{DiarySkillStats\|([^|}]+)(?:\|([^}]+))?\}\}/gi;
  let match;

  while ((match = templatePattern.exec(wikitext)) !== null) {
    const skill = match[1]?.trim();
    const params = match[2] || '';

    if (!skill) continue;

    // Parse tier levels (1=easy, 2=medium, 3=hard, 4=elite)
    const tierMap: Record<string, DiaryTier> = {
      '1': 'easy',
      '2': 'medium',
      '3': 'hard',
      '4': 'elite',
    };

    const levelPattern = /(\d)=(\d+)/g;
    let levelMatch;

    while ((levelMatch = levelPattern.exec(params)) !== null) {
      const tierNum = levelMatch[1];
      const level = parseInt(levelMatch[2] || '0', 10);

      if (tierNum && tierMap[tierNum] && level > 0) {
        const tier = tierMap[tierNum];
        result[tier].push({
          skill: skill.toLowerCase(),
          level,
        });
      }
    }
  }

  return result;
}

/**
 * Parse diary tasks from wiki table markup
 */
export function parseDiaryTasks(
  wikitext: string
): Record<DiaryTier, DiaryTask[]> {
  const result: Record<DiaryTier, DiaryTask[]> = {
    easy: [],
    medium: [],
    hard: [],
    elite: [],
  };

  const lines = wikitext.split('\n');
  let currentTier: DiaryTier | null = null;
  let inTable = false;
  let currentCellIndex = -1;
  let rowCells: string[] = [];

  const flushRow = () => {
    if (!currentTier) return;
    if (rowCells.length < 2) {
      rowCells = [];
      currentCellIndex = -1;
      return;
    }

    const rawDescription = rowCells[0]?.trim();
    if (!rawDescription) {
      rowCells = [];
      currentCellIndex = -1;
      return;
    }

    const description = cleanWikitext(rawDescription)
      .replace(/^\d+\.\s*/, '')
      .trim();
    const requirementsRaw = rowCells[1]?.trim();

    if (description) {
      result[currentTier].push({
        description,
        tier: currentTier,
        ...(requirementsRaw ? { requirements: requirementsRaw } : {}),
      });
    }

    rowCells = [];
    currentCellIndex = -1;
  };

  for (const line of lines) {
    const tierMatch = line.match(/data-diary-tier="(easy|medium|hard|elite)"/i);
    if (tierMatch) {
      flushRow();
      currentTier = tierMatch[1]?.toLowerCase() as DiaryTier;
      inTable = true;
      continue;
    }

    if (!inTable) {
      continue;
    }

    if (line.startsWith('|}')) {
      flushRow();
      inTable = false;
      currentTier = null;
      continue;
    }

    if (line.startsWith('|-')) {
      flushRow();
      continue;
    }

    if (line.startsWith('!')) {
      continue;
    }

    if (line.startsWith('|')) {
      currentCellIndex += 1;
      rowCells[currentCellIndex] = line.slice(1).trim();
      continue;
    }

    if (currentCellIndex >= 0) {
      rowCells[currentCellIndex] = `${rowCells[currentCellIndex]}\n${line}`;
    }
  }

  flushRow();

  // Fallback: Look for table rows under tier headers
  if (
    result.easy.length === 0 &&
    result.medium.length === 0 &&
    result.hard.length === 0 &&
    result.elite.length === 0
  ) {
    const tiers: DiaryTier[] = ['easy', 'medium', 'hard', 'elite'];

    for (const tier of tiers) {
      // Look for section headers like == Easy tasks == or === Easy ===
      const headerPattern = new RegExp(
        `={2,3}\\s*${tier}(?:\\s+tasks)?\\s*={2,3}([\\s\\S]*?)(?:={2,3}|$)`,
        'i'
      );
      const sectionMatch = wikitext.match(headerPattern);

      if (sectionMatch?.[1]) {
        const section = sectionMatch[1];

        // Parse bullet points or table rows
        const taskPattern = /^\*\s*(.+)$/gm;
        let taskMatch;

        while ((taskMatch = taskPattern.exec(section)) !== null) {
          const description = cleanWikitext(taskMatch[1] || '').trim();
          if (description) {
            result[tier].push({ description, tier });
          }
        }
      }
    }
  }

  return result;
}

/**
 * Parse quest requirements for diary tiers
 */
export function parseDiaryQuestRequirements(
  wikitext: string
): Record<DiaryTier, string[]> {
  const result: Record<DiaryTier, string[]> = {
    easy: [],
    medium: [],
    hard: [],
    elite: [],
  };

  const lines = wikitext.split('\n');
  let currentTier: DiaryTier | null = null;
  let inQuestTable = false;

  const tierHeaderPattern = /^\s*(easy|medium|hard|elite)\s*=/i;
  const sectionHeaderPattern = /^==+\s*(easy|medium|hard|elite)\s*==+/i;

  for (const line of lines) {
    const tierHeader = line.match(tierHeaderPattern);
    const sectionHeader = line.match(sectionHeaderPattern);
    if (tierHeader || sectionHeader) {
      currentTier = (
        tierHeader?.[1] ?? sectionHeader?.[1]
      )?.toLowerCase() as DiaryTier;
      inQuestTable = false;
      continue;
    }

    if (!currentTier) {
      continue;
    }

    if (line.toLowerCase().includes('quest requirements')) {
      inQuestTable = true;
      continue;
    }

    if (inQuestTable && line.startsWith('|}')) {
      inQuestTable = false;
      continue;
    }

    if (inQuestTable && line.startsWith('|')) {
      const questPattern = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g;
      let questMatch;

      while ((questMatch = questPattern.exec(line)) !== null) {
        const questName = questMatch[1]?.trim();
        if (!questName) continue;
        if (questName.toLowerCase().startsWith('file:')) continue;
        result[currentTier].push(questName);
      }
    }
  }

  return result;
}

/**
 * Parse additional requirements for diary tiers
 */
export function parseDiaryAdditionalRequirements(
  wikitext: string
): Record<DiaryTier, string[]> {
  const result: Record<DiaryTier, string[]> = {
    easy: [],
    medium: [],
    hard: [],
    elite: [],
  };

  const lines = wikitext.split('\n');
  let currentTier: DiaryTier | null = null;
  let inAdditionalTable = false;

  const tierHeaderPattern = /^\s*(easy|medium|hard|elite)\s*=/i;
  const sectionHeaderPattern = /^==+\s*(easy|medium|hard|elite)\s*==+/i;

  for (const line of lines) {
    const tierHeader = line.match(tierHeaderPattern);
    const sectionHeader = line.match(sectionHeaderPattern);
    if (tierHeader || sectionHeader) {
      currentTier = (
        tierHeader?.[1] ?? sectionHeader?.[1]
      )?.toLowerCase() as DiaryTier;
      inAdditionalTable = false;
      continue;
    }

    if (!currentTier) {
      continue;
    }

    if (line.toLowerCase().includes('additional requirements')) {
      inAdditionalTable = true;
      continue;
    }

    if (inAdditionalTable && line.startsWith('|}')) {
      inAdditionalTable = false;
      continue;
    }

    if (inAdditionalTable && line.startsWith('|')) {
      const cleaned = cleanWikitext(line.slice(1).trim());
      if (!cleaned) continue;
      result[currentTier].push(cleaned);
    }
  }

  return result;
}

/**
 * Parse a complete diary page and extract all data
 */
export function parseDiaryPage(
  wikitext: string,
  regionName: string
): DiaryRegion {
  const tasks = parseDiaryTasks(wikitext);
  const requirements = parseDiarySkillStats(wikitext);
  const questRequirements = parseDiaryQuestRequirements(wikitext);
  const additionalRequirements = parseDiaryAdditionalRequirements(wikitext);

  // Only include quest requirements if any were found
  const hasQuestReqs = Object.values(questRequirements).some(
    (arr) => arr.length > 0
  );
  const hasAdditionalReqs = Object.values(additionalRequirements).some(
    (arr) => arr.length > 0
  );

  return {
    name: regionName,
    tasks,
    requirements,
    ...(hasQuestReqs ? { questRequirements } : {}),
    ...(hasAdditionalReqs ? { additionalRequirements } : {}),
  };
}

/**
 * Create a MediaWiki API client
 */
export function createMediaWikiClient(
  userAgent: string,
  options?: {
    retries?: number;
    timeoutMs?: number;
    cache?: CacheAdapter<unknown> | null;
    cacheTtlMs?: number;
  }
): WikiMediaWikiClient {
  return new WikiMediaWikiClient({ userAgent, ...options });
}
