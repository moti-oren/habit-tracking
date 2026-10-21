// The original <style> block was split into src/styles/*.css plus the inline skeleton CSS in
// index.html. Parsed rule by rule, the result must equal the original, apart from the documented
// changes listed below.
import { describe, expect, it } from 'vitest';
import postcss from 'postcss';
import { INDEX_FILE, legacyParts, read } from '../harness/paths.js';
import { checkTailwindClasses } from '../../scripts/check-tailwind-classes.mjs';

// The order main.css imports them in
const STYLE_FILES = ['tokens', 'base', 'components', 'animations', 'reduced-motion', 'overrides'].map(
    name => `src/styles/${name}.css`
);

// Whitespace runs and the choice of quote character carry no meaning in CSS (Prettier normalized both).
const norm = s => s.replace(/\s+/g, ' ').replace(/"/g, "'").trim();

/** Every rule as "<at-rule chain> | <selector> | <declarations>", in source order. */
function rulesOf(css) {
    const out = [];
    postcss.parse(css).walkRules(rule => {
        const chain = [];
        for (let p = rule.parent; p && p.type === 'atrule'; p = p.parent) chain.unshift(`@${p.name} ${norm(p.params)}`);
        const decls = rule.nodes
            .filter(n => n.type === 'decl')
            .map(d => `${d.prop}: ${norm(d.value)}${d.important ? ' !important' : ''}`);
        out.push(`${chain.join(' ')} | ${norm(rule.selector)} | ${decls.join('; ')}`);
    });
    return out;
}

describe('custom CSS', () => {
    const original = rulesOf(legacyParts().style);
    const inline = read(INDEX_FILE).match(/<style>([\s\S]*?)<\/style>/)[1];
    const ported = [...rulesOf(inline), ...STYLE_FILES.flatMap(f => rulesOf(read(f)))];

    // Documented in REFACTOR_NOTES.md: `.ring-progress` is not used anywhere, so its rules are gone.
    const expectedOriginal = original
        .filter(r => !r.includes('| .ring-progress |'))
        .map(r => r.replace('| .bar-fill, .ring-progress |', '| .bar-fill |'));

    it('has exactly the original rules (as a multiset)', () => {
        expect([...ported].sort()).toEqual([...expectedOriginal].sort());
    });

    it('keeps the original order inside each file', () => {
        const position = new Map(expectedOriginal.map((r, i) => [r, i]));
        for (const file of STYLE_FILES) {
            const idx = rulesOf(read(file)).map(r => position.get(r));
            expect(idx).toEqual([...idx].sort((a, b) => a - b));
        }
    });

    it('puts the reduced-motion overrides after every rule they override, and overrides.css after them', () => {
        const before = ['tokens', 'base', 'components', 'animations'].flatMap(n =>
            rulesOf(read(`src/styles/${n}.css`))
        );
        const reduced = rulesOf(read('src/styles/reduced-motion.css'));
        const after = rulesOf(read('src/styles/overrides.css'));
        expect(before.some(r => r.startsWith('@media (prefers-reduced-motion'))).toBe(false);
        expect(reduced.every(r => r.startsWith('@media (prefers-reduced-motion: reduce)'))).toBe(true);
        expect(after.some(r => r.startsWith(' | .bar-fill |'))).toBe(true);
    });

    it('loads the custom rules before Tailwind, like the CDN did', () => {
        const main = read('src/styles/main.css');
        const lastImport = main.lastIndexOf('@import');
        expect(lastImport).toBeGreaterThan(-1);
        expect(main.indexOf('@tailwind base')).toBeGreaterThan(lastImport);
    });
});

describe('Tailwind classes', () => {
    it('generates every rule the original app generated, unchanged', async () => {
        const { missing, changed } = await checkTailwindClasses();
        expect(missing).toEqual([]);
        expect(changed).toEqual([]);
    });
});
