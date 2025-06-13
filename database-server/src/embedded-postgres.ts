import EmbeddedPostgres from 'embedded-postgres';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let embeddedInstance: EmbeddedPostgres | null = null;
let connectionString: string | null = null;

const isDatabaseInitialized = (dataDir: string): boolean => {
  const pgVersionFile = path.join(dataDir, 'PG_VERSION');
  const postgresqlConfFile = path.join(dataDir, 'postgresql.conf');
  return existsSync(pgVersionFile) && existsSync(postgresqlConfFile);
};

export const startEmbeddedPostgres = async (port: number = 5502): Promise<string> => {
  if (embeddedInstance && connectionString) {
    return connectionString;
  }

  console.log('🗄️ Starting embedded PostgreSQL...');

  // Use data directory relative to the database-server package
  const dataDir = path.join(__dirname, '../../data/postgres');
  const isInitialized = isDatabaseInitialized(dataDir);

  embeddedInstance = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'postgres',
    password: 'password',
    port: port,
    persistent: true,
    initdbFlags: process.platform === 'darwin' 
      ? ['--encoding=UTF8', '--lc-collate=en_US.UTF-8', '--lc-ctype=en_US.UTF-8']
      : ['--encoding=UTF8', '--lc-collate=C', '--lc-ctype=C']
  });

  try {
    if (!isInitialized) {
      console.log('📦 Initializing PostgreSQL cluster...');
      await embeddedInstance.initialise();
    }

    await embeddedInstance.start();
    connectionString = `postgresql://postgres:password@localhost:${port}/postgres`;
    
    console.log(`✅ Embedded PostgreSQL started on port ${port}`);
    return connectionString;
  } catch (error: any) {
    embeddedInstance = null;
    
    if (error?.message && error.message.includes('postmaster.pid already exists')) {
      console.log('⚠️ PostgreSQL instance already running in this directory');
      console.log('💡 Either stop the other instance or use a different project folder');
      throw error;
    } else {
      console.error('❌ Failed to start embedded PostgreSQL:', error?.message || error);
      throw error;
    }
  }
};

export const stopEmbeddedPostgres = async (): Promise<void> => {
  if (!embeddedInstance) return;

  try {
    console.log('🛑 Stopping embedded PostgreSQL...');
    await embeddedInstance.stop();
    embeddedInstance = null;
    connectionString = null;
    console.log('✅ Embedded PostgreSQL stopped');
  } catch (error) {
    console.error('❌ Error stopping embedded PostgreSQL:', error);
    embeddedInstance = null;
    connectionString = null;
  }
};

export const getEmbeddedConnectionString = (): string | null => connectionString; 