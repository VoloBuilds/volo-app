import type { Config } from 'drizzle-kit';
import { getDatabaseUrl } from './src/lib/env';

const databaseUrl = getDatabaseUrl();

export default {
  schema: './src/schema/*',
  out: './drizzle',
  driver: 'pg',
  dbCredentials: {
    connectionString: databaseUrl || 'postgresql://postgres:password@localhost:5502/postgres',
  },
  schemaFilter: ['app'],
} satisfies Config; 