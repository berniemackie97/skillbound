/**
 * Normalize quest name to match our ID format
 */
export function normalizeQuestName(questName: string): string {
  return questName
    .toLowerCase()
    .replace(/[''']/g, '_')
    .replace(/…/g, '')
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}
