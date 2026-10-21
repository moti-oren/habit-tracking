import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const LEGACY_FILE = path.join(ROOT, 'legacy/habit_tracker_dashboard.html');
export const INDEX_FILE = path.join(ROOT, 'index.html');

export const read = rel => fs.readFileSync(path.isAbsolute(rel) ? rel : path.join(ROOT, rel), 'utf8');

/** The original page, split into the parts the tests need. */
export function legacyParts() {
    const html = read(LEGACY_FILE);
    const style = html.match(/<style>([\s\S]*?)<\/style>/)[1];
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
    const appScript = scripts[scripts.length - 1];
    const body = html.match(/<body[\s\S]*<\/body>/)[0];
    return { html, style, appScript, body };
}
