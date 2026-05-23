#!/usr/bin/env node

/**
 * Periodic Firebase Emulator Backup Script
 * 
 * This script runs alongside the Firebase emulator and automatically exports
 * data every 60 seconds to prevent data loss during crashes or forced shutdowns.
 * 
 * Uses the Firebase Emulator Hub REST API to trigger exports while running.
 */

import { setTimeout as sleep } from 'timers/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKUP_INTERVAL = 60000; // 60 seconds
const EMULATOR_HUB_PORT = 4400; // Default Firebase Emulator Hub port
const EXPORT_PATH = './data/firebase-emulator';

let backupCount = 0;
let isBackupRunning = false;

/**
 * Export emulator data via REST API
 */
async function exportEmulatorData() {
  if (isBackupRunning) {
    console.log('⏳ Backup already in progress, skipping...');
    return;
  }

  try {
    isBackupRunning = true;
    backupCount++;

    // Use Firebase CLI to export emulator data
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    const command = `firebase emulators:export ${EXPORT_PATH} --project demo-project --force`;
    
    const { stdout, stderr } = await execAsync(command, {
      cwd: path.join(__dirname, '..'),
      timeout: 30000 // 30 second timeout
    });

    if (stderr && !stderr.includes('Warning')) {
      console.warn(`⚠️  Backup warning: ${stderr}`);
    }

    console.log(`💾 Emulator data backed up (#${backupCount}) - ${new Date().toISOString()}`);
  } catch (error) {
    // Don't log connection errors during startup - emulator might not be ready yet
    if (backupCount > 2) {
      console.warn(`⚠️  Backup failed: ${error}`);
    }
  } finally {
    isBackupRunning = false;
  }
}

/**
 * Check if emulator hub is running
 */
async function isEmulatorRunning() {
  try {
    const response = await fetch(`http://localhost:${EMULATOR_HUB_PORT}/emulators`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Main backup loop
 */
async function startPeriodicBackup() {
  console.log('🔄 Starting periodic Firebase emulator backup (every 60s)...');

  // Wait for emulator to be ready
  console.log('⏳ Waiting for Firebase emulator to start...');
  while (!(await isEmulatorRunning())) {
    await sleep(2000); // Check every 2 seconds
  }

  console.log('✅ Firebase emulator detected, starting periodic backups');

  // Start periodic backups
  while (true) {
    await exportEmulatorData();
    await sleep(BACKUP_INTERVAL);
  }
}

/**
 * Handle graceful shutdown
 */
function setupShutdownHandlers() {
  const shutdown = () => {
    console.log('\n🛑 Stopping periodic backup...');
    process.exit(0);
  };

  const signals = process.platform === 'win32'
    ? ['SIGINT', 'SIGTERM', 'SIGBREAK']
    : ['SIGINT', 'SIGTERM'];

  signals.forEach(signal => {
    process.on(signal, shutdown);
  });
}

// Start the backup process
if (import.meta.url === `file://${process.argv[1]}`) {
  setupShutdownHandlers();
  startPeriodicBackup().catch((error) => {
    console.error('❌ Periodic backup failed:', error);
    process.exit(1);
  });
}

export { exportEmulatorData }; 