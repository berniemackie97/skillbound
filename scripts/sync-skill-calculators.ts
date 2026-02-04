import { mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

type CalculatorPayload = {
  source: string;
  fetchedAt: string;
  payload: unknown;
};

const SKILL_SLUGS = [
  'agility',
  'construction',
  'cooking',
  'crafting',
  'farming',
  'firemaking',
  'fishing',
  'fletching',
  'herblore',
  'hunter',
  'magic',
  'mining',
  'prayer',
  'runecrafting',
  'smithing',
  'thieving',
  'woodcutting',
  'sailing',
];

const EXTRA_SLUGS = ['combat-training'];

function resolveRepoRoot(): string {
  const cwd = process.cwd();
  if (existsSync(path.join(cwd, 'apps')) && existsSync(path.join(cwd, 'packages'))) {
    return cwd;
  }
  const nested = path.join(cwd, 'skillbound');
  if (existsSync(path.join(nested, 'apps')) && existsSync(path.join(nested, 'packages'))) {
    return nested;
  }
  throw new Error('Unable to locate skillbound repo root from cwd: ' + cwd);
}

function extractWindowData(html: string): unknown {
  const matches = [
    ...html.matchAll(/window\.data\s*=\s*(\{[\s\S]*?\})\s*;?\s*<\/script>/g),
  ];
  if (matches.length === 0) {
    throw new Error('Could not locate window.data payload');
  }
  const raw = matches[matches.length - 1]?.[1];
  if (!raw) {
    throw new Error('window.data payload missing');
  }
  return JSON.parse(raw);
}

async function fetchCalculatorPayload(slug: string): Promise<CalculatorPayload> {
  const url = `https://oldschool.tools/calculators/skill/${slug}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${slug} (${response.status})`);
  }
  const html = await response.text();
  const payload = extractWindowData(html);
  return {
    source: 'oldschool.tools',
    fetchedAt: new Date().toISOString(),
    payload,
  };
}

async function run() {
  const repoRoot = resolveRepoRoot();
  const outDir = path.join(repoRoot, 'apps/web/src/data/skill-calculators');
  await mkdir(outDir, { recursive: true });

  const slugs = [...SKILL_SLUGS, ...EXTRA_SLUGS];
  for (const slug of slugs) {
    console.log(`Fetching ${slug}...`);
    const payload = await fetchCalculatorPayload(slug);
    const outPath = path.join(outDir, `${slug}.json`);
    await writeFile(outPath, JSON.stringify(payload, null, 2));
  }

  console.log('Skill calculator payloads synced.');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
