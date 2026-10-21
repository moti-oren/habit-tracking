// Proves that no Tailwind class silently disappears from the build.
//
// Tailwind is compiled twice with the project config: once with the original single-file app
// (legacy/habit_tracker_dashboard.html, markup and JS) as its only content, and once with the
// project's real content globs. Every rule the original produces must also be produced by the
// project, with the same declarations. Extra rules are fine: they only exist for tokens that
// appear in the source, and an element can only pick them up by using that class.
//
// Usage: node scripts/check-tailwind-classes.mjs   (exit code 1 on any missing class)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import config from '../tailwind.config.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LEGACY = path.join(ROOT, 'legacy/habit_tracker_dashboard.html');
const INPUT = '@tailwind base; @tailwind components; @tailwind utilities;';

export async function compileRules(content) {
    const { root } = await postcss([tailwindcss({ ...config, content })]).process(INPUT, { from: undefined });
    const rules = new Map(); // "<at-rule chain> <selector>" -> declarations
    root.walkRules(rule => {
        const chain = [];
        for (let p = rule.parent; p && p.type === 'atrule'; p = p.parent) chain.unshift(`@${p.name} ${p.params}`);
        if (chain.some(c => c.startsWith('@keyframes'))) return;
        const key = `${chain.join(' ')} ${rule.selector}`.trim();
        const decls = [];
        rule.walkDecls(d => decls.push(`${d.prop}:${d.value}${d.important ? '!important' : ''}`));
        rules.set(key, (rules.get(key) || '') + decls.join(';'));
    });
    return rules;
}

export async function checkTailwindClasses() {
    // The CDN only read class attributes from the DOM, so the original's <style> text (CSS property
    // names such as `flex-shrink` or `antialiased`) is not content; its markup and JS are.
    const legacyHtml = fs.readFileSync(LEGACY, 'utf8').replace(/<style>[\s\S]*?<\/style>/g, '');
    const original = await compileRules([{ raw: legacyHtml, extension: 'html' }]);
    const project = await compileRules({ relative: false, files: config.content.files.map(f => path.join(ROOT, f)) });
    const missing = [];
    const changed = [];
    for (const [key, decls] of original) {
        if (!project.has(key)) missing.push(key);
        else if (project.get(key) !== decls) changed.push(key);
    }
    return { original: original.size, project: project.size, missing, changed };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const { original, project, missing, changed } = await checkTailwindClasses();
    console.log(`Tailwind rules from the original app: ${original}; from the project: ${project}`);
    if (missing.length || changed.length) {
        missing.forEach(k => console.error(`missing: ${k}`));
        changed.forEach(k => console.error(`different declarations: ${k}`));
        process.exit(1);
    }
    console.log('OK: every Tailwind rule of the original app is in the build, unchanged.');
}
