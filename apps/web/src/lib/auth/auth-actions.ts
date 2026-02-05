'use server';

import { signIn, signOut } from '@/lib/auth/auth';
import { registerUserWithPassword } from '@/lib/auth/auth-credentials';

type CredentialsPayload = {
  identifier: string;
  password: string;
  callbackUrl?: string;
};

type RegisterPayload = {
  email: string;
  password: string;
  username?: string;
  callbackUrl?: string;
};

export async function signInAction(
  provider: string,
  payload?: CredentialsPayload
) {
  if (provider === 'credentials') {
    if (!payload?.identifier || !payload?.password) {
      throw new Error('MissingFields');
    }
    const redirectTo = payload.callbackUrl ?? '/';
    await signIn('credentials', {
      identifier: payload.identifier,
      password: payload.password,
      redirectTo,
    });
    return;
  }

  await signIn(provider, { redirectTo: '/' });
}

export async function signOutAction() {
  await signOut({ redirectTo: '/' });
}

export async function registerAction(payload: RegisterPayload) {
  if (!payload?.email || !payload?.password) {
    throw new Error('MissingFields');
  }
  const redirectTo = payload.callbackUrl ?? '/';

  await registerUserWithPassword({
    email: payload.email,
    password: payload.password,
    username: payload.username,
  });

  await signIn('credentials', {
    identifier: payload.email,
    password: payload.password,
    redirectTo,
  });
}

export async function magicLinkAction(payload: {
  email: string;
  callbackUrl?: string;
}) {
  const email = payload?.email;
  if (typeof email !== 'string' || email.trim().length === 0) {
    throw new Error('EmailRequired');
  }
  const redirectTo = payload.callbackUrl ?? '/';

  await signIn('nodemailer', {
    email: email.trim(),
    redirectTo,
  });
}
