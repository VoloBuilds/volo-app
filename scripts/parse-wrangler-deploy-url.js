/**
 * Parse the deployed Worker URL from Wrangler deploy output.
 * @param {string} output
 * @returns {string|null}
 */
export function parseWranglerDeployUrl(output) {
  const match = output.match(/https:\/\/[^\s]+workers\.dev/);
  return match ? match[0] : null;
}
