import { runeliteBankTagLayoutSchema, runeliteBankTagSchema } from './schema';
import type { RuneLiteBankTagsParseResult } from './types';

function parseIntStrict(value: string): number | null {
  if (!/^-?\d+$/.test(value)) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseRuneLiteBankTagsExport(
  payload: string
): RuneLiteBankTagsParseResult {
  const tags: RuneLiteBankTagsParseResult['tags'] = [];
  const layouts: RuneLiteBankTagsParseResult['layouts'] = [];
  const errors: RuneLiteBankTagsParseResult['errors'] = [];

  const lines = payload.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const parts = trimmed.split(',');
    const [kind, version, name, ...rest] = parts;

    if (!kind || !version || !name) {
      errors.push({ line: trimmed, reason: 'Missing header fields' });
      continue;
    }

    if (version !== '1') {
      errors.push({ line: trimmed, reason: `Unsupported version: ${version}` });
      continue;
    }

    if (kind === 'banktags') {
      const ids: number[] = [];
      let failed = false;
      for (const token of rest) {
        const parsed = parseIntStrict(token);
        if (parsed === null) {
          failed = true;
          break;
        }
        ids.push(parsed);
      }

      if (failed) {
        errors.push({ line: trimmed, reason: 'Invalid item id list' });
        continue;
      }

      const parsed = runeliteBankTagSchema.safeParse({ name, itemIds: ids });
      if (!parsed.success) {
        errors.push({ line: trimmed, reason: parsed.error.message });
        continue;
      }

      tags.push(parsed.data);
      continue;
    }

    if (kind === 'banktaglayouts') {
      if (rest.length % 2 !== 0) {
        errors.push({
          line: trimmed,
          reason: 'Layout entries must be itemId,position pairs',
        });
        continue;
      }

      const positions: Array<{ itemId: number; position: number }> = [];
      let failed = false;
      for (let i = 0; i < rest.length; i += 2) {
        const itemId = parseIntStrict(rest[i] ?? '');
        const position = parseIntStrict(rest[i + 1] ?? '');
        if (itemId === null || position === null) {
          failed = true;
          break;
        }
        positions.push({ itemId, position });
      }

      if (failed) {
        errors.push({
          line: trimmed,
          reason: 'Invalid layout item/position pair',
        });
        continue;
      }

      const parsed = runeliteBankTagLayoutSchema.safeParse({ name, positions });
      if (!parsed.success) {
        errors.push({ line: trimmed, reason: parsed.error.message });
        continue;
      }

      layouts.push(parsed.data);
      continue;
    }

    errors.push({ line: trimmed, reason: `Unsupported tag type: ${kind}` });
  }

  return { tags, layouts, errors };
}
