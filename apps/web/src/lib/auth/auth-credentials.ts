import { eq, userCredentials, users } from '@skillbound/database';
import { z } from 'zod';

import { getDbClient } from '../db';
import { hashPassword, verifyPassword } from './passwords';

const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required.')
  .email('Enter a valid email.')
  .transform((value) => value.toLowerCase());

const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Username must be at least 3 characters.')
  .max(32, 'Username must be 32 characters or fewer.')
  .regex(
    /^[a-zA-Z0-9._-]+$/,
    'Username can include letters, numbers, dots, underscores, and hyphens.'
  )
  .transform((value) => value.toLowerCase());

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters.');

const identifierSchema = z
  .string()
  .trim()
  .min(1, 'Email or username is required.');

const usernameOptionalSchema = z.preprocess((value) => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  }
  return value;
}, usernameSchema.optional());

export const credentialsSchema = z.object({
  identifier: identifierSchema,
  password: passwordSchema,
});

export const registrationSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  username: usernameOptionalSchema,
});

export type CredentialsInput = z.infer<typeof credentialsSchema>;
export type RegistrationInput = z.infer<typeof registrationSchema>;

type ParsedIdentifier =
  | { type: 'email'; value: string }
  | { type: 'username'; value: string };

export function parseLoginIdentifier(value: string): ParsedIdentifier {
  const candidate = identifierSchema.parse(value);
  const emailResult = emailSchema.safeParse(candidate);
  if (emailResult.success) {
    return { type: 'email', value: emailResult.data };
  }
  const usernameResult = usernameSchema.safeParse(candidate);
  if (usernameResult.success) {
    return { type: 'username', value: usernameResult.data };
  }
  throw new Error('InvalidIdentifier');
}

export async function registerUserWithPassword(input: RegistrationInput) {
  const parsed = registrationSchema.parse(input);
  const db = getDbClient();

  const existingEmail = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, parsed.email))
    .limit(1);

  if (existingEmail.length > 0) {
    throw new Error('UserExists');
  }

  if (parsed.username) {
    const existingUsername = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, parsed.username))
      .limit(1);

    if (existingUsername.length > 0) {
      throw new Error('UserExists');
    }
  }

  const passwordHash = await hashPassword(parsed.password);
  const [user] = await db
    .insert(users)
    .values({
      email: parsed.email,
      username: parsed.username ?? null,
      name: parsed.username ?? null,
    })
    .returning();

  if (!user) {
    throw new Error('UserInsertFailed');
  }

  await db.insert(userCredentials).values({ userId: user.id, passwordHash });

  return user;
}

export async function verifyUserCredentials(input: CredentialsInput) {
  const parsed = credentialsSchema.parse(input);
  const db = getDbClient();

  let identifier: ParsedIdentifier;
  try {
    identifier = parseLoginIdentifier(parsed.identifier);
  } catch {
    return null;
  }

  const [record] = await db
    .select({
      user: users,
      passwordHash: userCredentials.passwordHash,
    })
    .from(users)
    .innerJoin(userCredentials, eq(users.id, userCredentials.userId))
    .where(
      identifier.type === 'email'
        ? eq(users.email, identifier.value)
        : eq(users.username, identifier.value)
    )
    .limit(1);

  if (!record) {
    return null;
  }

  const valid = await verifyPassword(parsed.password, record.passwordHash);
  if (!valid) {
    return null;
  }

  return record.user;
}
