'use server';

import { signIn, signOut } from '@/lib/auth/auth';
import { registerUserWithPassword } from '@/lib/auth/auth-credentials';

export async function signInAction(provider: string, formData?: FormData) {
  if (provider === 'credentials' && formData) {
    await signIn('credentials', formData);
    return;
  }

  await signIn(provider, { redirectTo: '/' });
}

export async function signOutAction() {
  await signOut({ redirectTo: '/' });
}

export async function registerAction(formData: FormData) {
  const email = formData.get('email');
  const password = formData.get('password');
  const username = formData.get('username');

  if (typeof email !== 'string' || typeof password !== 'string') {
    throw new Error('MissingFields');
  }

  await registerUserWithPassword({
    email,
    password,
    username: typeof username === 'string' ? username : undefined,
  });

  await signIn('credentials', {
    identifier: email,
    password,
    redirectTo: '/',
  });
}

export async function magicLinkAction(formData: FormData) {
  const email = formData.get('email');
  if (typeof email !== 'string' || email.trim().length === 0) {
    throw new Error('EmailRequired');
  }

  await signIn('nodemailer', {
    email: email.trim(),
    redirectTo: '/',
  });
}
