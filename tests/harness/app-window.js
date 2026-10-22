// Runs a whole app (the ORIGINAL file, or the refactored build) in its own jsdom window with its
// own fake clock and localStorage, and drives it like a user would.
//
//   const app = await createApp('legacy' | 'modern', { now, storage });
//   app.click('[data-action="newHabit"]'); await app.settle();
//   takeSnapshot(app)  (see snapshot.js)
//
// Both apps get the same window size, the same polyfills, the same clock and the same events, so
// any difference in what they render or store is a difference in the code.
import { JSDOM, VirtualConsole } from 'jsdom';
import FakeTimers from '@sinonjs/fake-timers';
import { legacyParts } from './paths.js';
import { installDomPolyfills } from './dom-polyfills.js';
import { buildModernBundle } from './modern-bundle.js';
import { INTRO_SEEN_KEY } from '../../src/config/storage-keys.js';

const TO_FAKE = [
    'setTimeout',
    'clearTimeout',
    'setInterval',
    'clearInterval',
    'Date',
    'requestAnimationFrame',
    'cancelAnimationFrame',
    'performance'
];
const THEME_SCRIPT_MARK = 'Set the theme before anything paints';

/** Splits an HTML page into markup without scripts/styles, and its pre-paint theme script. */
function preparePage(html) {
    const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)];
    const theme = scripts.find(m => m[1].includes(THEME_SCRIPT_MARK));
    if (!theme) throw new Error('page: pre-paint theme script not found');
    const markup = html
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, '')
        .replace(/<link\b[^>]*>/g, '');
    return { markup, themeScript: theme[1] };
}

async function sources(kind) {
    if (kind === 'legacy') {
        const { html, appScript } = legacyParts();
        return { ...preparePage(html), appCode: appScript };
    }
    const bundle = await buildModernBundle();
    // A module is strict and has its own scope: evaluate the chunk the same way.
    return { ...preparePage(bundle.html), appCode: `(function () {\n'use strict';\n${bundle.code}\n})();` };
}

const fmt = arg => {
    if (typeof arg === 'string') return arg;
    if (arg && typeof arg === 'object' && 'message' in arg) return `${arg.name}: ${arg.message}`;
    try {
        return JSON.stringify(arg);
    } catch {
        return String(arg);
    }
};

export async function createApp(kind, { now, storage = {}, beforeBoot } = {}) {
    const { markup, themeScript, appCode } = await sources(kind);
    const consoleLog = [];
    const errors = [];
    const virtualConsole = new VirtualConsole();
    for (const method of ['log', 'info', 'warn', 'error', 'debug']) {
        virtualConsole.on(method, (...args) => consoleLog.push(`${method}: ${args.map(fmt).join(' ')}`));
    }
    virtualConsole.on('jsdomError', e => errors.push(e));

    const dom = new JSDOM(markup, {
        url: 'http://localhost/',
        pretendToBeVisual: true,
        runScripts: 'outside-only',
        virtualConsole
    });
    const { window } = dom;
    const { document } = window;
    installDomPolyfills(window);
    const clock = FakeTimers.withGlobal(window).install({
        now,
        toFake: TO_FAKE,
        shouldClearNativeTimers: true,
        loopLimit: 100000
    });
    // The intro screen is new (the original has none): marked as seen in both apps, so the
    // refactored one boots straight into the app and both storages stay equal.
    for (const [key, value] of Object.entries({ [INTRO_SEEN_KEY]: '1', ...storage })) {
        window.localStorage.setItem(key, value);
    }
    if (beforeBoot) beforeBoot(window);

    window.eval(themeScript);
    window.eval(appCode);
    document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));

    const flush = () => new Promise(resolve => setImmediate(resolve));
    const el = target => {
        if (typeof target !== 'string') return target;
        const found = document.querySelector(target);
        if (!found) throw new Error(`${kind}: no element matches ${target}`);
        return found;
    };
    const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]';
    const pointerInit = (x = 10, y = 10, extra = {}) => ({
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window,
        button: 0,
        buttons: 1,
        pointerId: 1,
        pointerType: 'mouse',
        clientX: x,
        clientY: y,
        ...extra
    });

    const app = {
        kind,
        window,
        document,
        clock,
        consoleLog,
        errors,
        $: el,
        has: selector => !!document.querySelector(selector),
        /** A full mouse click: pointerdown, mousedown, focus, pointerup, mouseup, click. */
        click(target, { x, y } = {}) {
            const node = el(target);
            node.dispatchEvent(new window.PointerEvent('pointerdown', pointerInit(x, y)));
            node.dispatchEvent(new window.MouseEvent('mousedown', pointerInit(x, y)));
            const focusTarget = node.closest(FOCUSABLE);
            if (focusTarget && document.activeElement !== focusTarget) focusTarget.focus();
            node.dispatchEvent(new window.PointerEvent('pointerup', pointerInit(x, y, { buttons: 0 })));
            node.dispatchEvent(new window.MouseEvent('mouseup', pointerInit(x, y, { buttons: 0 })));
            node.click();
        },
        /** Types a whole value into a text field (one input event, then change). */
        type(target, value) {
            const node = el(target);
            node.focus();
            node.value = value;
            node.dispatchEvent(new window.Event('input', { bubbles: true }));
            node.dispatchEvent(new window.Event('change', { bubbles: true }));
        },
        key(target, key, extra = {}) {
            const node = target ? el(target) : document.activeElement || document.body;
            node.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra }));
        },
        /** Picks an option of an enhanced <select> through its custom list, like a user. */
        choose(selectId, value) {
            app.click(`#${selectId}_trigger`);
            // the open list is the last one: lists that are fading out stay in the DOM for 100ms
            const open = [...document.querySelectorAll('[role="listbox"]')].pop();
            const option = open && open.querySelector(`[role="option"][data-value="${value}"]`);
            if (!option) throw new Error(`${kind}: no option "${value}" in the list of #${selectId}`);
            app.click(option);
        },
        pointer(type, target, x, y, extra = {}) {
            const node = target ? el(target) : document;
            node.dispatchEvent(new window.PointerEvent(type, pointerInit(x, y, extra)));
        },
        dispatch(target, event) {
            el(target).dispatchEvent(event);
        },
        /** Lets timers, frames and microtasks run, like `ms` milliseconds passing. */
        async settle(ms = 600) {
            await flush();
            await clock.tickAsync(ms);
            await flush();
        },
        /** Moves the wall clock without running timers (e.g. to just before midnight). */
        setTime(date) {
            clock.setSystemTime(date);
        },
        close() {
            clock.uninstall();
            window.close();
        }
    };
    await app.settle(1000);
    return app;
}
