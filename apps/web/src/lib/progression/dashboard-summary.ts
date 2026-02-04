import type { RequirementStatus } from '@skillbound/domain';

export type CompletionSummary = {
  total: number;
  met: number;
  notMet: number;
  unknown: number;
};

export function summarizeCompletion(
  statuses: RequirementStatus[]
): CompletionSummary {
  const summary: CompletionSummary = {
    total: statuses.length,
    met: 0,
    notMet: 0,
    unknown: 0,
  };

  for (const status of statuses) {
    if (status === 'MET') {
      summary.met += 1;
    } else if (status === 'NOT_MET') {
      summary.notMet += 1;
    } else {
      summary.unknown += 1;
    }
  }

  return summary;
}
