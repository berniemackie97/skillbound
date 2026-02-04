import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { users } from './users';

/**
 * Local credentials table
 * Stores password hashes for email/password logins
 */
export const userCredentials = pgTable('user_credentials', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type UserCredential = typeof userCredentials.$inferSelect;
export type NewUserCredential = typeof userCredentials.$inferInsert;
