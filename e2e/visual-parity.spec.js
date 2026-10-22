// Visual parity: the ORIGINAL file and the single-file build, both opened from file://, side by
// side in two browser contexts (separate storage) with the same fixed clock, time zone, viewport
// and colour scheme. Through every state below, each element's computed style (including
// ::before, ::after and ::placeholder) must be identical, and so must screenshots of the viewport.
import { test, expect } from '@playwright/test';
import {
    ORIGINAL_URL,
    SINGLE_FILE_URL,
    VIEWPORTS,
    collectStyles,
    comparePng,
    openApp,
    originalStartingStorage,
    settle,
    styleDetails
} from './helpers.js';
import { STEPS } from './steps.js';

const VARIANTS = [
    ['desktop', 'light'],
    ['desktop', 'dark'],
    ['mobile', 'light'],
    ['mobile', 'dark']
];

for (const [vp, scheme] of VARIANTS) {
    test(`original vs refactored (${vp}, ${scheme})`, async ({ browser }) => {
        // both start from the original's sample data (the app's own has moved on)
        const storage = await originalStartingStorage(browser);
        const opts = { viewport: VIEWPORTS[vp], colorScheme: scheme, storage };
        const original = await openApp(browser, ORIGINAL_URL, opts);
        const refactored = await openApp(browser, SINGLE_FILE_URL, opts);
        const failures = [];
        try {
            for (const [name, run] of STEPS) {
                for (const app of [original, refactored]) {
                    await run(app.page);
                    await settle(app.page);
                }
                const [a, b] = [await collectStyles(original.page), await collectStyles(refactored.page)];
                if (b.length !== a.length) {
                    const i = a.findIndex((x, k) => !b[k] || x[0] !== b[k][0] || x[1] !== b[k][1] || x[3] !== b[k][3]);
                    const show = (list, k) =>
                        list
                            .slice(Math.max(0, k - 2), k + 3)
                            .map(x => `${x[0]} ${x[1]} ${x[3]}`)
                            .join(' | ');
                    throw new Error(`${name}: ${a.length} elements vs ${b.length}; first difference:
  original:   ${show(a, i)}
  refactored: ${show(b, i)}`);
                }
                const differing = a.filter((x, i) => x[0] !== b[i][0] || x[1] !== b[i][1] || x[2] !== b[i][2]);
                for (const [elPath] of differing.slice(0, 3)) {
                    const [da, db] = [
                        await styleDetails(original.page, elPath),
                        await styleDetails(refactored.page, elPath)
                    ];
                    const props = [];
                    for (const part of ['self', 'before', 'after', 'placeholder']) {
                        for (const k of Object.keys(da[part])) {
                            if (da[part][k] !== db[part][k])
                                props.push(`${part} ${k}: "${da[part][k]}" vs "${db[part][k]}"`);
                        }
                    }
                    failures.push(`[${name}] ${da.desc} (${elPath}): ${props.slice(0, 6).join('; ')}`);
                }
                if (differing.length > 3) failures.push(`[${name}] … and ${differing.length - 3} more elements`);
                // viewport screenshots: a full-page one resizes the viewport, which (rightly) closes open lists
                const shot = p => p.screenshot({ animations: 'disabled', caret: 'hide' });
                const { diff, size } = comparePng(
                    await shot(original.page),
                    await shot(refactored.page),
                    `${vp}-${scheme}-${name.replace(/[^\w]+/g, '_')}`
                );
                if (diff) failures.push(`[${name}] screenshots differ: ${diff} pixels (${size}); see e2e/.artifacts`);
            }
            expect(refactored.errors, 'errors in the refactored app').toEqual([]);
            expect(original.errors, 'errors in the original app').toEqual([]);
            expect(failures.join('\n')).toBe('');
        } finally {
            await original.context.close();
            await refactored.context.close();
        }
    });
}
