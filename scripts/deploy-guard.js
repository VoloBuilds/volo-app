#!/usr/bin/env node

import { spawnSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseWranglerDeployUrl } from './parse-wrangler-deploy-url.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

const NOT_CONFIGURED_MESSAGE = `Deployment is not configured.

Run: pnpm connect:deploy

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

function writeProductionApiUrl(apiUrl) {
  const envPath = path.join(rootDir, 'ui', '.env.production');
  const content = `# Production API URL (auto-written by pnpm run deploy)\nVITE_API_URL=${apiUrl}\n`;
  writeFileSync(envPath, content);
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

function main() {
  if (!isDeployConfigured()) {
    console.error(NOT_CONFIGURED_MESSAGE);
    process.exit(1);
  }

  const deployOutput = runServerDeploy();
  const apiUrl = parseWranglerDeployUrl(deployOutput);

  if (!apiUrl) {
    console.error(`API deployed but could not detect the Worker URL from Wrangler output.

Set VITE_API_URL in ui/.env.production manually, then run:
  pnpm --filter ui run deploy`);
    process.exit(1);
  }

  writeProductionApiUrl(apiUrl);
  runUiDeploy(apiUrl);
}

main();
