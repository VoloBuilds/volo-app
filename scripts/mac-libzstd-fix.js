#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = dirname(__dirname);

/**
 * Mac libzstd compatibility fix utilities
 * Automatically detects and resolves missing libzstd.1.dylib issues on macOS
 */

/**
 * Detect if the embedded postgres binary will fail due to missing libzstd
 */
export async function detectLibzstdIssue() {
  if (process.platform !== 'darwin') return false;
  
  try {
    // Try to find the embedded postgres binary
    const postgresPath = join(projectRoot, 'node_modules/.pnpm/@embedded-postgres+darwin-arm64@17.5.0-beta.15/node_modules/@embedded-postgres/darwin-arm64/native/bin/postgres');
    
    if (!existsSync(postgresPath)) {
      // Try to find it dynamically
      const searchPaths = [
        'node_modules/.pnpm/@embedded-postgres+darwin-arm64@*/node_modules/@embedded-postgres/darwin-arm64/native/bin/postgres',
        'node_modules/.pnpm/@embedded-postgres+darwin-x64@*/node_modules/@embedded-postgres/darwin-x64/native/bin/postgres'
      ];
      
      for (const searchPath of searchPaths) {
        try {
          const result = execSync(`find ${projectRoot} -path "*${searchPath.replace('*', '*')}" 2>/dev/null | head -1`, { encoding: 'utf8' });
          if (result.trim()) {
            return await testPostgresBinary(result.trim());
          }
        } catch (e) {
          // Continue searching
        }
      }
      return false;
    }
    
    return await testPostgresBinary(postgresPath);
  } catch (error) {
    return false;
  }
}

/**
 * Test if a postgres binary fails due to libzstd issues
 */
async function testPostgresBinary(binaryPath) {
  try {
    execSync(`"${binaryPath}" --version 2>/dev/null`, { timeout: 5000 });
    return false; // Binary works fine
  } catch (error) {
    const errorOutput = error.stderr?.toString() || error.message || '';
    return errorOutput.includes('libzstd.1.dylib');
  }
}

/**
 * Automatically download and install libzstd for embedded postgres
 */
export async function downloadLibzstd() {
  console.log('🔧 Detecting Mac architecture and downloading libzstd...');
  
  // Detect architecture
  const arch = process.arch === 'arm64' ? 'arm64' : 'x86_64';
  const isAppleSilicon = arch === 'arm64';
  
  console.log(`📱 Detected ${isAppleSilicon ? 'Apple Silicon (ARM64)' : 'Intel (x86_64)'} Mac`);
  
  // Create lib directory structure
  const libDirs = [];
  
  // Find all embedded postgres installations and create lib dirs for each
  try {
    const searchResult = execSync(`find ${projectRoot} -path "*/node_modules/@embedded-postgres/darwin-*/native/bin" -type d 2>/dev/null`, { encoding: 'utf8' });
    const binDirs = searchResult.trim().split('\n').filter(Boolean);
    
    for (const binDir of binDirs) {
      const libDir = join(dirname(binDir), 'lib');
      libDirs.push(libDir);
      
      if (!existsSync(libDir)) {
        await mkdir(libDir, { recursive: true });
        console.log(`📁 Created lib directory: ${libDir}`);
      }
    }
  } catch (error) {
    console.log('⚠️ Could not auto-detect embedded postgres paths, using fallback...');
    // Fallback: create standard paths
    const standardPaths = [
      join(projectRoot, 'node_modules/.pnpm/@embedded-postgres+darwin-arm64@17.5.0-beta.15/node_modules/@embedded-postgres/darwin-arm64/native/lib'),
      join(projectRoot, 'node_modules/.pnpm/@embedded-postgres+darwin-x64@17.5.0-beta.15/node_modules/@embedded-postgres/darwin-x64/native/lib')
    ];
    
    for (const libPath of standardPaths) {
      try {
        await mkdir(libPath, { recursive: true });
        libDirs.push(libPath);
      } catch (e) {
        // Directory may not exist, that's ok
      }
    }
  }
  
  if (libDirs.length === 0) {
    throw new Error('Could not find or create lib directories for embedded postgres');
  }
  
  const libzstdFilename = 'libzstd.1.dylib';
  
  // Try to find libzstd locally first (if user has Homebrew)
  const localPaths = [
    '/opt/homebrew/lib/libzstd.1.dylib',     // Apple Silicon Homebrew
    '/usr/local/lib/libzstd.1.dylib',        // Intel Homebrew
    '/opt/homebrew/Cellar/zstd/*/lib/libzstd.1.dylib', // Versioned path
    '/usr/local/Cellar/zstd/*/lib/libzstd.1.dylib'     // Versioned path
  ];
  
  let sourcePath = null;
  for (const path of localPaths) {
    if (path.includes('*')) {
      // Handle glob patterns
      try {
        const result = execSync(`ls ${path} 2>/dev/null | head -1`, { encoding: 'utf8' });
        if (result.trim()) {
          sourcePath = result.trim();
          break;
        }
      } catch (e) {
        continue;
      }
    } else if (existsSync(path)) {
      sourcePath = path;
      break;
    }
  }
  
  if (sourcePath) {
    console.log(`📦 Found local libzstd at: ${sourcePath}`);
    
    // Copy to all lib directories
    for (const libDir of libDirs) {
      const targetPath = join(libDir, libzstdFilename);
      try {
        // Use cp command to preserve permissions and links
        execSync(`cp "${sourcePath}" "${targetPath}"`);
        console.log(`✅ Copied libzstd to: ${targetPath}`);
      } catch (error) {
        console.log(`⚠️ Failed to copy to ${targetPath}: ${error.message}`);
      }
    }
    
    return true;
  }
  
  // If not found locally, try to install via Homebrew and then copy
  console.log('📥 libzstd not found locally, attempting to install via Homebrew...');
  
  try {
    // Check if Homebrew is installed
    execSync('which brew', { stdio: 'pipe' });
    
    // Try to install zstd
    console.log('🍺 Installing zstd via Homebrew...');
    execSync('brew install zstd', { stdio: 'pipe' });
    
    // Try to find it again
    for (const path of localPaths) {
      if (path.includes('*')) {
        try {
          const result = execSync(`ls ${path} 2>/dev/null | head -1`, { encoding: 'utf8' });
          if (result.trim()) {
            sourcePath = result.trim();
            break;
          }
        } catch (e) {
          continue;
        }
      } else if (existsSync(path)) {
        sourcePath = path;
        break;
      }
    }
    
    if (sourcePath) {
      for (const libDir of libDirs) {
        const targetPath = join(libDir, libzstdFilename);
        try {
          execSync(`cp "${sourcePath}" "${targetPath}"`);
          console.log(`✅ Copied libzstd to: ${targetPath}`);
        } catch (error) {
          console.log(`⚠️ Failed to copy to ${targetPath}: ${error.message}`);
        }
      }
      return true;
    }
  } catch (error) {
    console.log('⚠️ Homebrew not available or zstd installation failed');
  }
  
  // Last resort: provide manual instructions
  console.log('');
  console.log('🔧 Manual libzstd setup required:');
  console.log('');
  console.log('1. Install Homebrew if not already installed:');
  console.log('   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"');
  console.log('');
  console.log('2. Install zstd:');
  console.log('   brew install zstd');
  console.log('');
  console.log('3. Rerun the setup:');
  console.log('   pnpm post-setup');
  
  return false;
}

/**
 * Enhanced Mac-specific error handling for embedded postgres issues
 */
export function provideMacTroubleshootingGuidance(error, dataDir) {
  console.log('');
  console.log('🍎 Mac Troubleshooting:');
  
  // Check for specific libzstd error
  if (error.message?.includes('libzstd.1.dylib')) {
    console.log('  ❌ libzstd library missing (this should have been auto-fixed)');
    console.log('  🔧 Manual fix:');
    console.log('     1. Install Homebrew if needed');
    console.log('     2. brew install zstd');
    console.log('     3. Retry: pnpm post-setup');
  } else if (error.message?.includes('init script exited with code null') || error.message?.includes('initdb')) {
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
    console.log(`     ${dataDir}`);
    console.log('  4. Try restarting the terminal and running again');
  }
} 