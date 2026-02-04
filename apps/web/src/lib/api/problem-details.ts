export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  errors?: unknown;
}

export function createProblemDetails(options: {
  status: number;
  title: string;
  detail?: string;
  instance?: string;
  errors?: unknown;
  type?: string;
}): ProblemDetails {
  const problem: ProblemDetails = {
    type: options.type ?? 'about:blank',
    title: options.title,
    status: options.status,
  };

  if (options.detail !== undefined) {
    problem.detail = options.detail;
  }

  if (options.instance !== undefined) {
    problem.instance = options.instance;
  }

  if (options.errors !== undefined) {
    problem.errors = options.errors;
  }

  return problem;
}
