#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { mkdir } from 'fs/promises';
import EmbeddedPostgres from 'embedded-postgres';
import postgres from 'postgres';
import net from 'net';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = dirname(__dirname);

/**
 * Port utilities for local database setup
 */
async function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, '127.0.0.1', () => {
      server.close(() => {
        const client = net.createConnection(port, '127.0.0.1');
        client.on('connect', () => {
          client.destroy();
          resolve(false);
        });
        client.on('error', () => resolve(true));
        setTimeout(() => {
          client.destroy();
          resolve(true);
        }, 1000);
      });
    });
    server.on('error', () => resolve(false));
  });
}

async function findNextAvailablePort(startPort) {
  let port = startPort;
  let attempts = 0;
  const maxAttempts = 100;
  
  while (!(await isPortAvailable(port)) && attempts < maxAttempts) {
    port++;
    attempts++;
  }
  
  if (attempts >= maxAttempts) {
    throw new Error(`Could not find an available port starting from ${startPort}`);
  }
  
  return port;
}

/**
 * Setup local embedded PostgreSQL database
 */
export async function setupEmbeddedPostgres() {
  console.log('🗄️ Setting up local embedded PostgreSQL...');
  
  const dataDir = join(projectRoot, 'data');
  if (!existsSync(dataDir)) {
    await mkdir(dataDir, { recursive: true });
    console.log('✅ Created data directory');
  }

  // Find available port
  console.log('🔍 Finding available PostgreSQL port...');
  const postgresPort = await findNextAvailablePort(5433);
  console.log(`✅ Found available port: ${postgresPort}`);

  // Initialize database
  console.log(`📦 Initializing embedded PostgreSQL on port ${postgresPort}...`);
  
  let embeddedPg = null;
  let client = null;
  
  try {
    embeddedPg = new EmbeddedPostgres({
      databaseDir: join(dataDir, 'postgres'),
      user: 'postgres',
      password: 'password',
      port: postgresPort,
      persistent: true,
      initdbFlags: process.platform === 'darwin' 
        ? ['--encoding=UTF8', '--lc-collate=en_US.UTF-8', '--lc-ctype=en_US.UTF-8']
        : ['--encoding=UTF8', '--lc-collate=C', '--lc-ctype=C']
    });

    await embeddedPg.initialise();
    await embeddedPg.start();
    console.log(`✅ Embedded PostgreSQL started on port ${postgresPort}`);

    const connectionString = `postgresql://postgres:password@localhost:${postgresPort}/postgres`;
    
    // Update .env file with correct port
    const envPath = join(projectRoot, 'server', '.env');
    const envContent = readFileSync(envPath, 'utf-8');
    
    let updatedEnv;
    if (envContent.includes('DATABASE_URL=')) {
      // Replace existing DATABASE_URL
      updatedEnv = envContent.replace(
        /DATABASE_URL=postgresql:\/\/postgres:password@localhost:\d+\/postgres/,
        `DATABASE_URL=${connectionString}`
      );
    } else {
      // Add DATABASE_URL where the comment is
      updatedEnv = envContent.replace(
        /# DATABASE_URL will be set by post-setup script/,
        `DATABASE_URL=${connectionString}`
      );
    }
    
    writeFileSync(envPath, updatedEnv);
    console.log(`✅ Updated .env with PostgreSQL on port ${postgresPort}`);

    // Test connection and create schema
    client = postgres(connectionString);
    
    const schemaExists = await client`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name = 'app'
    `;

    if (schemaExists.length === 0) {
      console.log('📦 Creating app schema...');
      await client`CREATE SCHEMA app`;
      
      const migrationPath = join(projectRoot, 'server', 'drizzle', '0000_initial.sql');
      if (existsSync(migrationPath)) {
        const migrationSQL = readFileSync(migrationPath, 'utf-8');
        const schemaAwareSql = migrationSQL.replace(
          'CREATE TABLE IF NOT EXISTS "users"',
          'CREATE TABLE IF NOT EXISTS app.users'
        );
        await client.unsafe(schemaAwareSql);
        console.log('✅ Database schema created');
      }
    } else {
      console.log('✅ Database schema already exists');
    }

    return connectionString;

  } catch (error) {
    console.error('❌ Failed to setup embedded PostgreSQL:', error);
    
    if (error.message?.includes('postmaster.pid already exists')) {
      console.log('⚠️ PostgreSQL instance already running, continuing...');
      return `postgresql://postgres:password@localhost:${postgresPort}/postgres`;
    }
    
    // Provide Mac-specific troubleshooting
    if (process.platform === 'darwin') {
      console.log('');
      console.log('🍎 Mac Troubleshooting:');
      
      if (error.message?.includes('init script exited with code null') || error.message?.includes('initdb')) {
        console.log('  ❌ PostgreSQL initialization failed on Apple Silicon Mac');
        console.log('  🔧 Try these solutions in order:');
        console.log('');
        console.log('  1. Install Rosetta 2 (required for Intel emulation):');
        console.log('     softwareupdate --install-rosetta');
        console.log('');
        console.log('  2. Install Xcode Command Line Tools:');
        console.log('     xcode-select --install');
        console.log('');
        console.log('  3. Clean up and retry:');
        console.log(`     rm -rf ${join(dataDir, 'postgres')}`);
        console.log('     Then run the setup again');
        console.log('');
        console.log('  4. Alternative: Use Docker PostgreSQL instead:');
        console.log('     docker run -d --name volo-postgres -p 5433:5432 \\');
        console.log('       -e POSTGRES_PASSWORD=password postgres:15');
      } else {
        console.log('  1. If you have Apple Silicon (M1/M2/M3), try installing Rosetta 2:');
        console.log('     softwareupdate --install-rosetta');
        console.log('  2. Ensure you have required system tools:');
        console.log('     xcode-select --install');
        console.log('  3. Check available disk space and permissions in:');
        console.log(`     ${join(dataDir, 'postgres')}`);
        console.log('  4. Try restarting the terminal and running again');
      }
    }
    
    throw new Error(`Embedded PostgreSQL setup failed: ${error.message || 'Unknown error'}`);
  } finally {
    if (client) await client.end();
    if (embeddedPg) await embeddedPg.stop();
  }
} 