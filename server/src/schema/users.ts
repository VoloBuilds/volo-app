import { pgSchema, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

// Create private schema for application tables
export const appSchema = pgSchema('app');

export const users = appSchema.table('users', {
  id: text('id').primaryKey(),
  email: text('email').unique(), // Nullable for anonymous users
  display_name: text('display_name'),
  photo_url: text('photo_url'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert; 