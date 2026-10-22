// Builds the refactored app with the project's real Vite config (production mode, minified) and
// returns the JS chunk, so the DOM parity tests run exactly what ships.
// PARITY_UNMINIFIED=1 builds without minification, for readable stack traces while debugging.
//
// One module is swapped: the sample habits are the original app's (see original-sample-habits.js),
// so a fresh start or "reset to sample data" gives both apps the same data.
import path from 'node:path';
import { build } from 'vite';
import { ROOT } from './paths.js';

const ORIGINAL_SAMPLE_HABITS = path.join(ROOT, 'tests/harness/original-sample-habits.js');

let cached = null;

export function buildModernBundle() {
    if (!cached) {
        cached = (async () => {
            const result = await build({
                root: ROOT,
                logLevel: 'silent',
                resolve: { alias: [{ find: /^.*\/store\/sample-habits\.js$/, replacement: ORIGINAL_SAMPLE_HABITS }] },
                build: {
                    write: false,
                    emptyOutDir: false,
                    ...(process.env.PARITY_UNMINIFIED ? { minify: false } : {})
                }
            });
            const outputs = (Array.isArray(result) ? result : [result]).flatMap(r => r.output);
            const entry = outputs.find(o => o.type === 'chunk' && o.isEntry);
            if (!entry) throw new Error('modern bundle: no entry chunk');
            const html = outputs.find(o => o.type === 'asset' && o.fileName === 'index.html');
            return { code: entry.code, html: html ? String(html.source) : null };
        })();
    }
    return cached;
}
