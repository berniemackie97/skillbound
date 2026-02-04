import { NextResponse } from 'next/server';

import { createProblemDetails } from '../api/problem-details';

import { auth } from './auth';

export type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  return session?.user?.id ? session.user : null;
}

export function unauthorizedResponse() {
  const problem = createProblemDetails({
    status: 401,
    title: 'Unauthorized',
    detail: 'You must be signed in to access this resource.',
  });

  return NextResponse.json(problem, { status: problem.status });
}
