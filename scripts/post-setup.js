#!/usr/bin/env node

/**
 * Unified post-setup script for create-volo-app
 * Handles all modular combinations:
 * - Local vs Production Database (embedded PostgreSQL vs Neon/Supabase)
 * - Local vs Production Auth (Firebase emulator vs production Firebase)
 * - Local vs Production Deploy (local dev vs Cloudflare)
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { mkdir } from 'fs/promises';
import postgres from 'postgres';
import net from 'net';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = dirname(__dirname);

console.log('🔧 Running post-setup configuration...');

/**
 * Execute pnpm command with proper PATH resolution and npm fallback
 * Handles PATH issues across different platforms and shells
 */
function execPnpm(command, options = {}) {
  const isWindows = process.platform === 'win32';
  const isMac = process.platform === 'darwin';
  
  // Build list of commands to try in order
  const possibleCommands = [];
  
  if (isWindows) {
    // On Windows, try different approaches to find pnpm
    possibleCommands.push(
      command, // Try direct command first
      command.replace('pnpm', 'pnpm.cmd'), // Try .cmd extension
      command.replace('pnpm', 'npx pnpm'), // Try via npx
    );
  } else {
    // On Unix systems (Mac/Linux)
    possibleCommands.push(
      command, // Try direct command first
      command.replace('pnpm', 'npx pnpm'), // Try via npx
    );
    
    // Mac-specific: try common Homebrew and other package manager paths
    if (isMac) {
      // Try with explicit PATH that includes common package manager locations
      const macPaths = [
        '/opt/homebrew/bin', // Apple Silicon Homebrew
        '/usr/local/bin',    // Intel Homebrew
        '/opt/local/bin',    // MacPorts
        process.env.HOME + '/.local/bin', // User local
        process.env.HOME + '/.npm-global/bin', // npm global
        process.env.HOME + '/.pnpm', // pnpm home
      ].filter(Boolean).join(':');
      
      const enhancedPath = `${macPaths}:${process.env.PATH || ''}`;
      
      possibleCommands.push({
        cmd: command,
        env: { ...process.env, PATH: enhancedPath }
      });
    }
  }
  
  // Add npm fallback for install commands only
  if (command.includes('pnpm install') && !command.includes('dotenv-cli')) {
    possibleCommands.push(command.replace('pnpm install', 'npm install'));
  }
  
  let lastError;
  for (const cmdOrObj of possibleCommands) {
    try {
      const isObject = typeof cmdOrObj === 'object';
      const cmd = isObject ? cmdOrObj.cmd : cmdOrObj;
      const cmdEnv = isObject ? cmdOrObj.env : process.env;
      
      return execSync(cmd, {
        ...options,
        env: {
          ...cmdEnv,
          ...options.env,
        },
      });
    } catch (error) {
      lastError = error;
      if (cmdOrObj === possibleCommands[possibleCommands.length - 1]) {
        // If this is the last attempt, throw the error
        throw error;
      }
      // Otherwise, continue to next attempt
      continue;
    }
  }
  
  throw lastError;
}

/**
 * Debug function to show detailed PATH and pnpm information
 */
function debugPnpmEnvironment() {
  console.log('🔍 Debugging pnpm environment...');
  console.log(`Platform: ${process.platform}`);
  console.log(`Current PATH: ${process.env.PATH}`);
  console.log(`Shell: ${process.env.SHELL || 'unknown'}`);
  console.log(`Home: ${process.env.HOME || 'unknown'}`);
  
  // Try to find pnpm with which/where
  try {
    const whichCmd = process.platform === 'win32' ? 'where pnpm' : 'which pnpm';
    const pnpmLocation = execSync(whichCmd, { stdio: 'pipe', encoding: 'utf8' });
    console.log(`pnpm location: ${pnpmLocation.trim()}`);
  } catch (error) {
    console.log('pnpm not found in PATH via which/where');
  }
  
  // Check common installation locations
  const commonLocations = [
    '/opt/homebrew/bin/pnpm',
    '/usr/local/bin/pnpm',
    process.env.HOME + '/.local/bin/pnpm',
    process.env.HOME + '/.npm-global/bin/pnpm',
    process.env.HOME + '/.pnpm/pnpm',
  ].filter(Boolean);
  
  for (const location of commonLocations) {
    try {
      if (existsSync(location)) {
        console.log(`✅ Found pnpm at: ${location}`);
        const version = execSync(`"${location}" --version`, { stdio: 'pipe', encoding: 'utf8' });
        console.log(`   Version: ${version.trim()}`);
      }
    } catch (error) {
      // Silent fail for testing
    }
  }
}

/**
 * Test if pnpm is available
 */
async function testPnpmAvailability() {
  try {
    const version = execPnpm('pnpm --version', { stdio: 'pipe' });
    console.log(`✅ pnpm ${version.toString().trim()} detected`);
    return true;
  } catch (error) {
    console.log('⚠️ pnpm not found, running diagnostics...');
    debugPnpmEnvironment();
    
    console.log('');
    console.log('💡 To fix pnpm issues:');
    console.log('   • Install: npm install -g pnpm');
    console.log('   • Or install via Homebrew: brew install pnpm');
    console.log('   • Or visit: https://pnpm.io/installation');
    console.log('   • Make sure to restart your terminal after installation');
    console.log('');
    
    // Test if npm is available as fallback
    try {
      const npmVersion = execSync('npm --version', { stdio: 'pipe' });
      console.log(`✅ npm ${npmVersion.toString().trim()} will be used as fallback`);
      return true;
    } catch (npmError) {
      console.error('❌ Neither pnpm nor npm is available');
      console.error('💡 Please install Node.js and npm first');
      return false;
    }
  }
}

/**
 * Detect configuration from generated files
 */
function detectConfiguration() {
  const config = {
    database: { mode: 'local', provider: null, url: null },
    auth: { mode: 'local', projectId: 'demo-project' },
    deploy: { mode: 'local', hasWrangler: false }
  };

  // Detect database configuration
  const envPath = join(projectRoot, 'server', '.env');
  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, 'utf-8');
    const dbUrlMatch = envContent.match(/DATABASE_URL=(.+)/);
    
    if (dbUrlMatch) {
      const dbUrl = dbUrlMatch[1].trim();
      config.database.url = dbUrl;
      
      if (dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')) {
        config.database.mode = 'local';
      } else {
        config.database.mode = 'production';
        if (dbUrl.includes('neon.tech')) config.database.provider = 'neon';
        else if (dbUrl.includes('supabase.co')) config.database.provider = 'supabase';
        else config.database.provider = 'custom';
      }
    } else {
      // No DATABASE_URL found - check if it's a local setup based on comments
      if (envContent.includes('embedded PostgreSQL') || envContent.includes('post-setup script')) {
        config.database.mode = 'local';
      }
    }

    // Detect auth configuration
    const projectIdMatch = envContent.match(/FIREBASE_PROJECT_ID=(.+)/);
    if (projectIdMatch) {
      const projectId = projectIdMatch[1].trim();
      config.auth.projectId = projectId;
      config.auth.mode = projectId === 'demo-project' ? 'local' : 'production';
    }
  }

  // Detect deployment configuration
  const wranglerPath = join(projectRoot, 'server', 'wrangler.toml');
  config.deploy.hasWrangler = existsSync(wranglerPath);
  config.deploy.mode = config.deploy.hasWrangler ? 'production' : 'local';

  return config;
}

/**
 * Setup local embedded PostgreSQL database with dynamic dependency installation
 */
async function setupLocalDatabase() {
  try {
    // Add embedded-postgres dependency dynamically
    console.log('📦 Installing embedded PostgreSQL dependency...');
    
    const packageJsonPath = join(projectRoot, 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    
    // Add embedded-postgres to devDependencies if not already present
    if (!packageJson.devDependencies?.['embedded-postgres']) {
      packageJson.devDependencies = packageJson.devDependencies || {};
      packageJson.devDependencies['embedded-postgres'] = '17.5.0-beta.15';
      
      writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
      console.log('✅ Added embedded-postgres dependency');
      
      // Install the new dependency
      console.log('📦 Running pnpm install for embedded-postgres...');
      execPnpm('pnpm install', { cwd: projectRoot, stdio: 'inherit' });
      console.log('✅ Embedded-postgres installed');
    }
    
    // Now dynamically import and run the embedded postgres setup
    console.log('🗄️ Setting up embedded PostgreSQL...');
    const { setupEmbeddedPostgres } = await import('./post-setup-embedded-pg.js');
    return await setupEmbeddedPostgres();
  } catch (error) {
    // Handle embedded PostgreSQL setup failures
    console.log('');
    console.log('❌ Local database setup failed');
    console.log('');
    console.log('The embedded PostgreSQL database could not be started on your system.');
    console.log('');
    console.log('Next steps:');
    console.log('');
    console.log('1. Connect to a cloud database:');
    console.log('   • Run: pnpm connect:database');
    console.log('   • Choose a cloud provider like Neon or Supabase');
    console.log('');
    console.log('2. Or install PostgreSQL locally:');
    console.log('   • macOS: brew install postgresql@15 && brew services start postgresql@15');
    console.log('   • Then run: pnpm connect:database and choose "Other PostgreSQL"');
    console.log('');
    
    // Re-throw the error so the outer catch can handle the exit properly
    throw new Error('Database setup failed');
  }
}

/**
 * Test production database connectivity
 */
async function testProductionDatabase(config) {
  console.log('🔍 Testing production database connectivity...');
  
  try {
    execSync(`npx dotenv-cli -e .env -- node scripts/db-connectivity-test.mjs`, {
      cwd: join(projectRoot, 'server'),
      timeout: 15000,
      stdio: 'pipe'
    });
    console.log('✅ Production database connectivity verified');
    return true;
  } catch (error) {
    console.log('⚠️ Database connectivity test failed, will retry schema setup...');
    return false;
  }
}

/**
 * Setup production database schema
 */
async function setupProductionDatabaseSchema(config) {
  console.log('🔒 Setting up production database schema...');
  
  try {
    // Setup private schema
    execSync('npx dotenv-cli -e .env -- node scripts/setup-private-schema.mjs', {
      cwd: join(projectRoot, 'server'),
      stdio: 'inherit'
    });
    
    // Push schema with Drizzle
    execPnpm('npx dotenv-cli -e .env -- pnpm db:push', {
      cwd: join(projectRoot, 'server'),
      stdio: 'inherit'
    });
    
    console.log('✅ Production database schema created successfully!');
  } catch (error) {
    console.error('❌ Failed to setup database schema');
    console.log('💡 You can complete this manually:');
    console.log('   cd server && npx dotenv-cli -e .env -- pnpm db:push');
    throw error;
  }
}

/**
 * Setup Firebase configuration
 */
async function setupFirebaseConfig(config) {
  if (config.auth.mode === 'local') {
    console.log('🔥 Setting up Firebase emulator configuration...');
    
    const firebaseConfigPath = join(projectRoot, 'ui', 'src', 'lib', 'firebase-config.json');
    
    if (!existsSync(firebaseConfigPath)) {
      const demoConfig = {
        "apiKey": "demo-api-key",
        "authDomain": "demo-project.firebaseapp.com",
        "projectId": "demo-project",
        "storageBucket": "demo-project.appspot.com",
        "messagingSenderId": "123456789",
        "appId": "1:123456789:web:abcdef123456",
        "measurementId": "G-XXXXXXXXXX"
      };
      
      writeFileSync(firebaseConfigPath, JSON.stringify(demoConfig, null, 2));
      console.log('✅ Created demo Firebase configuration');
    } else {
      console.log('✅ Firebase configuration already exists');
    }
  } else {
    console.log('✅ Production Firebase configuration detected');
  }
}

/**
 * Main setup function
 */
async function runPostSetup() {
  try {
    // Test pnpm availability first
    const pnpmAvailable = await testPnpmAvailability();
    if (!pnpmAvailable) {
      process.exit(1);
    }

    // Install dependencies
    console.log('📦 Installing dependencies...');
    execPnpm('pnpm install', { cwd: projectRoot, stdio: 'inherit' });
    console.log('✅ Dependencies installed');

    // Detect configuration
    const config = detectConfiguration();
    console.log('🔍 Detected configuration:');
    console.log(`   Database: ${config.database.mode}${config.database.provider ? ` (${config.database.provider})` : ''}`);
    console.log(`   Auth: ${config.auth.mode} (${config.auth.projectId})`);
    console.log(`   Deploy: ${config.deploy.mode}`);
    console.log('');

    // Setup database based on mode
    if (config.database.mode === 'local') {
      await setupLocalDatabase();
    } else {
      // Production database
      const isConnected = await testProductionDatabase(config);
      if (isConnected) {
        await setupProductionDatabaseSchema(config);
      } else {
        console.log('⚠️ Skipping schema setup due to connectivity issues');
        console.log('💡 Run manually when database is ready: cd server && pnpm db:push');
      }
    }

    // Setup Firebase configuration
    await setupFirebaseConfig(config);

    // Success message
    console.log('');
    console.log('🎉 Post-setup complete!');
    console.log('');
    
    if (config.database.mode === 'local') {
      console.log('💡 Local development ready:');
      console.log('   • Embedded PostgreSQL database running');
      console.log('   • Firebase Auth emulator ready');
      console.log('   • Run `pnpm dev` to start all services');
    } else {
      console.log('💡 Production services connected:');
      console.log(`   • Database: ${config.database.provider} (${config.database.mode})`);
      console.log(`   • Auth: Firebase (${config.auth.mode})`);
      if (config.deploy.hasWrangler) {
        console.log('   • Deploy: Cloudflare Workers (configured)');
      }
    }

  } catch (error) {
    // If it's a database setup failure, we already showed the detailed error message
    if (error.message === 'Database setup failed') {
      // Exit without showing additional confusing messages
      process.exit(1);
    }
    
    // For other errors, show the generic error message
    console.error('❌ Post-setup failed:', error.message);
    console.log('');
    console.log('💡 You can complete setup manually:');
    console.log('   • For local database: pnpm post-setup or pnpm run dev from project root');
    console.log('   • For production database: cd server && pnpm db:push');
    process.exit(1);
  }
}

// Run the setup
runPostSetup(); 