import { argon2id, hash, type Options, verify } from 'argon2';

const HASH_OPTIONS: Options & { raw?: false } = {
  type: argon2id,
  memoryCost: 2 ** 16,
  timeCost: 3,
  parallelism: 1,
};

export async function hashPassword(password: string): Promise<string> {
  return hash(password, HASH_OPTIONS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  try {
    return await verify(hash, password, HASH_OPTIONS);
  } catch {
    return false;
  }
}
