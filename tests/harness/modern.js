// The refactored modules behind the same API as tests/harness/legacy.js: every exported name of
// every extracted module, merged into one object. A suite runs against the refactored code once
// all the modules it needs exist (pass them as `modules`).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { vi } from 'vitest';
import { ROOT } from './paths.js';

const ORIGINAL_SAMPLE_HABITS = path.join(ROOT, 'tests/harness/original-sample-habits.js');

const exists = m => fs.existsSync(path.join(ROOT, 'src', `${m}.js`));

/** Every module under src/ except the entry point. */
function allModules(dir = path.join(ROOT, 'src')) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) return allModules(p);
        const rel = path.relative(path.join(ROOT, 'src'), p).split(path.sep).join('/').replace(/\.js$/, '');
        return e.name.endsWith('.js') && rel !== 'main' ? [rel] : [];
    });
}

// Only the pure layers (and the pure HTML string helpers) are loaded into the API.
const API_LAYERS = ['config/', 'core/', 'store/', 'ui/dom/html'];

export async function loadModern({ fresh = false, modules = [] } = {}) {
    const available = allModules().filter(m => API_LAYERS.some(l => m.startsWith(l)));
    if (!available.length || !modules.every(exists)) return null;
    if (fresh) vi.resetModules();
    const api = {};
    for (const m of available) {
        const mod = await import(/* @vite-ignore */ pathToFileURL(path.join(ROOT, 'src', `${m}.js`)).href);
        Object.assign(api, mod);
    }
    // Compared with the original, the refactored code starts from the original's sample habits
    // (the app's own sample data has moved on and has its own tests).
    const original = await import(/* @vite-ignore */ pathToFileURL(ORIGINAL_SAMPLE_HABITS).href);
    api.getDefaultHabits = original.getDefaultHabits;
    return api;
}
