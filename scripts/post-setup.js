#!/usr/bin/env node

/**
 * Post-setup script called by create-volo-app CLI
 * Handles template-specific setup tasks after configuration files are generated
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = dirname(__dirname);

// Database provider detection and utilities
const DatabaseProviders = {
  NEON: 'neon',
  SUPABASE: 'supabase', 
  OTHER: 'other'
};

const SupabaseConnectionTypes = {
  DIRECT_IPV6: 'direct_ipv6',
  POOLED_SESSION: 'pooled_session',
  POOLED_TRANSACTION: 'pooled_transaction'
};

class DatabaseConfig {
  constructor(url) {
    this.url = url;
    this.provider = this.detectProvider();
    this.supabaseType = this.detectSupabaseConnectionType();
  }

  detectProvider() {
    if (this.url.includes('neon.tech') || this.url.includes('neon.database')) {
      return DatabaseProviders.NEON;
    }
    if (this.url.includes('supabase.co')) {
      return DatabaseProviders.SUPABASE;
    }
    return DatabaseProviders.OTHER;
  }

  detectSupabaseConnectionType() {
    if (this.provider !== DatabaseProviders.SUPABASE) return null;
    
    if (this.url.includes('db.') && this.url.includes('.supabase.co')) {
      return SupabaseConnectionTypes.DIRECT_IPV6;
    }
    if (this.url.includes('pooler.supabase.com:6543')) {
      return SupabaseConnectionTypes.POOLED_TRANSACTION;
    }
    if (this.url.includes('pooler.supabase.com:5432')) {
      return SupabaseConnectionTypes.POOLED_SESSION;
    }
    return null;
  }

  createOptimizedUrl() {
    if (this.provider !== DatabaseProviders.SUPABASE) {
      return this.url;
    }

    const urlMatch = this.url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
    if (!urlMatch) return this.url;

    const [, username, password, host, port, database] = urlMatch;
    const encodedPassword = encodeURIComponent(password);

    // Convert direct IPv6 to pooled IPv4
    if (this.supabaseType === SupabaseConnectionTypes.DIRECT_IPV6) {
      const projectRef = host.replace('db.', '').replace('.supabase.co', '');
      const region = 'us-east-1'; // Default region
      const pooledHost = `aws-0-${region}.pooler.supabase.com`;
      const pooledUsername = `postgres.${projectRef}`;
      
      console.log(`🔄 Converting IPv6 direct connection to IPv4 pooled connection for migration...`);
      console.log(`   Project: ${projectRef}, Region: ${region} (default)`);
      
      return `postgresql://${pooledUsername}:${encodedPassword}@${pooledHost}:6543/${database}`;
    }

    // Switch session mode to transaction mode for migrations
    if (this.supabaseType === SupabaseConnectionTypes.POOLED_SESSION) {
      const regionMatch = host.match(/aws-0-([^.]+)\.pooler\.supabase\.com/);
      const region = regionMatch ? regionMatch[1] : 'us-east-1';
      
      console.log(`🔄 Switching to transaction mode (port 6543) for migration in region: ${region}`);
      return this.url.replace(':5432/', ':6543/').replace(`:${password}@`, `:${encodedPassword}@`);
    }

    // Already transaction mode, just encode password
    return this.url.replace(`:${password}@`, `:${encodedPassword}@`);
  }
}

class ErrorHandler {
  constructor(dbConfig) {
    this.dbConfig = dbConfig;
  }

  getErrorGuidance(errorMessage) {
    const errorType = this.detectErrorType(errorMessage);
    return this.getGuidanceForErrorType(errorType);
  }

  detectErrorType(errorMessage) {
    if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('getaddrinfo')) {
      return 'DNS_RESOLUTION';
    }
    if (errorMessage.includes('SASL') || errorMessage.includes('authentication')) {
      return 'AUTHENTICATION';
    }
    if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
      return 'TIMEOUT';
    }
    return 'GENERAL';
  }

  getGuidanceForErrorType(errorType) {
    const handlers = {
      DNS_RESOLUTION: () => this.getDnsResolutionGuidance(),
      AUTHENTICATION: () => this.getAuthenticationGuidance(),
      TIMEOUT: () => this.getTimeoutGuidance(),
      GENERAL: () => this.getGeneralGuidance()
    };

    return handlers[errorType]?.() || this.getGeneralGuidance();
  }

  getDnsResolutionGuidance() {
    if (this.dbConfig.provider !== DatabaseProviders.SUPABASE) {
      return `💡 Network connectivity issue detected:
   • Check your internet connection
   • Verify the database host is accessible from your network
   • Try using a different DNS server (8.8.8.8, 1.1.1.1)`;
    }

    if (this.dbConfig.supabaseType === SupabaseConnectionTypes.DIRECT_IPV6) {
      return `💡 Your Supabase connection uses IPv6 which is not supported on this platform.
   Solutions:
   1. Get the correct pooled connection string from your Supabase dashboard:
      • Go to Settings > Database
      • Look for "Connection pooling" section
      • Copy the "Session" mode connection string (port 5432)
      • Format: postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres
   2. If the region in your .dev.vars is wrong, update it with the correct regional pooler
   3. The auto-converted connection might have the wrong region - use the official one from dashboard`;
    }

    return `💡 The region in your pooled connection string might be incorrect.
   Solutions:
   1. Double-check the region in your Supabase dashboard (Settings > Database)
   2. Ensure you're using the correct regional pooler URL
   3. Try the direct connection string if your platform supports IPv6`;
  }

  getAuthenticationGuidance() {
    if (this.dbConfig.provider === DatabaseProviders.SUPABASE) {
      return `💡 This is likely due to special characters in your password.
   Solutions:
   1. URL encode your password in the connection string
   2. Or reset your database password to use only alphanumeric characters
   3. Check Supabase dashboard for the correct password`;
    }

    return `💡 Database authentication failed:
   • Double-check your username and password
   • Ensure your connection string is correct
   • Check if your IP is whitelisted (if applicable)`;
  }

  getTimeoutGuidance() {
    const guidance = [`💡 Database connection timed out:`];
    
    if (this.dbConfig.provider === DatabaseProviders.SUPABASE) {
      guidance.push(
        `   • Try using the transaction pooler (port 6543)`,
        `   • Check if your database is paused in Supabase dashboard`
      );
    }
    
    guidance.push(
      `   • Check your firewall and network settings`,
      `   • Try again in a few minutes`
    );

    return guidance.join('\n');
  }

  getGeneralGuidance() {
    const providerGuidance = {
      [DatabaseProviders.SUPABASE]: [
        '   • For Supabase: Ensure your database password is correct',
        '   • Try using the pooled connection (IPv4) instead of direct connection (IPv6)',
        '   • Use transaction mode (port 6543) for better serverless compatibility',
        '   • Check if special characters in password need URL encoding'
      ],
      [DatabaseProviders.NEON]: [
        '   • For Neon: Ensure your database is active (not suspended)',
        '   • Check if the connection string includes the correct password'
      ],
      [DatabaseProviders.OTHER]: [
        '   • Verify your DATABASE_URL is correct and the database is accessible',
        '   • Ensure the PostgreSQL server allows connections from your IP'
      ]
    };

    const guidance = providerGuidance[this.dbConfig.provider] || providerGuidance[DatabaseProviders.OTHER];
    return `💡 Troubleshooting tips:\n${guidance.join('\n')}`;
  }
}

// Main execution
async function main() {
  console.log('🔧 Running post-setup tasks...');

  try {
    // Validate required files
    validateRequiredFiles();
    
    // Load and validate database configuration
    const dbConfig = loadDatabaseConfig();
    console.log(`📊 Detected database provider: ${dbConfig.provider}`);
    
    if (dbConfig.supabaseType === SupabaseConnectionTypes.DIRECT_IPV6) {
      console.log('⚠️  Detected IPv6 direct connection - this may fail on some platforms');
    }

    // Install dependencies
    console.log('📦 Installing dependencies...');
    execSync('pnpm install', { cwd: projectRoot, stdio: 'inherit' });

    // Setup database schema
    await setupDatabaseSchema(dbConfig);

    printSuccessMessage();

  } catch (error) {
    handleError(error, loadDatabaseConfig());
  }
}

function validateRequiredFiles() {
  const requiredFiles = [
    'ui/src/lib/firebase-config.json',
    'server/.dev.vars'
  ];

  const missingFiles = requiredFiles.filter(file => {
    const filePath = join(projectRoot, file);
    return !fs.existsSync(filePath);
  });

  if (missingFiles.length > 0) {
    console.error(`❌ Required config files missing: ${missingFiles.join(', ')}`);
    process.exit(1);
  }
}

function loadDatabaseConfig() {
  const devVarsPath = join(projectRoot, 'server/.dev.vars');
  const devVarsContent = fs.readFileSync(devVarsPath, 'utf-8');
  
  const envVars = {};
  devVarsContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      envVars[key.trim()] = valueParts.join('=').trim();
    }
  });

  const databaseUrl = envVars.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not found in server/.dev.vars');
    process.exit(1);
  }

  return new DatabaseConfig(databaseUrl);
}

async function setupDatabaseSchema(dbConfig) {
  console.log('🗄️  Setting up database schema...');
  
  const migrationUrl = dbConfig.createOptimizedUrl();
  
  if (migrationUrl !== dbConfig.url) {
    console.log('📌 Using optimized connection for schema migration...');
  }
  
  const tempEnvPath = join(projectRoot, 'server', '.env.temp');
  
  try {
    fs.writeFileSync(tempEnvPath, `DATABASE_URL=${migrationUrl}\n`);
    
    execSync('npx dotenv-cli -e .env.temp -- pnpm db:push', { 
      cwd: join(projectRoot, 'server'), 
      stdio: 'inherit' 
    });
    
    console.log('✅ Database schema created successfully!');
  } finally {
    if (fs.existsSync(tempEnvPath)) {
      fs.unlinkSync(tempEnvPath);
    }
  }
}

function handleError(error, dbConfig) {
  const errorMessage = error.message || String(error);
  const errorHandler = new ErrorHandler(dbConfig);
  
  console.error('❌ Post-setup failed:', errorMessage);
  console.log('');
  console.log('🔍 Error Analysis');
  console.log('');
  console.log(errorHandler.getErrorGuidance(errorMessage));
  console.log('');
  console.log(`🛠️  Manual setup option:
   cd server && npx dotenv-cli -e .dev.vars -- pnpm db:push

📖 For more help, check:
   • Supabase: https://supabase.com/docs/guides/database/connecting-to-postgres
   • Neon: https://neon.tech/docs/connect/connect-intro`);
  
  process.exit(1);
}

function printSuccessMessage() {
  console.log(`✅ Post-setup complete!

🚀 Your app is ready! To start development:
   cd your-app-name
   pnpm run dev:start

📚 Need help? Check the README.md file`);
}

// Run the script
main().catch(console.error); 