import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const out = path.join(root, 'src/lib/firebase-config.json');
const template = path.join(root, 'src/lib/firebase-config.template.json');

if (!fs.existsSync(out)) {
  fs.copyFileSync(template, out);
  console.warn('[ui] Created src/lib/firebase-config.json from template (run post-setup to fill real values).');
}
