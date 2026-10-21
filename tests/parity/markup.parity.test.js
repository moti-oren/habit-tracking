// index.html must carry the original <body> markup byte for byte (minus the inline app script,
// which now lives in src/). Whitespace between inline elements renders, so nothing is reformatted.
import { describe, expect, it } from 'vitest';
import { INDEX_FILE, legacyParts, read } from '../harness/paths.js';

describe('index.html markup', () => {
    const legacy = legacyParts();
    const index = read(INDEX_FILE);

    it('keeps the original <body> byte for byte', () => {
        const legacyBody = legacy.body.replace(/\n\s*<script>[\s\S]*?<\/script>\n/, '\n');
        const indexBody = index.match(/<body[\s\S]*<\/body>/)[0];
        expect(indexBody).toBe(legacyBody);
    });

    it('keeps the pre-paint theme script inline and unchanged', () => {
        const original = legacy.html.match(/<script>\s*\/\/ Set the theme[\s\S]*?<\/script>/)[0];
        expect(index).toContain(original);
    });

    it('keeps the head metadata and fonts', () => {
        for (const tag of [
            '<html lang="he" dir="rtl">',
            '<meta charset="UTF-8">',
            '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">',
            '<title>מעקב הרגלים — לוח בקרה יומי ושבועי</title>',
            '<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;600;700&display=swap" rel="stylesheet">'
        ]) {
            expect(index).toContain(tag);
        }
    });

    it('no longer loads the Tailwind CDN', () => {
        expect(index).not.toContain('cdn.tailwindcss.com');
        expect(index).not.toContain('tailwind.config');
    });
});
