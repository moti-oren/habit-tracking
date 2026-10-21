// The implementations every unit suite runs against: the original app and the refactored modules.
//
// Usage at the top of a test file (jsdom environment):
//   vi.useFakeTimers({ now: NOW });
//   const IMPLS = await implementations();
//   describe.each(IMPLS)('%s', (name, impl) => { ... });
import { loadLegacy } from './legacy.js';
import { loadModern } from './modern.js';

export async function implementations() {
    const list = [['original', loadLegacy()]];
    const modern = await loadModern();
    if (modern) list.push(['refactored', modern]);
    return list;
}

/**
 * Factories that build a FRESH instance per call (new closure / new module instances), for suites
 * that need a clean Store, clean caches or a clean localStorage view.
 */
export async function implementationFactories() {
    const list = [['original', async () => loadLegacy()]];
    if (await loadModern()) list.push(['refactored', async () => loadModern({ fresh: true })]);
    return list;
}

/** Wednesday 21 October 2026, 10:00 local time: the moment every suite starts from. */
export const NOW = new Date(2026, 9, 21, 10, 0, 0);

/** Moves the (fake) clock to a local date and time. Both implementations read the same clock. */
export function setNow(vi, y, m, d, h = 10, min = 0) {
    vi.setSystemTime(new Date(y, m - 1, d, h, min));
}
