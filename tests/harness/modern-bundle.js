// Builds the refactored app with the project's real Vite config (production mode, minified) and
// returns the JS chunk, so the DOM parity tests run exactly what ships.
// PARITY_UNMINIFIED=1 builds without minification, for readable stack traces while debugging.
import { build } from 'vite';
import { ROOT } from './paths.js';

let cached = null;

export function buildModernBundle() {
    if (!cached) {
        cached = (async () => {
            const result = await build({
                root: ROOT,
                logLevel: 'silent',
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
