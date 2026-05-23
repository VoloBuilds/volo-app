#!/usr/bin/env node

import { spawnSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseWranglerDeployUrl, readWranglerWorkerName } from './parse-wrangler-deploy-url.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

const NOT_CONFIGURED_MESSAGE = `UI deployment is not configured yet (missing ui/wrangler.toml or a deploy script in ui/package.json).

Run: pnpm connect:deploy

This adds the UI Wrangler config and deploy script.

Or create the project with --deploy or a volo-config.json deploy section.`;

function isDeployConfigured() {
  const uiWranglerPath = path.join(rootDir, 'ui', 'wrangler.toml');
  if (!existsSync(uiWranglerPath)) {
    return false;
  }

  const uiPackageJsonPath = path.join(rootDir, 'ui', 'package.json');
  if (!existsSync(uiPackageJsonPath)) {
    return false;
  }

  const packageJson = JSON.parse(readFileSync(uiPackageJsonPath, 'utf-8'));
  return Boolean(packageJson.scripts?.deploy);
}

function upsertEnvVar(envPath, key, value) {
  const line = `${key}=${value}`;

  if (!existsSync(envPath)) {
    writeFileSync(envPath, `# Production API URL (auto-written by pnpm run deploy)\n${line}\n`);
    return;
  }

  const content = readFileSync(envPath, 'utf-8');
  const regex = new RegExp(`^${key}=.*$`, 'm');

  if (regex.test(content)) {
    writeFileSync(envPath, content.replace(regex, line));
    return;
  }

  const trimmed = content.trimEnd();
  writeFileSync(envPath, `${trimmed}${trimmed ? '\n' : ''}${line}\n`);
}

function writeProductionApiUrl(apiUrl) {
  upsertEnvVar(path.join(rootDir, 'ui', '.env.production'), 'VITE_API_URL', apiUrl);
}

function runServerDeploy() {
  const result = spawnSync('pnpm', ['--filter', 'server', 'run', 'deploy'], {
    cwd: rootDir,
    encoding: 'utf-8',
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  return `${result.stdout || ''}${result.stderr || ''}`;
}

function runUiDeploy(apiUrl) {
  const result = spawnSync('pnpm', ['--filter', 'ui', 'run', 'deploy'], {
    cwd: rootDir,
    encoding: 'utf-8',
    env: { ...process.env, VITE_API_URL: apiUrl },
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  if (result.status !== 0) {
    const output = `${result.stdout || ''}${result.stderr || ''}`;
    if (output.includes('VITE_API_URL')) {
      console.error('\nHint: Production builds use ui/.env.production, not ui/.env.local.');
      console.error('Run pnpm run deploy from the project root, or set VITE_API_URL in ui/.env.production.');
    }
    process.exit(result.status ?? 1);
  }
}

function printUrlDetectionFailure(deployOutput) {
  const serverWranglerPath = path.join(rootDir, 'server', 'wrangler.toml');
  const workerName = readWranglerWorkerName(serverWranglerPath);

  console.error('API deployed but could not detect the Worker URL from Wrangler output.');
  console.error('');
  console.error('What to do next:');
  console.error('  1. Find your Worker URL in the Wrangler output above (look for *.workers.dev).');
  if (workerName) {
    console.error(`  2. Your server worker name is "${workerName}" — the URL is usually https://${workerName}.<account>.workers.dev`);
  } else {
    console.error('  2. Check the Cloudflare dashboard for your Worker URL.');
  }
  console.error('  3. Set VITE_API_URL in ui/.env.production to that URL.');
  console.error('  4. Deploy the UI: pnpm --filter ui run deploy');
  console.error('');
  console.error('If Wrangler changed its output format, please report it so URL detection can be updated.');

  if (process.env.DEBUG && deployOutput) {
    console.error('\n--- Wrangler output (debug) ---');
    console.error(deployOutput.slice(-2000));
  }
}

function main() {
  if (!isDeployConfigured()) {
    console.error(NOT_CONFIGURED_MESSAGE);
    process.exit(1);
  }

  const deployOutput = runServerDeploy();
  const apiUrl = parseWranglerDeployUrl(deployOutput);

  if (!apiUrl) {
    printUrlDetectionFailure(deployOutput);
    process.exit(1);
  }

  writeProductionApiUrl(apiUrl);
  runUiDeploy(apiUrl);
}

main();
