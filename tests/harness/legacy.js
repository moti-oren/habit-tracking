// Loads the ORIGINAL app (legacy/habit_tracker_dashboard.html) into the current jsdom window and
// returns its internals, so tests can call the original functions directly.
//
// The file on disk is never changed. Its script is evaluated as-is, with one line appended inside
// the IIFE that publishes every top-level declaration (mutable `let`s as getter/setter pairs).
// DOMContentLoaded is not dispatched, so the app does not boot: tests drive the functions.
//
// Requires the jsdom test environment and fake timers installed BEFORE loading (the script reads
// the clock while it is evaluated, e.g. to build the initial week).
import { legacyParts } from './paths.js';
import { installDomPolyfills } from './dom-polyfills.js';

/** Top-level declarations of the IIFE (8-space indent inside <script> + IIFE). */
export function topLevelDeclarations(script) {
    const fns = [];
    const consts = [];
    const lets = [];
    for (const m of script.matchAll(/^ {8}(?:(?:async )?function (\w+)|const (\w+)|let (\w+))/gm)) {
        if (m[1]) fns.push(m[1]);
        else if (m[2]) consts.push(m[2]);
        else lets.push(m[3]);
    }
    return { fns, consts, lets };
}

export function withExportHook(script, globalName = '__legacy__') {
    const { fns, consts, lets } = topLevelDeclarations(script);
    const members = [...fns, ...consts];
    const accessors = lets.map(n => `get ${n}() { return ${n}; }, set ${n}(v) { ${n} = v; }`);
    const hook = `\n        globalThis.${globalName} = { ${[...members, ...accessors].join(', ')} };\n`;
    const end = script.lastIndexOf('})();');
    if (end === -1) throw new Error('legacy script: closing IIFE not found');
    return script.slice(0, end) + hook + script.slice(end);
}

export function legacyBodyInnerHtml() {
    return legacyParts()
        .body.replace(/^<body[^>]*>/, '')
        .replace(/<\/body>$/, '')
        .replace(/\n\s*<script>[\s\S]*?<\/script>\n/, '\n');
}

/** Evaluates a fresh copy of the original app script and returns its raw internals. */
export function loadLegacyRaw() {
    installDomPolyfills(globalThis);
    document.body.innerHTML = legacyBodyInnerHtml();
    (0, eval)(withExportHook(legacyParts().appScript));
    const raw = globalThis.__legacy__;
    delete globalThis.__legacy__;
    return raw;
}

/**
 * The original internals behind the API the tests are written against (the module API of src/).
 * Where a refactored function takes explicitly what the original read from a shared variable,
 * the adapter sets that variable first, then calls the original.
 */
export function loadLegacy() {
    const raw = loadLegacyRaw();
    return {
        ...raw,
        raw,
        getWeeklyCountForHabit(habit, days) {
            raw.weekDays = days;
            return raw.getWeeklyCountForHabit(habit);
        },
        getPreviousRangeBounds(range) {
            raw.analyticsRangeState = range;
            return raw.getPreviousRangeBounds();
        },
        formatRangeLabel(range) {
            raw.analyticsRangeState = range;
            return raw.formatRangeLabel();
        }
    };
}
