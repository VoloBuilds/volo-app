import { existsSync, readFileSync } from 'fs';

const URL_PATTERNS = [
  /https:\/\/[^\s"'<>]+workers\.dev/gi,
  /Published\s+\S+\s+\((https:\/\/[^)]+)\)/i,
  /Deployed\s+\S+\s+(https:\/\/[^\s]+)/i,
  /(https:\/\/[^\s"'<>]+\.workers\.dev)/gi,
];

/**
 * Read worker name from wrangler.toml for error hints when URL parsing fails.
 * @param {string|undefined} wranglerTomlPath
 * @returns {string|null}
 */
export function readWranglerWorkerName(wranglerTomlPath) {
  if (!wranglerTomlPath || !existsSync(wranglerTomlPath)) {
    return null;
  }

  const content = readFileSync(wranglerTomlPath, 'utf-8');
  const nameMatch = content.match(/^name\s*=\s*["']([^"']+)["']/m);
  return nameMatch ? nameMatch[1] : null;
}

/**
 * Parse the deployed Worker URL from Wrangler deploy output.
 * @param {string} output
 * @returns {string|null}
 */
export function parseWranglerDeployUrl(output) {
  for (const pattern of URL_PATTERNS) {
    const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
    const globalPattern = new RegExp(pattern.source, flags);
    const matches = [...output.matchAll(globalPattern)];

    for (const match of matches) {
      const url = match[1] ?? match[0];
      if (url && url.includes('workers.dev')) {
        return url.replace(/[)\],.;]+$/, '');
      }
    }
  }

  return null;
}
